import type { ReactNode } from 'react'

export function StatusCard({ eyebrow, value, detail, icon, tone = 'cyan' }: { eyebrow: string; value: ReactNode; detail: string; icon: ReactNode; tone?: 'cyan' | 'red' | 'green' | 'gold' }) {
  return <article className={`status-card ${tone}`}><div className="status-card-top"><span>{eyebrow}</span><div className="status-icon">{icon}</div></div><div className="status-value">{value}</div><p>{detail}</p></article>
}
