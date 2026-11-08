import { Activity, ArchiveRestore, ShieldCheck, Users } from 'lucide-react'
import { AgentZero } from '../components/AgentZero'
import { RecoveryAccess } from '../components/RecoveryAccess'
import { StatusCard } from '../components/StatusCard'
import { useCyberStore } from '../store'

const relative = (iso?: string) => iso ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : 'Not created'

export function Dashboard() {
  const { systemState, backups, invitations, activities } = useCyberStore()
  const latest = backups[0]
  const breach = !['SAFE', 'ISOLATED', 'RECOVERY_SETUP', 'MONITORING'].includes(systemState)
  const status = systemState === 'SAFE' ? 'Safe' : systemState === 'ISOLATED' ? 'Isolated' : systemState === 'MONITORING' ? 'Monitoring' : 'Breach Detected'
  return <div className="page dashboard-page">
    <header className="page-header"><div><span className="eyebrow">EXECUTIVE COMMAND CENTER</span><h1>Good morning, Jonathan.</h1><p>A calm view of continuity, recovery, and the simulated company environment.</p></div><div className={`live-pill ${breach ? 'danger' : ''}`}><span/>{breach ? 'Operation Nightfall active' : 'Systems nominal'}</div></header>
    <div className="status-grid">
      <StatusCard eyebrow="System Safety" value={status} detail={breach ? 'Simulated incident requires attention' : systemState === 'ISOLATED' ? 'Simulation contained safely' : 'No active simulated incidents'} icon={<ShieldCheck/>} tone={breach ? 'red' : 'green'}/>
      <StatusCard eyebrow="Active Threats" value={breach ? '01' : '00'} detail={breach ? 'Operation Nightfall · Critical' : 'No active threats'} icon={<Activity/>} tone={breach ? 'red' : 'cyan'}/>
      <StatusCard eyebrow="Latest Backup" value={latest ? `Version ${String(latest.version).padStart(3, '0')}` : 'None yet'} detail={latest ? `${latest.status} · ${relative(latest.createdAt)}` : 'Create the first encrypted backup'} icon={<ArchiveRestore/>} tone="gold"/>
      <StatusCard eyebrow="Recovery Team" value={String(invitations.filter(i => i.status === 'Accepted').length).padStart(2, '0')} detail={`${invitations.filter(i => i.status !== 'Accepted').length} pending invitation${invitations.length === 1 ? '' : 's'}`} icon={<Users/>}/>
    </div>
    <div className="dashboard-main"><AgentZero/><section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">AUDIT TRAIL</span><h2>Recent activity</h2></div><Activity className="heading-icon"/></div><div className="activity-list">{activities.map(item => <div className={`activity-item ${item.tone ?? ''}`} key={item.id}><span className="activity-dot"/><div><p>{item.message}</p><time>{relative(item.time)}</time></div></div>)}</div></section></div>
    <RecoveryAccess compact/>
  </div>
}
