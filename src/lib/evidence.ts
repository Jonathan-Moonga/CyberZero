import type { BackupVersion, Invitation, IncidentEvidence, SystemState } from '../types'
import { timeline } from './demo'

interface EvidenceInput {
  systemState: SystemState
  transferredGb: number
  transferActive: boolean
  backups: BackupVersion[]
  invitations: Invitation[]
}

// Only simulated incident facts and backup status leave the device. File paths, hashes, contacts, and recovery material are deliberately excluded.
export function buildIncidentEvidence({ systemState, transferredGb, transferActive, backups, invitations }: EvidenceInput): IncidentEvidence {
  return {
    classification: 'SIMULATION: all company data and events are fictional',
    incidentState: systemState,
    sourceIp: '203.0.113.42',
    accountUsed: 'Chad Newark',
    unregisteredDevice: 'UNKNOWN-WIN-77',
    targetWorkstation: 'CZ-OPS-204',
    location: 'Floor 2, Operations Room 2B',
    transferredGb: Number(transferredGb.toFixed(1)),
    transferRate: transferActive ? '10 GB/min' : '0 GB/min',
    timeline: timeline.map(([time, event]) => ({ time, event })),
    credentialExposure: 'Level 1 and Level 2 credentials may be exposed. No evidence of access to Level 3, Level 4, Level 5, or executive credentials.',
    backups: backups.map(({ version, status, createdAt, lastVerifiedAt, departments }) => ({ version, status, createdAt, lastVerifiedAt, departments: departments.map(d => d.department) })),
    recoveryInvitations: invitations.length,
  }
}
