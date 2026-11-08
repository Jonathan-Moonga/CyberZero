import { ArchiveRestore, ChevronsLeft, ChevronsRight, LayoutDashboard, Radar, Settings, ShieldCheck } from 'lucide-react'
import { useCyberStore } from '../store'
import type { Page } from '../types'

const links: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'backup', label: 'File Backup', icon: ArchiveRestore },
  { page: 'detection', label: 'Detection', icon: Radar },
  { page: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const collapsed = useCyberStore(s => s.sidebarCollapsed)
  const toggle = useCyberStore(s => s.toggleSidebar)
  const page = useCyberStore(s => s.page)
  const setPage = useCyberStore(s => s.setPage)
  const profile = useCyberStore(s => s.profile)
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="brand"><div className="brand-mark"><ShieldCheck size={23}/></div>{!collapsed && <div><strong>CyberZero</strong><small>cyberzero.day</small></div>}</div>
    <button className="collapse-button" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronsRight/> : <ChevronsLeft/>}</button>
    <nav aria-label="Primary navigation">{links.map(({ page: target, label, icon: Icon }) => <button key={target} className={`nav-link ${page === target ? 'active' : ''}`} onClick={() => setPage(target)} title={collapsed ? label : undefined}><Icon size={20}/>{!collapsed && <span>{label}</span>}</button>)}</nav>
    <div className="profile" title={collapsed ? profile : undefined}><div className="avatar">{profile === 'CEO' ? 'JR' : 'OD'}</div>{!collapsed && <div><strong>{profile === 'CEO' ? 'Jonathan Reeves' : 'Operations Director'}</strong><small>{profile} · Demo profile</small></div>}</div>
  </aside>
}
