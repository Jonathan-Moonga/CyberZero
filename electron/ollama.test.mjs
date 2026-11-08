import { afterEach, describe, expect, it, vi } from 'vitest'
import ollama from './ollama.cjs'

const local = { endpoint: 'http://localhost:11434', model: 'qwen3:4b' }
const tags = (models) => vi.fn(async () => new Response(JSON.stringify({ models })))
const stream = (...parts) => vi.fn(async () => new Response(new ReadableStream({ start(controller) { const encoder = new TextEncoder(); parts.forEach(part => controller.enqueue(encoder.encode(part))); controller.close() } })))
const signal = new AbortController().signal
const input = { ...local, messages: [{ role: 'user', content: 'hi' }] }

afterEach(() => vi.unstubAllGlobals())

describe('checkOllama', () => {
  it('is available only when the configured model is installed', async () => {
    vi.stubGlobal('fetch', tags([{ name: 'qwen3:4b', capabilities: ['completion', 'tools'] }]))
    await expect(ollama.checkOllama(local)).resolves.toMatchObject({ available: true, toolsSupported: true })
    await expect(ollama.checkOllama({ ...local, model: 'llama3.2' })).resolves.toMatchObject({ available: false, reachable: true })
  })

  it('matches an implicit latest tag and detects missing tool support', async () => {
    vi.stubGlobal('fetch', tags([{ name: 'gemma:latest', capabilities: ['completion'] }]))
    await expect(ollama.checkOllama({ ...local, model: 'gemma' })).resolves.toMatchObject({ available: true, toolsSupported: false })
  })

  it('never contacts a non-local endpoint', async () => {
    const fetchMock = tags([])
    vi.stubGlobal('fetch', fetchMock)
    await expect(ollama.checkOllama({ endpoint: 'https://example.com', model: 'x' })).resolves.toMatchObject({ reachable: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('streamChat', () => {
  it('reassembles NDJSON split across network chunks', async () => {
    vi.stubGlobal('fetch', stream('{"message":{"content":"Hel', 'lo"}}\n{"message":{"content":" there"}}\n{"done":true}'))
    const deltas = []
    await expect(ollama.streamChat(input, delta => deltas.push(delta), signal)).resolves.toEqual({ content: 'Hello there', toolCalls: [] })
    expect(deltas).toEqual(['Hello', ' there'])
  })

  it('collects tool calls and disables hidden reasoning', async () => {
    const fetchMock = stream('{"message":{"content":"","tool_calls":[{"function":{"name":"list_backups","arguments":{}}}]}}\n')
    vi.stubGlobal('fetch', fetchMock)
    const result = await ollama.streamChat({ ...input, tools: [{ type: 'function' }] }, () => undefined, signal)
    expect(result.toolCalls[0].function.name).toBe('list_backups')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ stream: true, think: false, tools: [{ type: 'function' }] })
  })

  it('surfaces errors reported mid-stream', async () => {
    vi.stubGlobal('fetch', stream('{"error":"model crashed"}\n'))
    await expect(ollama.streamChat(input, () => undefined, signal)).rejects.toThrow('model crashed')
  })

  it('refuses non-local endpoints and malformed input before any request', async () => {
    const fetchMock = stream('')
    vi.stubGlobal('fetch', fetchMock)
    await expect(ollama.streamChat({ ...input, endpoint: 'http://10.0.0.5:11434' }, () => undefined, signal)).rejects.toThrow('local')
    await expect(ollama.streamChat({ ...input, model: 'bad model!' }, () => undefined, signal)).rejects.toThrow('invalid')
    await expect(ollama.streamChat({ ...input, messages: [{ role: 'root', content: 'x' }] }, () => undefined, signal)).rejects.toThrow('invalid')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
