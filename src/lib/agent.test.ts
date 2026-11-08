import { describe, expect, it, vi } from 'vitest'
import type { OllamaChatMessage, OllamaChatResult } from '../types'
import { buildConversation, pickInstalledModel, plannedToolCalls, runAgent, shouldUseModel, SYSTEM_PROMPT, toHistory } from './agent'
import { scriptResponse } from './demo'

const call = (name: string, args: Record<string, unknown> = {}) => ({ function: { name, arguments: args } })
const scriptedChat = (...replies: OllamaChatResult[]) => {
  const seen: OllamaChatMessage[][] = []
  const chat = vi.fn(async (messages: OllamaChatMessage[]) => { seen.push(messages); return replies[Math.min(seen.length - 1, replies.length - 1)] })
  return { chat, seen }
}
const messages: OllamaChatMessage[] = [{ role: 'user', content: 'How many backups?' }]

describe('runAgent', () => {
  it('feeds tool results back to the model and returns its answer', async () => {
    const { chat, seen } = scriptedChat({ content: '', toolCalls: [call('list_backups')] }, { content: 'You have two backups.', toolCalls: [] })
    const executeTool = vi.fn(async () => ({ count: 2 }))
    await expect(runAgent({ chat, executeTool, messages })).resolves.toBe('You have two backups.')
    expect(seen[1].at(-1)).toEqual({ role: 'tool', tool_name: 'list_backups', content: '{"count":2}' })
  })

  it('never repeats an identical side effect when the model loops', async () => {
    const { chat } = scriptedChat({ content: '', toolCalls: [call('create_backup')] })
    const executeTool = vi.fn(async () => ({ created: true }))
    const reply = await runAgent({ chat, executeTool, messages })
    expect(executeTool).toHaveBeenCalledTimes(1)
    expect(chat).toHaveBeenCalledTimes(5)
    expect(reply).toContain('tool limit')
  })

  it('reports a tool failure to the model instead of crashing', async () => {
    const { chat, seen } = scriptedChat({ content: '', toolCalls: [call('verify_backup')] }, { content: 'Verification failed.', toolCalls: [] })
    await runAgent({ chat, executeTool: async () => { throw new Error('vault locked') }, messages })
    expect(seen[1].at(-1)?.content).toContain('vault locked')
  })

  it('gives a spoken reply when the model returns nothing', async () => {
    const { chat } = scriptedChat({ content: '   ', toolCalls: [] })
    await expect(runAgent({ chat, executeTool: async () => null, messages })).resolves.toContain('could not produce')
  })
})

describe('routing between the script and the model', () => {
  it('keeps demo actions deterministic', () => {
    expect(shouldUseModel(scriptResponse('Simulate breach'))).toBe(false)
    expect(shouldUseModel(scriptResponse('Initiate Zero-Day Operation'))).toBe(false)
  })

  it('never lets the model handle a valid spoken override', () => {
    expect(shouldUseModel(scriptResponse('Access granted. Override code 4, 2, 5, 6, U as in university, T as in Texas, D as in Dallas.'))).toBe(false)
  })

  it('sends unscripted questions to the model', () => {
    expect(shouldUseModel(scriptResponse('Which systems matter most right now?'))).toBe(true)
  })

  it('keeps the scripted punchline out of the model', () => {
    expect(shouldUseModel(scriptResponse('What would I do without you?'))).toBe(false)
  })

  it('routes a bare yes to whoever asked the question', () => {
    const yes = scriptResponse('Yes.')
    expect(shouldUseModel(yes, 'SCRIPTED_DEMO')).toBe(false)
    expect(shouldUseModel(yes, 'OLLAMA')).toBe(true)
  })
})

describe('plannedToolCalls', () => {
  const names = (prompt: string) => plannedToolCalls(prompt).map(c => c.function.name)

  // "Verify it." is the exact prompt a real model answered with a fabricated success.
  it.each([['Verify it.', 'verify_backup'], ['Please create a new backup now.', 'create_backup'], ['Back everything up', 'create_backup'], ['Open the settings page.', 'open_page']])('runs %s without trusting the model', (prompt, tool) => {
    expect(names(prompt)).toEqual([tool])
  })

  it('targets a spoken backup version', () => {
    expect(plannedToolCalls('Verify version 3')[0].function.arguments).toEqual({ version: 3 })
  })

  it.each(['How do I create a backup?', 'What does verify mean?', 'Should we make a backup?', 'Thanks for the update'])('takes no action on %s', prompt => {
    expect(names(prompt)).toEqual([])
  })

  it('feeds a planned result to the model before its first turn', async () => {
    const { chat, seen } = scriptedChat({ content: 'Version 1 passed.', toolCalls: [] })
    const executeTool = vi.fn(async () => ({ verified: true }))
    await runAgent({ chat, executeTool, messages, plannedCalls: plannedToolCalls('Verify it.') })
    expect(executeTool).toHaveBeenCalledWith('verify_backup', {})
    expect(seen[0].at(-1)).toEqual({ role: 'tool', tool_name: 'verify_backup', content: '{"verified":true}' })
  })
})

describe('agent context', () => {
  it('keeps volatile state after the cached prefix and before the newest message', () => {
    const history: OllamaChatMessage[] = [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'reply' }, { role: 'user', content: 'newest' }]
    const conversation = buildConversation(history, { evidence: null, status: '4.2 GB transferred' })
    expect(conversation[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT })
    expect(conversation.map(m => m.content.split('\n')[0]).slice(1)).toEqual(['first', 'reply', 'LIVE STATE', 'newest'])
    expect(conversation[3].content).toContain('4.2 GB transferred')
  })

  it('places stable incident evidence in the cacheable system prefix', () => {
    const conversation = buildConversation([{ role: 'user', content: 'hi' }], { evidence: 'Target: CZ-OPS-204.', status: 'now' })
    expect(conversation[0].content).toContain('INCIDENT EVIDENCE\nTarget: CZ-OPS-204.')
    expect(conversation[1].content).not.toContain('CZ-OPS-204')
  })

  it('states the accountability and authorization boundaries', () => {
    expect(SYSTEM_PROMPT).toContain('who operated them is not established')
    expect(SYSTEM_PROMPT).toContain('You cannot start the breach simulation')
  })

  it('limits history sent to the model', () => {
    const long = Array.from({ length: 30 }, (_, i) => ({ id: String(i), role: 'user' as const, content: `m${i}`, source: 'USER' as const, createdAt: '' }))
    expect(toHistory(long)).toHaveLength(12)
    expect(toHistory(long).at(-1)).toEqual({ role: 'user', content: 'm29' })
  })

  it('prefers an installed model that can use tools', () => {
    expect(pickInstalledModel([{ name: 'a', tools: false }, { name: 'b', tools: true }])).toBe('b')
    expect(pickInstalledModel([])).toBeNull()
  })
})
