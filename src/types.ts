export type Page = 'dashboard' | 'backup' | 'detection' | 'settings'
export type SystemState = 'SAFE' | 'BREACH_DETECTED' | 'AWAITING_CEO_AUTHORIZATION' | 'ISOLATING' | 'ISOLATED' | 'RECOVERY_SETUP' | 'TRACING' | 'MONITORING'
export type AgentState = 'Idle' | 'Listening' | 'Thinking' | 'Speaking' | 'Critical Alert' | 'Awaiting Authorization' | 'Executing Simulation' | 'Recovery Mode'
export type Department = 'Finance' | 'Human Resources' | 'Operations' | 'Executive'
export type UserRole = 'CEO' | 'CTO' | 'Managing Director' | 'Recovery Member'

export interface BackupFile { name: string; size: number }
export interface DepartmentFiles { department: Department; files: BackupFile[] }
export interface BackupVersion {
  id: string
  version: number
  createdAt: string
  createdBy: string
  encryptedPath: string
  manifestHash: string
  sizeBytes: number
  status: 'Ready' | 'Creating' | 'Verified' | 'Failed' | 'Decrypting'
  departments: DepartmentFiles[]
  lastVerifiedAt?: string
}

export interface Invitation {
  id: string
  name: string
  contact: string
  department: Department
  role: UserRole
  status: 'Pending' | 'Queued' | 'Accepted' | 'Expired' | 'Revoked'
  expiresAt: string
  createdAt: string
  backupId: string
  photonMessageId?: string
}

export interface Activity { id: string; message: string; time: string; tone?: 'normal' | 'success' | 'warning' | 'critical' }
export interface AgentMessage { id: string; role: 'user' | 'assistant'; content: string; source: 'USER' | 'OLLAMA' | 'SCRIPTED_DEMO'; createdAt: string }
export interface DecryptedFile { name: string; content: string; department: Department }

export interface BackupCreateResult { backup: BackupVersion }
export interface InviteResult { invitation: Invitation; recoveryPhrase: string; delivery: 'sent' | 'queued' }
export interface RecoverResult { files: DecryptedFile[]; invitation: Invitation }

export type GeminiSeverity = 'Low' | 'Medium' | 'High' | 'Critical'
export interface GeminiFinding { title: string; severity: GeminiSeverity; detail: string; evidence: string }
export interface GeminiGap { missing: string; where: string; whyItMatters: string; howToClose: string }
export interface GeminiAnalysis { assessment: string; severity: GeminiSeverity; confidence: 'Low' | 'Medium' | 'High'; findings: GeminiFinding[]; gaps: GeminiGap[]; actions: string[] }
export interface GeminiAnalysisResult { analysis: GeminiAnalysis; model: string; analyzedAt: string; source: 'GEMINI' }
export interface GeminiHealth { available: boolean; model: string; detail: string }

export interface IncidentEvidence {
  classification: string
  incidentState: SystemState
  sourceIp: string
  accountUsed: string
  unregisteredDevice: string
  targetWorkstation: string
  location: string
  transferredGb: number
  transferRate: string
  timeline: { time: string; event: string }[]
  credentialExposure: string
  backups: { version: number; status: BackupVersion['status']; createdAt: string; lastVerifiedAt?: string; departments: Department[] }[]
  recoveryInvitations: number
}

export interface CyberZeroAPI {
  checkGemini(): Promise<GeminiHealth>
  analyzeIncident(evidence: IncidentEvidence): Promise<GeminiAnalysisResult>
  createBackup(): Promise<BackupCreateResult>
  listBackups(): Promise<BackupVersion[]>
  verifyBackup(id: string): Promise<{ verified: boolean; verifiedAt: string }>
  createInvitation(input: { name: string; contact: string; department: Department; role: UserRole; backupId: string }): Promise<InviteResult>
  listInvitations(): Promise<Invitation[]>
  recover(input: { invitationId: string; phrase: string }): Promise<RecoverResult>
  checkOllama(input: { endpoint: string; model: string }): Promise<OllamaHealth>
  chatOllama(input: OllamaChatInput, onDelta: (delta: string) => void): Promise<OllamaChatResult>
  cancelOllama(requestId: string): Promise<void>
  checkVoice(): Promise<VoiceStatus>
  prepareVoice(onProgress: (progress: { percent: number }) => void): Promise<void>
  transcribe(samples: Float32Array): Promise<string>
  getRuntimeInfo(): Promise<{ dataPath: string; electron: boolean }>
}

export interface OllamaHealth { available: boolean; reachable: boolean; toolsSupported: boolean; detail: string; models: { name: string; tools: boolean }[] }
export interface OllamaToolCall { function: { name: string; arguments: Record<string, unknown> } }
export interface OllamaChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_name?: string; tool_calls?: OllamaToolCall[] }
export interface OllamaTool { type: 'function'; function: { name: string; description: string; parameters: { type: 'object'; properties: Record<string, unknown>; required: string[] } } }
export interface OllamaChatInput { requestId: string; endpoint: string; model: string; messages: OllamaChatMessage[]; tools?: OllamaTool[] }
export interface OllamaChatResult { content: string; toolCalls: OllamaToolCall[] }
export interface VoiceStatus { available: boolean; ready: boolean; detail: string }

declare global {
  interface Window {
    cyberzero?: CyberZeroAPI
  }
}
