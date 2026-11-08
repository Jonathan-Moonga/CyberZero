import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Activity, AgentMessage, AgentState, BackupVersion, DecryptedFile, Invitation, Page, SystemState } from './types'
import { DEFAULT_OLLAMA_MODEL } from './lib/agent'
import { initialMessage } from './lib/demo'

interface CyberState {
  page: Page; sidebarCollapsed: boolean; systemState: SystemState; agentState: AgentState
  backups: BackupVersion[]; invitations: Invitation[]; activities: Activity[]; messages: AgentMessage[]
  transferredGb: number; muted: boolean; reducedMotion: boolean; alwaysListening: boolean; voiceName: string; ollamaEndpoint: string; ollamaModel: string
  decryptedFiles: DecryptedFile[]; profile: 'CEO' | 'Invited User'
  setPage: (page: Page) => void; toggleSidebar: () => void; setSystemState: (state: SystemState) => void; setAgentState: (state: AgentState) => void
  setBackups: (items: BackupVersion[]) => void; setInvitations: (items: Invitation[]) => void; addActivity: (message: string, tone?: Activity['tone']) => void
  addMessage: (message: AgentMessage) => void; setTransferredGb: (value: number) => void; setMuted: (v: boolean) => void; setReducedMotion: (v: boolean) => void; setAlwaysListening: (v: boolean) => void
  setVoiceName: (v: string) => void; setOllama: (endpoint: string, model: string) => void; setDecryptedFiles: (files: DecryptedFile[]) => void; setProfile: (profile: 'CEO' | 'Invited User') => void; resetDemo: () => void
}

const seedActivities: Activity[] = [{ id: 'welcome', message: 'Command center initialized in safe simulation mode', time: new Date().toISOString(), tone: 'success' }]

export const useCyberStore = create<CyberState>()(persist((set) => ({
  page: 'dashboard', sidebarCollapsed: false, systemState: 'SAFE', agentState: 'Idle', backups: [], invitations: [], activities: seedActivities, messages: [initialMessage()], transferredGb: 0, muted: false, reducedMotion: false, alwaysListening: false, voiceName: '', ollamaEndpoint: 'http://localhost:11434', ollamaModel: DEFAULT_OLLAMA_MODEL, decryptedFiles: [], profile: 'CEO',
  setPage: page => set({ page }), toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })), setSystemState: systemState => set({ systemState }), setAgentState: agentState => set({ agentState }),
  setBackups: backups => set({ backups }), setInvitations: invitations => set({ invitations }),
  addActivity: (message, tone = 'normal') => set(s => ({ activities: [{ id: crypto.randomUUID(), message, time: new Date().toISOString(), tone }, ...s.activities].slice(0, 20) })),
  addMessage: message => set(s => ({ messages: [...s.messages, message].slice(-40) })), setTransferredGb: transferredGb => set({ transferredGb }), setMuted: muted => set({ muted }), setReducedMotion: reducedMotion => set({ reducedMotion }), setAlwaysListening: alwaysListening => set({ alwaysListening }), setVoiceName: voiceName => set({ voiceName }), setOllama: (ollamaEndpoint, ollamaModel) => set({ ollamaEndpoint, ollamaModel }), setDecryptedFiles: decryptedFiles => set({ decryptedFiles }), setProfile: profile => set({ profile }),
  resetDemo: () => set({ page: 'dashboard', systemState: 'SAFE', agentState: 'Idle', backups: [], invitations: [], activities: seedActivities, messages: [initialMessage()], transferredGb: 0, decryptedFiles: [], profile: 'CEO' }),
}), { name: 'cyberzero-state', partialize: s => ({ sidebarCollapsed: s.sidebarCollapsed, systemState: s.systemState, activities: s.activities, messages: s.messages, muted: s.muted, reducedMotion: s.reducedMotion, alwaysListening: s.alwaysListening, voiceName: s.voiceName, ollamaEndpoint: s.ollamaEndpoint, ollamaModel: s.ollamaModel, profile: s.profile }) }))
