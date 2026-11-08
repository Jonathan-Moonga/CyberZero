import { useEffect, useState } from 'react'
import { ListChecks, LoaderCircle, SearchCheck, SearchX, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { buildIncidentEvidence } from '../lib/evidence'
import { useCyberStore } from '../store'
import type { GeminiAnalysisResult, GeminiHealth, SystemState } from '../types'

const cleanError = (error: unknown) => (error instanceof Error ? error.message : 'Gemini analysis failed.').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export function GeminiAnalysis({ incident, transferActive }: { incident: boolean; transferActive: boolean }) {
  const { systemState, transferredGb, addActivity } = useCyberStore()
  const [health, setHealth] = useState<GeminiHealth | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [run, setRun] = useState<{ result: GeminiAnalysisResult; state: SystemState } | null>(null)

  useEffect(() => { void api().checkGemini().then(setHealth) }, [])

  const analyze = async () => {
    setLoading(true); setError('')
    try {
      const [backups, invitations] = await Promise.all([api().listBackups(), api().listInvitations()])
      const result = await api().analyzeIncident(buildIncidentEvidence({ systemState, transferredGb, transferActive, backups, invitations }))
      setRun({ result, state: systemState })
      addActivity(`Gemini flagged ${result.analysis.gaps.length} evidence gaps`, 'warning')
    } catch (e) {
      setError(cleanError(e))
    } finally {
      setLoading(false)
    }
  }

  const shown = incident ? run : null
  const analysis = shown?.result.analysis
  return <section className="gemini-card">
    <div className="panel-heading"><div><span className="eyebrow">GOOGLE GEMINI ANALYSIS</span><h2>What's missing from this picture</h2></div><Sparkles className="heading-icon"/></div>
    {health && !health.available && <div className="setting-detail">{health.detail}</div>}
    {health?.available && !incident && <div className="setting-detail">Start the breach simulation to give Gemini evidence to analyze.</div>}
    {error && <div className="gemini-error" role="alert">{error}</div>}
    {health?.available && incident && <button className="secondary-button gemini-run" onClick={() => void analyze()} disabled={loading}>{loading ? <LoaderCircle className="gemini-spin"/> : <Sparkles/>}{loading ? 'Analyzing evidence…' : shown ? 'Run analysis again' : 'Analyze with Gemini'}</button>}
    {shown && analysis && <div className="gemini-result" aria-live="polite">
      <div className="gemini-summary"><span className={`gemini-severity ${analysis.severity.toLowerCase()}`}>{analysis.severity}</span><small>{analysis.confidence} confidence</small></div>
      <p>{analysis.assessment}</p>
      <h3><SearchX/> Missing evidence</h3>
      {analysis.gaps.length === 0 && <p className="gemini-empty">Gemini did not identify any evidence gaps.</p>}
      <ul className="gemini-list">{analysis.gaps.map(gap => <li key={gap.missing}><strong>{gap.missing}</strong><em>{gap.where}</em><span>{gap.whyItMatters}</span><span className="gemini-next">{gap.howToClose}</span></li>)}</ul>
      <h3><SearchCheck/> Findings</h3>
      <ul className="gemini-list">{analysis.findings.map(finding => <li key={finding.title}><strong>{finding.title}</strong><em>{finding.severity}</em><span>{finding.detail}</span><span className="gemini-next">Evidence: {finding.evidence}</span></li>)}</ul>
      <h3><ListChecks/> Recommended actions</h3>
      <ol className="gemini-actions">{analysis.actions.map(action => <li key={action}>{action}</li>)}</ol>
      <footer>AI-generated from simulated evidence · {shown.result.model} · {new Date(shown.result.analyzedAt).toLocaleTimeString()}{shown.state !== systemState ? ' · Incident state changed, run again for current evidence' : ''}</footer>
    </div>}
  </section>
}
