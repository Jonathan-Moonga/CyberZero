import { describe, expect, it } from 'vitest'
import { scriptResponse } from './demo'

describe('Agent Zero scripted demo', () => {
  it('routes breach simulation commands', () => {
    const result = scriptResponse('Simulate breach')
    expect(result.action).toBe('breach')
    expect(result.content).toContain('ten gigabytes per minute')
  })

  it('does not accuse the fictional employee', () => {
    const result = scriptResponse('show me the attack')
    expect(result.content).toContain('does not establish that Chad initiated the attack')
  })

  it('requests authorization for the operation', () => {
    const result = scriptResponse('Agent Zero, initiate Zero-Day Operation')
    expect(result.action).toBe('authorize')
    expect(result.content).toContain('will not alter the physical router')
  })

  it('accepts the full spoken demo override phrase', () => {
    const result = scriptResponse('Access granted. Complete Zero-Day Operation using override code four, two, five, six, U as in University, T as in Texas, D as in Dallas.')
    expect(result.action).toBe('execute')
    expect(result.content).toBe('Accepted. Initiating Zero-Day Operation.')
  })
})
