import { useState } from 'react'
import { KeyRound, Send, X } from 'lucide-react'
import { api } from '../lib/api'
import { DEPARTMENTS } from '../lib/demo'
import { useCyberStore } from '../store'
import type { Department, UserRole } from '../types'

export function RecoveryAccess({ compact = false }: { compact?: boolean }) {
  const backups = useCyberStore(s => s.backups)
  const invitations = useCyberStore(s => s.invitations)
  const setInvitations = useCyberStore(s => s.setInvitations)
  const addActivity = useCyberStore(s => s.addActivity)
  const [form, setForm] = useState<{ name: string; contact: string; department: Department; role: UserRole }>({ name: 'Olivia Torres', contact: 'olivia.torres@example.invalid', department: 'Operations', role: 'Managing Director' })
  const [busy, setBusy] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState('')
  const invite = async () => {
    if (!backups[0]) { setError('Create a backup before inviting a recovery leader.'); return }
    setBusy(true); setError('')
    try { const result = await api().createInvitation({ ...form, backupId: backups[0].id }); setInvitations([result.invitation, ...invitations]); setPhrase(result.recoveryPhrase); addActivity(`Recovery invitation queued for ${form.name} — ${form.department}`, 'success') } catch (e) { setError(e instanceof Error ? e.message : 'Invitation failed') } finally { setBusy(false) }
  }
  return <section className={`panel recovery-access ${compact ? 'compact' : ''}`}>
    <div className="panel-heading"><div><span className="eyebrow">Controlled access</span><h2>Recovery Access</h2></div><KeyRound className="heading-icon"/></div>
    <div className="form-grid">
      <label>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
      <label>Contact<input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })}/></label>
      <label>Department<select value={form.department} onChange={e => setForm({ ...form, department: e.target.value as Department })}>{DEPARTMENTS.map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}><option>Managing Director</option><option>CTO</option><option>Recovery Member</option></select></label>
    </div>
    {error && <div className="inline-error">{error}</div>}
    <div className="form-footer"><p>Photon sends the invitation only. The recovery phrase is never included.</p><button className="primary-button" disabled={busy} onClick={invite}><Send size={16}/>{busy ? 'Sending…' : 'Send invitation'}</button></div>
    {phrase && <div className="key-reveal" role="dialog" aria-label="One-time recovery phrase"><button className="icon-button close" onClick={() => setPhrase('')}><X size={16}/></button><span>ONE-TIME RECOVERY PHRASE</span><strong>{phrase}</strong><p>Shown only to the CEO. Copy or provide verbally, then close this card.</p><button className="secondary-button" onClick={() => navigator.clipboard.writeText(phrase)}>Copy phrase</button></div>}
  </section>
}
