import { useEffect, useState } from 'react'
import { deleteReport, listReports } from '../api/practiceApi'
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

  // Called after a row's own delete request succeeds. Filters the report
  // out of local state directly instead of re-fetching the whole list (the
  // reportsVersion-bump pattern App.tsx uses for saves) - one row leaving
  // doesn't need a full round trip back to SQLite plus a 'Loading…' flash.
  async function handleDelete(id: number) {
    await deleteReport(id)
    setState((prev) =>
      prev.name === 'loaded' ? { name: 'loaded', reports: prev.reports.filter((r) => r.id !== id) } : prev,
    )
  }

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
            <ReportRow key={report.id} report={report} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ReportRow({
  report,
  onDelete,
}: {
  report: ReportSummary
  onDelete: (id: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  // Two-step delete: first click arms confirmation, second click actually
  // deletes. Chosen over a native confirm() popup to keep the interaction
  // inline and in the app's own style, while still guarding against an
  // accidental single click removing a saved report for good.
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleConfirmDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(report.id)
      // On success this row unmounts (the parent drops it from `reports`),
      // so there's nothing left here to reset.
    } catch (err) {
      setIsDeleting(false)
      setConfirming(false)
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this report.')
    }
  }

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

          <div className="report-row__actions">
            {!confirming ? (
              <button type="button" className="report-row__delete" onClick={() => setConfirming(true)}>
                Delete
              </button>
            ) : (
              <span className="report-row__confirm-group">
                <button
                  type="button"
                  className="report-row__delete report-row__delete--confirm"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button
                  type="button"
                  className="report-row__cancel"
                  onClick={() => setConfirming(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </span>
            )}
            {deleteError && <p className="report-row__error">{deleteError}</p>}
          </div>
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