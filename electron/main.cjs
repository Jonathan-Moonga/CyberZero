const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const crypto = require('node:crypto')
const { analyzeIncident, checkGemini } = require('./gemini.cjs')
const { checkOllama, streamChat } = require('./ollama.cjs')
const { createWhisper } = require('./whisper.cjs')

try { process.loadEnvFile(path.join(__dirname, '..', '.env')) } catch { /* .env is optional; live services report as unavailable. */ }

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
let dataRoot = ''

const departments = {
  Finance: {
    'payroll-summary.csv': 'period,total_payroll,status\\nQ4 Demo,1250000,simulated\\n',
    'quarterly-budget.json': JSON.stringify({ quarter: 'Q4', currency: 'USD', budget: 4200000, note: 'Fictional demonstration data' }, null, 2),
  },
  'Human Resources': {
    'employee-directory.json': JSON.stringify({ notice: 'Fictional demonstration records only', departments: ['Finance', 'Human Resources', 'Operations', 'Executive'], headcount: 48 }, null, 2),
    'benefits-summary.md': '# Benefits Summary\\n\\nFictional company benefits data for the CyberZero demonstration.',
  },
  Operations: {
    'inventory.json': JSON.stringify({ generatedFor: 'CyberZero demonstration', items: [{ sku: 'CZ-LAPTOP', count: 42 }, { sku: 'CZ-DOCK', count: 38 }], classification: 'SIMULATED' }, null, 2),
    'vendor-status.csv': 'vendor,status,next_review\\nNorthstar Demo Supply,Active,2026-12-01\\nMoonline Logistics,Review,2026-11-20\\n',
  },
  Executive: {
    'continuity-plan.md': '# Continuity Plan\\n\\n1. Confirm containment.\\n2. Verify backup integrity.\\n3. Restore only authorized data.\\n\\n*Simulation document.*',
    'emergency-contacts.json': JSON.stringify({ notice: 'All contacts are fictional', contacts: [{ role: 'Incident Lead', contact: 'incident@example.invalid' }] }, null, 2),
  },
}

const ensureData = async () => {
  dataRoot = path.join(app.getPath('userData'), 'cyberzero-data')
  await fs.mkdir(path.join(dataRoot, 'backups'), { recursive: true })
  await fs.mkdir(path.join(dataRoot, 'metadata'), { recursive: true })
  const keyPath = path.join(dataRoot, 'vault.key')
  try { await fs.access(keyPath) } catch { await fs.writeFile(keyPath, crypto.randomBytes(32), { mode: 0o600 }) }
}

const readJson = async (name, fallback) => {
  try { return JSON.parse(await fs.readFile(path.join(dataRoot, 'metadata', name), 'utf8')) } catch { return fallback }
}
const writeJson = (name, value) => fs.writeFile(path.join(dataRoot, 'metadata', name), JSON.stringify(value, null, 2))
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const aesEncrypt = (plaintext, key) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') }
}
const aesDecrypt = (payload, key) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()])
}
const scrypt = (phrase, salt) => new Promise((resolve, reject) => crypto.scrypt(phrase, salt, 32, (error, key) => error ? reject(error) : resolve(key)))
const safeId = (value) => typeof value === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(value)

async function createBackup() {
  const backups = await readJson('backups.json', [])
  const version = Math.max(0, ...backups.map(b => b.version)) + 1
  const id = crypto.randomUUID()
  const folder = path.join(dataRoot, 'backups', `version-${String(version).padStart(3, '0')}`)
  await fs.mkdir(folder, { recursive: true })
  const vaultKey = await fs.readFile(path.join(dataRoot, 'vault.key'))
  const payload = { format: 'cyberzero-backup-v1', id, version, departments: {} }
  const manifestDepartments = []
  for (const [department, files] of Object.entries(departments)) {
    const dataKey = crypto.randomBytes(32)
    const archive = Buffer.from(JSON.stringify(files))
    const encrypted = aesEncrypt(archive, dataKey)
    const wrapped = aesEncrypt(dataKey, vaultKey)
    payload.departments[department] = { ...encrypted, vaultWrappedKey: wrapped }
    manifestDepartments.push({ department, files: Object.entries(files).map(([name, content]) => ({ name, size: Buffer.byteLength(content), sha256: sha256(content) })) })
  }
  const serialized = JSON.stringify(payload)
  const manifest = { backupId: id, version, createdAt: new Date().toISOString(), archiveSha256: sha256(serialized), departments: manifestDepartments }
  const archivePath = path.join(folder, 'company-backup.czbak')
  await fs.writeFile(archivePath, serialized)
  await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2))
  const backup = { id, version, createdAt: manifest.createdAt, createdBy: 'Jonathan Reeves', encryptedPath: archivePath, manifestHash: sha256(JSON.stringify(manifest)), sizeBytes: Buffer.byteLength(serialized), status: 'Ready', departments: manifestDepartments.map(({ department, files }) => ({ department, files: files.map(({ name, size }) => ({ name, size })) })) }
  await writeJson('backups.json', [backup, ...backups])
  await appendAudit('CEO', 'BACKUP_CREATED', `Version ${version} encrypted with AES-256-GCM`)
  return { backup }
}

