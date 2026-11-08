import { afterEach, describe, expect, it, vi } from 'vitest'
import gemini from './gemini.cjs'

const env = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test' }
const analysis = {
  assessment: 'Credentials were used from an unregistered device.',
  severity: 'Critical',
  confidence: 'Medium',
  findings: [{ title: 'Remote access', severity: 'High', detail: 'Session reached the workstation.', evidence: '09:41:14 remote access' }, { title: 'Malformed' }],
  gaps: [{ missing: 'MFA logs', where: 'Identity provider', whyItMatters: 'Shows how login succeeded.', howToClose: 'Export sign-in logs.' }],
  actions: ['Rotate exposed credentials'],
}
const reply = (body, ok = true, status = 200) => vi.fn(async () => ({ ok, status, json: async () => body }))
const success = (parts = [{ text: JSON.stringify(analysis) }]) => reply({ candidates: [{ finishReason: 'STOP', content: { parts } }] })

afterEach(() => vi.unstubAllGlobals())

describe('analyzeIncident', () => {
  it('sends the key in a header and requests schema-constrained JSON', async () => {
    const fetchMock = success()
    vi.stubGlobal('fetch', fetchMock)
    await gemini.analyzeIncident({ sourceIp: '203.0.113.42' }, env)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
    expect(url).not.toContain('test-key')
    expect(init.headers['x-goog-api-key']).toBe('test-key')
    const body = JSON.parse(init.body)
    expect(body.generationConfig.responseFormat.text.mimeType).toBe('APPLICATION_JSON')
    expect(body.generationConfig.responseFormat.text.schema.required).toContain('gaps')
    expect(body.contents[0].parts[0].text).toContain('203.0.113.42')
  })

  it('returns findings and gaps and drops malformed entries', async () => {
    vi.stubGlobal('fetch', success())
    const result = await gemini.analyzeIncident({ a: 1 }, env)
    expect(result.source).toBe('GEMINI')
    expect(result.model).toBe('gemini-test')
    expect(result.analysis.findings).toHaveLength(1)
    expect(result.analysis.gaps[0].missing).toBe('MFA logs')
  })

  it('ignores thought parts when reading the response', async () => {
    vi.stubGlobal('fetch', success([{ text: 'reasoning', thought: true }, { text: JSON.stringify(analysis) }]))
    await expect(gemini.analyzeIncident({ a: 1 }, env)).resolves.toMatchObject({ source: 'GEMINI' })
  })

  it('makes no request when the key is missing', async () => {
    const fetchMock = success()
    vi.stubGlobal('fetch', fetchMock)
    await expect(gemini.analyzeIncident({ a: 1 }, { GEMINI_API_KEY: '  ' })).rejects.toThrow('GEMINI_API_KEY is empty')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized evidence and unsafe model names before calling Google', async () => {
    const fetchMock = success()
    vi.stubGlobal('fetch', fetchMock)
    await expect(gemini.analyzeIncident({ a: 'x'.repeat(13000) }, env)).rejects.toThrow('too large')
    await expect(gemini.analyzeIncident({ a: 1 }, { ...env, GEMINI_MODEL: '../../evil' })).rejects.toThrow('not a valid model')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports rejected keys without echoing the key', async () => {
    vi.stubGlobal('fetch', reply({}, false, 403))
    const error = await gemini.analyzeIncident({ a: 1 }, env).catch(e => e)
    expect(error.message).toContain('Check GEMINI_API_KEY')
    expect(error.message).not.toContain('test-key')
  })

  it('reports blocked, truncated, and unreadable responses', async () => {
    vi.stubGlobal('fetch', reply({ candidates: [] }))
    await expect(gemini.analyzeIncident({ a: 1 }, env)).rejects.toThrow('safety filter')
    vi.stubGlobal('fetch', reply({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }))
    await expect(gemini.analyzeIncident({ a: 1 }, env)).rejects.toThrow('stopped before finishing')
    vi.stubGlobal('fetch', success([{ text: 'not json' }]))
    await expect(gemini.analyzeIncident({ a: 1 }, env)).rejects.toThrow('unreadable')
  })
})

describe('checkGemini', () => {
  it('reports a missing key without any network call', async () => {
    const fetchMock = success()
    vi.stubGlobal('fetch', fetchMock)
    await expect(gemini.checkGemini({})).resolves.toMatchObject({ available: false, model: 'gemini-3.6-flash' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports connected only when Google accepts the key', async () => {
    vi.stubGlobal('fetch', reply({}))
    await expect(gemini.checkGemini(env)).resolves.toMatchObject({ available: true, detail: 'Connected to gemini-test' })
    vi.stubGlobal('fetch', reply({}, false, 403))
    await expect(gemini.checkGemini(env)).resolves.toMatchObject({ available: false })
  })
})
