import type { AgentMessage, Department } from '../types'
import { containsSpokenOverride } from './voice'

export const DEPARTMENTS: Department[] = ['Finance', 'Human Resources', 'Operations', 'Executive']

export const seededFiles = [
  { department: 'Finance' as const, files: [{ name: 'payroll-summary.csv', size: 164 }, { name: 'quarterly-budget.json', size: 238 }] },
  { department: 'Human Resources' as const, files: [{ name: 'employee-directory.json', size: 303 }, { name: 'benefits-summary.md', size: 176 }] },
  { department: 'Operations' as const, files: [{ name: 'inventory.json', size: 284 }, { name: 'vendor-status.csv', size: 221 }] },
  { department: 'Executive' as const, files: [{ name: 'continuity-plan.md', size: 342 }, { name: 'emergency-contacts.json', size: 198 }] },
]

export const timeline = [
  ['2 months ago', 'Payroll-themed email received by Chad Newark'],
  ['2 months ago', 'hive-payroll.example automatically flagged; no follow-up recorded'],
  ['09:41:02', 'Credentials used from unregistered device UNKNOWN-WIN-77'],
  ['09:41:14', 'Remote access established to CZ-OPS-204'],
  ['09:42:08', 'Level 1 and Level 2 credential collection detected'],
  ['09:42:31', 'Simulated outbound transfer began at 10 GB/min'],
]

export interface ScriptedResponse {
  content: string
  action?: 'breach' | 'authorize' | 'execute' | 'trace' | 'backup' | 'monitor'
  /** No fixed dialogue applies, so a live model should answer instead. */
  modelEligible?: boolean
  /** An affirmation whose meaning depends on who asked the preceding question. */
  followUp?: boolean
}

export const scriptResponse = (input: string): ScriptedResponse => {
  const text = input.toLowerCase()
  if (containsSpokenOverride(input)) return { action: 'execute', content: 'Accepted. Initiating Zero-Day Operation.' }
  if (text.includes('simulate breach') || text.includes('run breach')) return { action: 'breach', content: 'Alert. Alert. Hack detected. Company data is being transferred to an unsecured remote server at approximately ten gigabytes per minute. Would you like to implement preventive measures?' }
  if (text.includes('show me the attack') || text.includes('show attack')) return { action: 'trace', content: "An unauthorized login from an unregistered device has breached the simulated company environment using Chad Newark's credentials. This does not establish that Chad initiated the attack. The session is currently extracting company data. Would you like to begin containment?" }
  if (text.includes('zero-day') || text.includes('zero day') || text.includes('isolate')) return { action: 'authorize', content: 'CEO override required. Zero-Day Operation will isolate every endpoint in the simulated company network, stop the simulated transfer, and enter recovery mode. This demo will not alter the physical router or other devices. Do you consent?' }
  if (text.includes('latest backup') || text.includes('backup system') || text.includes('set up recovery access')) return { action: 'backup', content: 'Opening the encrypted backup vault. I will keep recovery access scoped to the selected department.' }
  if (text.includes('movement') || text.includes('trace breach')) return { action: 'trace', content: "Very well, sir. The breach originated from 203.0.113.42 and reached CZ-OPS-204 in Floor 2, Operations Room 2B. Chad Newark's credentials were used as the entry point. This does not establish that Chad initiated the attack." }
  if (text.trim().replace(/[.!?,]+$/, '') === 'yes' || text.includes('proceed')) return { followUp: true, content: "The historical scan found a payroll-themed email received two months ago. It linked to hive-payroll.example and was automatically flagged, but no follow-up was recorded. Chad's credentials were later used from an unregistered device. Current evidence indicates that Level 1 and Level 2 credentials may be exposed. I found no evidence of access to Level 3, Level 4, Level 5, or executive credentials. I recommend rotating affected credentials, completing the investigation, and restoring only from a verified backup after containment." }
  if (text.includes('what would i do without you')) return { content: "I'm sure you would manage, sir." }
  if (text.includes('continue tracking') || text.includes('monitor')) return { action: 'monitor', content: 'Understood. Monitoring will continue in simulation mode.' }
  if (text.includes('system check')) return { modelEligible: true, content: 'System check complete. The local backup vault is available. External integrations remain clearly labeled by their current connection state.' }
  return { modelEligible: true, content: 'I can run a system check, simulate the breach, show the latest backup, trace the breach, or initiate the simulated Zero-Day Operation.' }
}

export const initialMessage = (): AgentMessage => ({ id: crypto.randomUUID(), role: 'assistant', content: 'Command center ready. All company data and response actions in this application are simulated.', source: 'SCRIPTED_DEMO', createdAt: new Date().toISOString() })
