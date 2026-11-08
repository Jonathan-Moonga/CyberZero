import type { BackupVersion, CyberZeroAPI, Invitation, OllamaToolCall } from '../types'
import { seededFiles } from './demo'

const webBackupsKey = 'cyberzero-web-backups'
const webInvitesKey = 'cyberzero-web-invitations'
const webChats = new Map<string, AbortController>()

const read = <T>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback }
}

const webFallback: CyberZeroAPI = {
  async createBackup() {
    const list = read<BackupVersion[]>(webBackupsKey, [])
    const version = list.length + 1
    const stamp = new Date().toISOString()
    const backup: BackupVersion = { id: crypto.randomUUID(), version, createdAt: stamp, createdBy: 'Jonathan Reeves', encryptedPath: `browser-demo/backups/version-${String(version).padStart(3, '0')}/company-backup.czbak`, manifestHash: Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v => v.toString(16).padStart(2, '0')).join(''), sizeBytes: seededFiles.flatMap(d => d.files).reduce((a, f) => a + f.size, 0), status: 'Ready', departments: seededFiles }
    localStorage.setItem(webBackupsKey, JSON.stringify([backup, ...list]))
    return { backup }
  },
  async listBackups() { return read(webBackupsKey, []) },
  async verifyBackup(id) { const list = read<BackupVersion[]>(webBackupsKey, []).map(b => b.id === id ? { ...b, status: 'Verified' as const, lastVerifiedAt: new Date().toISOString() } : b); localStorage.setItem(webBackupsKey, JSON.stringify(list)); return { verified: true, verifiedAt: new Date().toISOString() } },
  async createInvitation(input) { const invitation: Invitation = { ...input, id: crypto.randomUUID(), status: 'Queued', expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString() }; const invites = [invitation, ...read<Invitation[]>(webInvitesKey, [])]; localStorage.setItem(webInvitesKey, JSON.stringify(invites)); return { invitation, recoveryPhrase: `CZ-${crypto.randomUUID().slice(0, 4).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`, delivery: 'queued' as const } },
  async listInvitations() { return read(webInvitesKey, []) },
  async recover() { throw new Error('Secure recovery requires the Electron desktop runtime.') },
  async checkOllama({ endpoint, model }) {
    const unreachable = (detail: string) => ({ available: false, reachable: false, toolsSupported: false, detail, models: [] })
    try {
      const response = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(1500) })
      if (!response.ok) return unreachable(`HTTP ${response.status}`)
      const body = await response.json() as { models?: { name: string; capabilities?: string[] }[] }
      const models = (body.models ?? []).map(m => ({ name: m.name, tools: m.capabilities ? m.capabilities.includes('tools') : true }))
      const selected = models.find(m => m.name === model || m.name === `${model}:latest`)
      return { available: Boolean(selected), reachable: true, toolsSupported: selected?.tools ?? false, models, detail: selected ? `Connected to ${selected.name}` : `Model "${model}" is not installed` }
    } catch { return unreachable('Ollama unavailable — Demo Script Mode active') }
  },
  async chatOllama({ requestId, endpoint, model, messages, tools }, onDelta) {
    const controller = new AbortController()
    webChats.set(requestId, controller)
    try {
      const response = await fetch(`${endpoint}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, tools: tools?.length ? tools : undefined, stream: true, think: false, keep_alive: '15m' }), signal: controller.signal })
      if (!response.ok || !response.body) throw new Error('Local Ollama request failed')
      let content = ''
      const toolCalls: OllamaToolCall[] = []
      const handleLine = (line: string) => {
        if (!line.trim()) return
        const chunk = JSON.parse(line) as { message?: { content?: string; tool_calls?: OllamaToolCall[] } }
        if (chunk.message?.content) { content += chunk.message.content; onDelta(chunk.message.content) }
        if (chunk.message?.tool_calls) toolCalls.push(...chunk.message.tool_calls)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        lines.forEach(handleLine)
      }
      handleLine(buffer)
      return { content, toolCalls }
    } finally { webChats.delete(requestId) }
  },
  async cancelOllama(requestId) { webChats.get(requestId)?.abort() },
  async checkVoice() { return { available: false, ready: false, detail: 'Voice input requires the Electron desktop runtime.' } },
  async prepareVoice() { throw new Error('Voice input requires the Electron desktop runtime.') },
  async transcribe() { throw new Error('Voice input requires the Electron desktop runtime.') },
  async checkGemini() { return { available: false, model: '', detail: 'Gemini analysis requires the Electron desktop runtime.' } },
  async analyzeIncident() { throw new Error('Gemini analysis requires the Electron desktop runtime.') },
  async getRuntimeInfo() { return { dataPath: 'Browser demo storage', electron: false } },
}

export const api = (): CyberZeroAPI => window.cyberzero ?? webFallback