async function appendAudit(actor, action, details) {
  const items = await readJson('audit.json', [])
  items.unshift({ id: crypto.randomUUID(), actor, action, details, createdAt: new Date().toISOString() })
  await writeJson('audit.json', items.slice(0, 250))
}

async function verifyBackup(id) {
  if (!safeId(id)) throw new Error('Invalid backup identifier')
  const backups = await readJson('backups.json', [])
  const backup = backups.find(b => b.id === id)
  if (!backup) throw new Error('Backup not found')
  const serialized = await fs.readFile(backup.encryptedPath, 'utf8')
  const manifest = JSON.parse(await fs.readFile(path.join(path.dirname(backup.encryptedPath), 'manifest.json'), 'utf8'))
  const verified = sha256(serialized) === manifest.archiveSha256 && sha256(JSON.stringify(manifest)) === backup.manifestHash
  const verifiedAt = new Date().toISOString()
  backup.status = verified ? 'Verified' : 'Failed'
  backup.lastVerifiedAt = verifiedAt
  await writeJson('backups.json', backups)
  await appendAudit('CEO', verified ? 'BACKUP_VERIFIED' : 'BACKUP_VERIFICATION_FAILED', `Version ${backup.version}`)
  return { verified, verifiedAt }
}

function recoveryPhrase() {
  const words = ['NOVA', 'ORBIT', 'LUNAR', 'EMBER', 'CIPHER', 'AURORA', 'VECTOR', 'SUMMIT', 'HARBOR', 'QUARTZ']
  const pick = () => words[crypto.randomInt(words.length)]
  return `CZ-${pick()}-${pick()}-${crypto.randomInt(1000, 9999)}`
}

async function createInvitation(input) {
  const validDepartments = Object.keys(departments)
  const validRoles = ['CTO', 'Managing Director', 'Recovery Member']
  if (!input || typeof input.name !== 'string' || input.name.trim().length < 2 || typeof input.contact !== 'string' || input.contact.trim().length < 3 || !validDepartments.includes(input.department) || !validRoles.includes(input.role) || !safeId(input.backupId)) throw new Error('Invitation details are invalid')
  const backups = await readJson('backups.json', [])
  const backup = backups.find(b => b.id === input.backupId)
  if (!backup) throw new Error('Create a backup before granting recovery access')
  const payload = JSON.parse(await fs.readFile(backup.encryptedPath, 'utf8'))
  const encryptedDepartment = payload.departments[input.department]
  const vaultKey = await fs.readFile(path.join(dataRoot, 'vault.key'))
  const dataKey = aesDecrypt(encryptedDepartment.vaultWrappedKey, vaultKey)
  const phrase = recoveryPhrase()
  const salt = crypto.randomBytes(16)
  const wrappingKey = await scrypt(phrase, salt)
  const wrappedDataKey = aesEncrypt(dataKey, wrappingKey)
  const invitation = { id: crypto.randomUUID(), name: input.name.trim(), contact: input.contact.trim(), department: input.department, role: input.role, status: 'Queued', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString(), backupId: input.backupId, photonMessageId: `queued-${Date.now()}` }
  const grants = await readJson('grants.json', [])
  grants.unshift({ id: crypto.randomUUID(), invitationId: invitation.id, backupId: backup.id, department: input.department, wrappedDataKey, salt: salt.toString('base64'), usedAt: null, revokedAt: null })
  await writeJson('grants.json', grants)
  const invitations = await readJson('invitations.json', [])
  invitations.unshift(invitation)
  await writeJson('invitations.json', invitations)
  await appendAudit('CEO', 'RECOVERY_INVITATION_CREATED', `${input.role} for ${input.department}; Photon queued; secret withheld`)
  return { invitation, recoveryPhrase: phrase, delivery: 'queued' }
}

