import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LockKeyhole, Rocket, X } from 'lucide-react'
import { useCyberStore } from '../store'

const steps = ['Revoking active sessions', 'Isolating endpoints', 'Blocking simulated exfiltration', 'Securing backup vault', 'Entering recovery mode']

export function ZeroDayOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'confirm' | 'running' | 'done'>('confirm')
  const [step, setStep] = useState(0)
  const { setSystemState, setAgentState, setTransferredGb, addActivity, addMessage } = useCyberStore()
  const authorizeRef = useRef<(override?: string) => void>(() => undefined)
  const close = () => { setStage('confirm'); setCode(''); setError(''); setStep(0); onClose() }
  const authorize = (override?: string) => {
    const submittedCode = override ?? code
    if (submittedCode.trim().toUpperCase() !== '4256UTD') { setError('Override code incorrect. No simulation state was changed.'); return }
    setError(''); setStage('running'); setSystemState('ISOLATING'); setAgentState('Executing Simulation'); addActivity('Zero-Day Operation authorized by CEO', 'warning')
    let current = 0
    const id = window.setInterval(() => { current += 1; setStep(current); if (current >= steps.length) { window.clearInterval(id); setTransferredGb(0); setSystemState('ISOLATED'); setAgentState('Recovery Mode'); setStage('done'); addActivity('Simulated endpoints isolated; outbound transfer stopped', 'success'); const completion = 'Operation complete. All simulated endpoints are isolated, outbound transfer has stopped, and the backup vault remains secure. Would you like to trace the breach or set up recovery access?'; addMessage({ id: crypto.randomUUID(), role: 'assistant', content: completion, source: 'SCRIPTED_DEMO', createdAt: new Date().toISOString() }); window.dispatchEvent(new CustomEvent('cyberzero:agent-announce', { detail: { content: completion } })) } }, 800)
  }
  useEffect(() => { authorizeRef.current = authorize })
  useEffect(() => {
    const acceptVoiceCode = (event: Event) => {
      const voiceCode = (event as CustomEvent<{ code?: string }>).detail?.code
      if (!voiceCode) return
      setCode(voiceCode)
      authorizeRef.current(voiceCode)
    }
    window.addEventListener('cyberzero:voice-code', acceptVoiceCode)
    return () => window.removeEventListener('cyberzero:voice-code', acceptVoiceCode)
  }, [])
  return <AnimatePresence>{open && <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    {stage === 'confirm' && <motion.div className="authorization-card" initial={{ scale: .96, y: 20 }} animate={{ scale: 1, y: 0 }}><button className="icon-button overlay-close" onClick={close}><X/></button><div className="warning-icon"><LockKeyhole/></div><span className="eyebrow red">CEO AUTHORIZATION REQUIRED</span><h2>Initiate Zero-Day Operation?</h2><p>This operation will isolate every endpoint in the simulated company network, stop the simulated transfer, and enter recovery mode.</p><div className="safety-notice"><strong>Demo isolation mode</strong><br/>This changes the CyberZero simulation and does not alter the physical network, router, Wi-Fi, or other devices.</div><label>Fictional override code<input autoFocus value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && authorize()} placeholder="Enter override code"/></label><small>Four, two, five, six. U as in University. T as in Texas. D as in Dallas.</small>{error && <div className="inline-error">{error}</div>}<div className="modal-actions"><button className="secondary-button" onClick={close}>Cancel</button><button className="danger-button" onClick={() => authorize()}>Authorize simulation</button></div></motion.div>}
    {stage === 'running' && <div className="operation-progress"><motion.div animate={{ y: [30, -38, 30], rotate: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 1.3 }}><Rocket size={82}/></motion.div><span className="eyebrow red">ZERO-DAY OPERATION</span><h2>Isolating simulated environment</h2><div className="operation-steps">{steps.map((label, i) => <div key={label} className={i < step ? 'complete' : i === step ? 'active' : ''}><span>{i < step ? <Check size={14}/> : i + 1}</span>{label}</div>)}</div></div>}
    {stage === 'done' && <motion.div className="operation-progress" initial={{ scale: .9 }} animate={{ scale: 1 }}><div className="success-ring"><Check size={52}/></div><span className="eyebrow green">OPERATION COMPLETE</span><h2>Recovery mode is ready</h2><p>All simulated endpoints are isolated. Outbound transfer stopped at 0 GB/min and the backup vault remains secure.</p><button className="primary-button" onClick={close}>Return to command center</button></motion.div>}
  </motion.div>}</AnimatePresence>
}
