const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cyberzero', Object.freeze({
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  verifyBackup: (id) => ipcRenderer.invoke('backup:verify', { id }),
  createInvitation: (input) => ipcRenderer.invoke('invitation:create', input),
  listInvitations: () => ipcRenderer.invoke('invitation:list'),
  recover: (input) => ipcRenderer.invoke('recovery:decrypt', input),
  checkOllama: (input) => ipcRenderer.invoke('ollama:health', input),
  chatOllama: async (input, onDelta) => {
    const listener = (_event, message) => { if (message.requestId === input.requestId) onDelta(message.delta) }
    ipcRenderer.on('ollama:chat-delta', listener)
    try { return await ipcRenderer.invoke('ollama:chat', input) } finally { ipcRenderer.removeListener('ollama:chat-delta', listener) }
  },
  cancelOllama: (requestId) => ipcRenderer.invoke('ollama:cancel', { requestId }),
  checkVoice: () => ipcRenderer.invoke('voice:status'),
  prepareVoice: async (onProgress) => {
    const listener = (_event, progress) => onProgress(progress)
    ipcRenderer.on('voice:progress', listener)
    try { await ipcRenderer.invoke('voice:prepare') } finally { ipcRenderer.removeListener('voice:progress', listener) }
  },
  transcribe: (samples) => ipcRenderer.invoke('voice:transcribe', samples),
  checkGemini: () => ipcRenderer.invoke('gemini:health'),
  analyzeIncident: (evidence) => ipcRenderer.invoke('gemini:analyze', evidence),
  getRuntimeInfo: () => ipcRenderer.invoke('runtime:info'),
}))
