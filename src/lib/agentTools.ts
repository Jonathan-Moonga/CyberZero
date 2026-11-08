import type { OllamaTool, Page } from '../types'
import { useCyberStore } from '../store'
import type { AgentContext } from './agent'
import { api } from './api'
import { buildIncidentEvidence } from './evidence'

const noArgs = { type: 'object' as const, properties: {}, required: [] }
const tool = (name: string, description: string, parameters: OllamaTool['function']['parameters'] = noArgs): OllamaTool => ({ type: 'function', function: { name, description, parameters } })

// Deliberately excludes the breach simulation, Zero-Day Operation, recovery access, and decryption, which remain under direct CEO control.
export const AGENT_TOOLS: OllamaTool[] = [
  tool('list_backups', 'List encrypted backup versions and their verification status.'),
  tool('get_recent_activity', 'Get the most recent events from the command center activity log.'),
  tool('create_backup', 'Create a new encrypted backup version. Only use when the user asks for a backup.'),
  tool('verify_backup', 'Verify the integrity of a backup. Verifies the latest backup when no version is given.', { type: 'object', properties: { version: { type: 'number', description: 'Backup version number' } }, required: [] }),
  tool('open_page', 'Open a page of the command center.', { type: 'object', properties: { page: { type: 'string', enum: ['dashboard', 'backup', 'detection', 'settings'] } }, required: ['page'] }),
]

export const TOOL_LABELS: Record<string, string> = {
  list_backups: 'Checking the backup vault',
  get_recent_activity: 'Reading the activity log',
  create_backup: 'Creating an encrypted backup',
  verify_backup: 'Verifying backup integrity',
  open_page: 'Opening page',
}

const PAGES: Page[] = ['dashboard', 'backup', 'detection', 'settings']
const TRANSFER_ACTIVE_STATES = ['BREACH_DETECTED', 'AWAITING_CEO_AUTHORIZATION', 'TRACING']

const refreshBackups = async () => {
  const backups = await api().listBackups()
  useCyberStore.getState().setBackups(backups)
  return backups
}

/** Everything the model may state as fact this turn. Evidence is supplied directly because small models skip optional lookups and then guess. */
export function buildAgentContext(): AgentContext {
  const { systemState, page, backups, invitations, transferredGb } = useCyberStore.getState()
  const latest = backups[0]
  const summary = `System state: ${systemState}. Viewing the ${page} page. Backups: ${backups.length}${latest ? `, latest is version ${latest.version} with status ${latest.status}` : ''}.`
  if (systemState === 'SAFE') return { evidence: null, status: `${summary} No incident is active. The breach simulation has not been started, so there is no attacker or exposure to report.` }
  const transferActive = TRANSFER_ACTIVE_STATES.includes(systemState)
  const facts = buildIncidentEvidence({ systemState, transferredGb, transferActive, backups, invitations })
  return {
    evidence: [
      `Source address: ${facts.sourceIp}.`,
      `Account used: ${facts.accountUsed}, from unregistered device ${facts.unregisteredDevice}.`,
      `Target workstation: ${facts.targetWorkstation}, ${facts.location}.`,
      `Credential exposure: ${facts.credentialExposure}`,
      `Timeline: ${facts.timeline.map(({ time, event }) => `${time}, ${event}`).join('; ')}.`,
    ].join('\n'),
    status: `${summary} Transfer rate ${facts.transferRate}, ${facts.transferredGb} GB transferred.`,
  }
}

export async function executeAgentTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const store = useCyberStore.getState()
  switch (name) {
    case 'list_backups': {
      const backups = await refreshBackups()
      return { count: backups.length, backups: backups.map(({ version, status, createdAt, lastVerifiedAt }) => ({ version, status, createdAt, lastVerifiedAt })) }
    }
    case 'get_recent_activity':
      return store.activities.slice(0, 8).map(({ message, time }) => ({ message, time }))
    case 'create_backup': {
      const { backup } = await api().createBackup()
      await refreshBackups()
      store.addActivity(`Agent Zero created encrypted backup version ${backup.version}`, 'success')
      return { created: true, version: backup.version, status: backup.status }
    }
    case 'verify_backup': {
      const backups = await api().listBackups()
      const backup = args.version === undefined ? backups[0] : backups.find(b => b.version === Number(args.version))
      if (!backup) return { error: backups.length ? 'That backup version does not exist.' : 'No backups exist yet.' }
      const { verified } = await api().verifyBackup(backup.id)
      await refreshBackups()
      store.addActivity(`Agent Zero verified backup version ${backup.version}: ${verified ? 'passed' : 'failed'}`, verified ? 'success' : 'critical')
      return { version: backup.version, verified }
    }
    case 'open_page': {
      if (!PAGES.includes(args.page as Page)) return { error: 'Unknown page.' }
      store.setPage(args.page as Page)
      return { opened: args.page }
    }
    default:
      return { error: `Unknown tool: ${name}` }
  }
}
