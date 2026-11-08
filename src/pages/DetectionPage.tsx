import { AlertTriangle, Crosshair, DatabaseZap, MapPin, Radar, ShieldAlert, UserRound, WifiOff } from 'lucide-react'
import { FloorPlan } from '../components/FloorPlan'
import { GeminiAnalysis } from '../components/GeminiAnalysis'
import { timeline } from '../lib/demo'
import { useCyberStore } from '../store'

export function DetectionPage({ onAuthorize }: { onAuthorize: () => void }) {
  const { systemState, setSystemState, setAgentState, transferredGb, setTransferredGb, addActivity } = useCyberStore()
  const active = !['SAFE', 'ISOLATED', 'RECOVERY_SETUP', 'MONITORING'].includes(systemState)
  const isolated = systemState === 'ISOLATED' || systemState === 'RECOVERY_SETUP' || systemState === 'MONITORING'
  const simulate = () => { setSystemState('BREACH_DETECTED'); setAgentState('Critical Alert'); setTransferredGb(.1); addActivity('Operation Nightfall breach simulation started', 'critical') }
  return <div className="page detection-page">
    <header className="page-header"><div><span className="eyebrow">GUIDED INCIDENT SIMULATION</span><h1>Detection</h1><p>Trace fictional evidence across the company floor plan.</p></div>{!active && !isolated ? <button className="danger-button" onClick={simulate}><Radar/> Simulate Breach</button> : active ? <button className="danger-button" onClick={onAuthorize}><WifiOff/> Begin containment</button> : <div className="live-pill isolated"><span/>Simulation isolated</div>}</header>
    <div className="detection-layout"><section className="detection-info">
      <div className={`incident-banner ${isolated ? 'isolated' : active ? 'active' : ''}`}><div>{isolated ? <WifiOff/> : active ? <ShieldAlert/> : <Radar/>}</div><span><small>BREACH STATUS</small><strong>{isolated ? 'Contained · Recovery Mode' : active ? 'Critical · Active Exfiltration' : 'No active simulation'}</strong></span><em>{active ? '98% confidence' : isolated ? 'Transfer stopped' : 'Ready'}</em></div>
      <div className="intel-grid"><div><Crosshair/><span>Source IP<strong>203.0.113.42</strong></span></div><div><DatabaseZap/><span>Transfer rate<strong>{active ? '10 GB / min' : '0 GB / min'}</strong></span></div><div><UserRound/><span>Account used<strong>Chad Newark</strong></span></div><div><MapPin/><span>Workstation<strong>CZ-OPS-204</strong></span></div></div>
      <section className="panel timeline-panel"><div className="panel-heading"><div><span className="eyebrow">SEEDED EVENT HISTORY</span><h2>Attack timeline</h2></div><AlertTriangle className="heading-icon"/></div><div className="timeline">{timeline.map(([time, event], i) => <div key={event} className={active && i === timeline.length - 1 ? 'hot' : ''}><time>{time}</time><span/><p>{event}</p></div>)}</div></section>
      <section className="analysis-card"><span className="eyebrow">AGENT ZERO INVESTIGATION</span><p><strong>Chad Newark's credentials were used as the entry point. This does not establish that Chad initiated the attack.</strong></p><p>Current evidence indicates Level 1 and Level 2 credentials may be exposed. There is no evidence of access to Level 3, Level 4, Level 5, or executive credentials.</p></section>
      <GeminiAnalysis incident={active || isolated} transferActive={active}/>
    </section><section className="building-panel"><div className="building-header"><div><span className="eyebrow">LIVE SPATIAL TRACE</span><h2>Winstead demo office</h2></div><div className="scene-legend"><span className={isolated ? 'safe' : active ? 'threat' : ''}/>{isolated ? 'Isolated route' : active ? 'Active attack path' : 'No active incident'}</div></div><FloorPlan status={isolated ? 'isolated' : active ? 'active' : 'idle'}/><div className="building-footer"><span><small>EXTERNAL SOURCE</small><strong>203.0.113.42</strong></span><i>→</i><span><small>TARGET ROOM</small><strong>Floor 2 · Operations 2B</strong></span><i>→</i><span><small>SIMULATED TRANSFER</small><strong>{active ? transferredGb.toFixed(1) : '0.0'} GB</strong></span></div></section></div>
  </div>
}
