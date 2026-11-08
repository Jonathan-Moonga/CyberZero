import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCyberStore } from '../store'
import type { BackupVersion, CyberZeroAPI } from '../types'
import { AGENT_TOOLS, buildAgentContext, executeAgentTool } from './agentTools'

const backup = (version: number) => ({ id: `backup-${version}`, version, status: 'Ready', createdAt: '2026-11-08', encryptedPath: 'C:/secret/path.czbak', manifestHash: 'hash-value', departments: [] }) as unknown as BackupVersion
const fake = { listBackups: vi.fn(async () => [backup(2), backup(1)]), listInvitations: vi.fn(async () => []), verifyBackup: vi.fn(async () => ({ verified: true, verifiedAt: 'now' })) }

beforeEach(() => {
  vi.clearAllMocks()
  window.cyberzero = fake as unknown as CyberZeroAPI
  useCyberStore.getState().resetDemo()
})

describe('Agent Zero tools', () => {
  it('offers no tool that can trigger a CEO-only operation', () => {
    const names = AGENT_TOOLS.map(t => t.function.name).join(' ')
    expect(names).not.toMatch(/isolate|zero_day|override|recover|decrypt|invit|breach/i)
  })

  it('provides no incident evidence before an incident exists', () => {
    const context = buildAgentContext()
    expect(context.evidence).toBeNull()
    expect(context.status).toContain('No incident is active')
  })

  it('always provides the evidence once an incident is running', () => {
    useCyberStore.getState().setSystemState('BREACH_DETECTED')
    const context = buildAgentContext()
    expect(context.evidence).toContain('CZ-OPS-204')
    expect(context.evidence).toContain('Level 1 and Level 2 credentials may be exposed')
    expect(context.status).toContain('10 GB/min')
  })

  it('keeps volatile numbers out of the cacheable evidence', () => {
    useCyberStore.getState().setSystemState('BREACH_DETECTED')
    const before = buildAgentContext().evidence
    useCyberStore.getState().setTransferredGb(42)
    expect(buildAgentContext().evidence).toBe(before)
  })

  it('keeps recovery material and paths out of the model context', () => {
    useCyberStore.getState().setBackups([backup(2)])
    useCyberStore.getState().setSystemState('TRACING')
    expect(JSON.stringify(buildAgentContext())).not.toMatch(/secret|hash-value/)
  })

  it('withholds backup paths and hashes from the model', async () => {
    expect(JSON.stringify(await executeAgentTool('list_backups', {}))).not.toMatch(/secret|hash-value/)
  })

  it('verifies the latest backup by default and a named version on request', async () => {
    await executeAgentTool('verify_backup', {})
    expect(fake.verifyBackup).toHaveBeenLastCalledWith('backup-2')
    await executeAgentTool('verify_backup', { version: '1' })
    expect(fake.verifyBackup).toHaveBeenLastCalledWith('backup-1')
  })

  it('rejects unknown pages and tools', async () => {
    await expect(executeAgentTool('open_page', { page: 'root' })).resolves.toHaveProperty('error')
    expect(useCyberStore.getState().page).toBe('dashboard')
    await expect(executeAgentTool('delete_everything', {})).resolves.toHaveProperty('error')
  })
})
