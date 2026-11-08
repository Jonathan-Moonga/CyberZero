import { describe, expect, it } from 'vitest'
import type { BackupVersion, Invitation } from '../types'
import { buildIncidentEvidence } from './evidence'

const backup: BackupVersion = { id: 'backup-id-1', version: 3, createdAt: '2026-11-08T10:00:00.000Z', createdBy: 'CEO', encryptedPath: 'C:/vault/secret-path.czbak', manifestHash: 'manifest-hash-value', sizeBytes: 10, status: 'Verified', departments: [{ department: 'Finance', files: [{ name: 'payroll-summary.csv', size: 1 }] }] }
const invitation: Invitation = { id: 'invite-id-1', name: 'Olivia Torres', contact: 'olivia@example.invalid', department: 'Operations', role: 'Managing Director', status: 'Queued', expiresAt: '', createdAt: '', backupId: 'backup-id-1' }

describe('buildIncidentEvidence', () => {
  const evidence = buildIncidentEvidence({ systemState: 'BREACH_DETECTED', transferredGb: 1.234, transferActive: true, backups: [backup], invitations: [invitation] })

  it('includes the incident facts and backup status Gemini needs', () => {
    expect(evidence.targetWorkstation).toBe('CZ-OPS-204')
    expect(evidence.transferRate).toBe('10 GB/min')
    expect(evidence.transferredGb).toBe(1.2)
    expect(evidence.timeline.length).toBeGreaterThan(0)
    expect(evidence.backups[0]).toMatchObject({ version: 3, status: 'Verified', departments: ['Finance'] })
    expect(evidence.recoveryInvitations).toBe(1)
  })

  it('never includes file paths, hashes, file names, or invitee details', () => {
    const serialized = JSON.stringify(evidence)
    for (const secret of ['secret-path', 'manifest-hash-value', 'payroll-summary', 'Olivia', 'olivia@example.invalid']) expect(serialized).not.toContain(secret)
  })
})