async function recover(input) {
  if (!input || !safeId(input.invitationId) || typeof input.phrase !== 'string' || input.phrase.length > 128) throw new Error('Recovery request is invalid')
  const invitations = await readJson('invitations.json', [])
  const invitation = invitations.find(i => i.id === input.invitationId)
  if (!invitation) throw new Error('Invitation not found')
  if (new Date(invitation.expiresAt) < new Date()) throw new Error('Invitation expired')
  if (invitation.status === 'Revoked') throw new Error('Invitation revoked')
  const grants = await readJson('grants.json', [])
  const grant = grants.find(g => g.invitationId === invitation.id && !g.revokedAt)
  if (!grant) throw new Error('Recovery grant unavailable')
  try {
    const wrappingKey = await scrypt(input.phrase.trim().toUpperCase(), Buffer.from(grant.salt, 'base64'))
    const dataKey = aesDecrypt(grant.wrappedDataKey, wrappingKey)
    const backups = await readJson('backups.json', [])
    const backup = backups.find(b => b.id === grant.backupId)
    const payload = JSON.parse(await fs.readFile(backup.encryptedPath, 'utf8'))
    const archive = JSON.parse(aesDecrypt(payload.departments[grant.department], dataKey).toString('utf8'))
    invitation.status = 'Accepted'; grant.usedAt = new Date().toISOString()
    await writeJson('invitations.json', invitations); await writeJson('grants.json', grants)
    await appendAudit(invitation.name, 'DEPARTMENT_BACKUP_DECRYPTED', grant.department)
    return { invitation, files: Object.entries(archive).map(([name, content]) => ({ name, content, department: grant.department })) }
  } catch {
    await appendAudit(invitation.name, 'RECOVERY_KEY_REJECTED', invitation.department)
    throw new Error('Incorrect recovery phrase or backup authentication failed')
  }
}

function registerIpc() {
  ipcMain.handle('backup:create', createBackup)
  ipcMain.handle('backup:list', () => readJson('backups.json', []))
  ipcMain.handle('backup:verify', (_e, input) => verifyBackup(input?.id))
  ipcMain.handle('invitation:create', (_e, input) => createInvitation(input))
  ipcMain.handle('invitation:list', () => readJson('invitations.json', []))
  ipcMain.handle('recovery:decrypt', (_e, input) => recover(input))
  ipcMain.handle('runtime:info', () => ({ dataPath: dataRoot, electron: true }))
  ipcMain.handle('gemini:health', () => checkGemini())
  ipcMain.handle('gemini:analyze', async (_e, input) => {
    const result = await analyzeIncident(input)
    await appendAudit('CEO', 'GEMINI_ANALYSIS_COMPLETED', `Simulated incident evidence analyzed by ${result.model}`)
    return result
  })
  ipcMain.handle('ollama:health', (_e, input) => checkOllama(input))
  const activeChats = new Map()
  ipcMain.handle('ollama:chat', async (event, input) => {
    const requestId = String(input?.requestId)
    const controller = new AbortController()
    activeChats.set(requestId, controller)
    try {
      return await streamChat(input, delta => { if (!event.sender.isDestroyed()) event.sender.send('ollama:chat-delta', { requestId, delta }) }, controller.signal)
    } finally {
      activeChats.delete(requestId)
    }
  })
  ipcMain.handle('ollama:cancel', (_e, input) => { activeChats.get(String(input?.requestId))?.abort() })
  const whisper = createWhisper({ cacheDir: path.join(app.getPath('userData'), 'models') })
  ipcMain.handle('voice:status', () => whisper.status())
  ipcMain.handle('voice:prepare', (event) => whisper.prepare(progress => { if (!event.sender.isDestroyed()) event.sender.send('voice:progress', progress) }))
  ipcMain.handle('voice:transcribe', (_e, samples) => whisper.transcribe(samples))
}

async function createWindow() {
  const win = new BrowserWindow({ width: 1500, height: 950, minWidth: 1100, minHeight: 720, backgroundColor: '#070A12', title: 'CyberZero', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (isDev) await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(async () => {
  const trustedRenderer = (url) => url.startsWith('file://') || (isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL))
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => permission === 'media' && trustedRenderer(details?.requestingUrl || requestingOrigin || webContents?.getURL() || ''))
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => callback(permission === 'media' && trustedRenderer(details?.requestingUrl || webContents.getURL())))
  await ensureData(); registerIpc(); await createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
