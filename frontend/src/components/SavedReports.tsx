import { useEffect, useState } from 'react'
import { listReports } from '../api/practiceApi'
import type { ReportSummary } from '../api/practiceApi'
import './SavedReports.css'

type ReportsState =
  | { name: 'loading' }
  | { name: 'loaded'; reports: ReportSummary[] }
  | { name: 'error'; message: string }

export function SavedReports() {
  const [state, setState] = useState<ReportsState>({ name: 'loading' })

  useEffect(() => {
    let cancelled = false
    listReports()
      .then((reports) => {
        if (!cancelled) setState({ name: 'loaded', reports })
      })
      .catch((err) => {
        if (!cancelled) setState({ name: 'error', message: toMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="saved-reports">
      <p className="saved-reports__eyebrow">Past reports</p>

      {state.name === 'loading' && <p className="saved-reports__meta">Loading…</p>}
      {state.name === 'error' && <p className="saved-reports__meta">{state.message}</p>}
      {state.name === 'loaded' && state.reports.length === 0 && (
        <p className="saved-reports__meta">Nothing saved yet — grade an answer and save it to see it here.</p>
      )}

      {state.name === 'loaded' && state.reports.length > 0 && (
        <ul className="saved-reports__list">
          {state.reports.map((report) => (
            <ReportRow key={report.id} report={report} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ReportRow({ report }: { report: ReportSummary }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <li className="report-row">
      <button className="report-row__summary" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
        <span className="report-row__score">{report.score}/10</span>
        <span className="report-row__question">{report.question}</span>
        <span className="report-row__date">{formatDate(report.created_at)}</span>
      </button>

      {expanded && (
        <div className="report-row__detail">
          <p className="report-row__label">Question</p>
          <p className="report-row__text">{report.question}</p>
          <p className="report-row__label">Your answer</p>
          <p className="report-row__text">{report.answer}</p>
          <p className="report-row__label">Feedback</p>
          <p className="report-row__text">{report.feedback}</p>
        </div>
      )}
    </li>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Could not load saved reports.'
}