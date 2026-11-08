import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './components/Sidebar'
import { ZeroDayOverlay } from './components/ZeroDayOverlay'
import { Dashboard } from './pages/Dashboard'
import { BackupPage } from './pages/BackupPage'
import { DetectionPage } from './pages/DetectionPage'
import { SettingsPage } from './pages/SettingsPage'
import { useCyberStore } from './store'
import { api } from './lib/api'

export function App() {
  const page = useCyberStore(s => s.page)
  const systemState = useCyberStore(s => s.systemState)
  const setBackups = useCyberStore(s => s.setBackups)
  const setInvitations = useCyberStore(s => s.setInvitations)
  const setTransferredGb = useCyberStore(s => s.setTransferredGb)
  const [operationOpen, setOperationOpen] = useState(false)

  useEffect(() => { void Promise.all([api().listBackups().then(setBackups), api().listInvitations().then(setInvitations)]) }, [setBackups, setInvitations])
  useEffect(() => {
    if (systemState !== 'BREACH_DETECTED' && systemState !== 'AWAITING_CEO_AUTHORIZATION' && systemState !== 'TRACING') return
    const id = window.setInterval(() => setTransferredGb(useCyberStore.getState().transferredGb + 0.17), 1000)
    return () => window.clearInterval(id)
  }, [systemState, setTransferredGb])

  useEffect(() => {
    const open = () => setOperationOpen(true)
    window.addEventListener('cyberzero:authorize', open)
    return () => window.removeEventListener('cyberzero:authorize', open)
  }, [])

  const Current = page === 'backup' ? BackupPage : page === 'detection' ? DetectionPage : SettingsPage
  const danger = ['BREACH_DETECTED', 'AWAITING_CEO_AUTHORIZATION', 'ISOLATING', 'TRACING'].includes(systemState)
  return (
    <div className={`app-shell ${danger ? 'breach-active' : ''}`}>
      <Sidebar />
      <main className="main-area">
        <div className="simulation-banner"><span>SIMULATION</span> Fictional company data · Safe demo isolation · No physical network changes</div>
        <div className="page-motion" hidden={page !== 'dashboard'}><Dashboard /></div>
        <AnimatePresence mode="wait">
          {page !== 'dashboard' && <motion.div key={page} className="page-motion" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}>
            <Current onAuthorize={() => setOperationOpen(true)} />
          </motion.div>}
        </AnimatePresence>
      </main>
      <ZeroDayOverlay open={operationOpen} onClose={() => setOperationOpen(false)} />
    </div>
  )
}
