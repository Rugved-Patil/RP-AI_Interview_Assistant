import { useEffect, useState } from 'react'
import {
  deleteInterviewReport,
  deleteReport,
  listInterviewReports,
  listReports,
} from '../api/practiceApi'
import type { ReportSummary, SavedInterviewReportSummary } from '../api/practiceApi'
import './SavedReports.css'

type TabType = 'mock' | 'single'

interface AllReportsState {
  status: 'loading' | 'loaded' | 'error'
  singleReports: ReportSummary[]
  mockReports: SavedInterviewReportSummary[]
  errorMessage: string | null
}

export function SavedReports() {
  const [activeTab, setActiveTab] = useState<TabType>('mock')
  const [state, setState] = useState<AllReportsState>({
    status: 'loading',
    singleReports: [],
    mockReports: [],
    errorMessage: null,
  })

  useEffect(() => {
    let cancelled = false
    Promise.all([listReports(), listInterviewReports()])
      .then(([singleReports, mockReports]) => {
        if (!cancelled) {
          setState({
            status: 'loaded',
            singleReports,
            mockReports,
            errorMessage: null,
          })
          if (mockReports.length === 0 && singleReports.length > 0) {
            setActiveTab('single')
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            singleReports: [],
            mockReports: [],
            errorMessage: toMessage(err),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDeleteSingle(id: number) {
    await deleteReport(id)
    setState((prev) => ({
      ...prev,
      singleReports: prev.singleReports.filter((r) => r.id !== id),
    }))
  }

  async function handleDeleteMock(id: number) {
    await deleteInterviewReport(id)
    setState((prev) => ({
      ...prev,
      mockReports: prev.mockReports.filter((r) => r.id !== id),
    }))
  }

  return (
    <section className="saved-reports">
      <div className="saved-reports__header">
        <p className="saved-reports__eyebrow">Past reports</p>
        <div className="saved-reports__tabs">
          <button
            type="button"
            className={`saved-reports__tab ${
              activeTab === 'mock' ? 'saved-reports__tab--active' : ''
            }`}
            onClick={() => setActiveTab('mock')}
          >
            Mock Interviews ({state.mockReports.length})
          </button>
          <button
            type="button"
            className={`saved-reports__tab ${
              activeTab === 'single' ? 'saved-reports__tab--active' : ''
            }`}
            onClick={() => setActiveTab('single')}
          >
            Single Questions ({state.singleReports.length})
          </button>
        </div>
      </div>

      {state.status === 'loading' && <p className="saved-reports__meta">Loading saved reports…</p>}
      {state.status === 'error' && <p className="saved-reports__meta">{state.errorMessage}</p>}

      {state.status === 'loaded' && activeTab === 'mock' && (
        <>
          {state.mockReports.length === 0 ? (
            <p className="saved-reports__meta">
              No saved mock interviews yet. Complete a full mock interview and save its report to view it here.
            </p>
          ) : (
            <ul className="saved-reports__list">
              {state.mockReports.map((report) => (
                <MockReportRow
                  key={report.id}
                  report={report}
                  onDelete={handleDeleteMock}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {state.status === 'loaded' && activeTab === 'single' && (
        <>
          {state.singleReports.length === 0 ? (
            <p className="saved-reports__meta">
              No saved single questions yet. Complete a practice question and save its report to view it here.
            </p>
          ) : (
            <ul className="saved-reports__list">
              {state.singleReports.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  onDelete={handleDeleteSingle}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function MockReportRow({
  report,
  onDelete,
}: {
  report: SavedInterviewReportSummary
  onDelete: (id: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const context = formatContext({
    role: report.role,
    company: report.company,
    location: report.location,
  })

  async function handleConfirmDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(report.id)
    } catch (err) {
      setIsDeleting(false)
      setConfirming(false)
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this report.')
    }
  }

  return (
    <li className="report-row">
      <button
        type="button"
        className="report-row__summary"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="report-row__score">{report.score}/10</span>
        <span className="report-row__title">
          <span className="report-row__badge">
            {report.interview_type === 'hr' ? 'HR / Behavioral' : 'Technical'} • {report.experience_level.toUpperCase()}
          </span>
          <span className="report-row__role">{report.role}</span>
        </span>
        <span className="report-row__date">{formatDate(report.created_at)}</span>
      </button>

      {expanded && (
        <div className="report-row__detail">
          {context && (
            <div className="report-row__section">
              <p className="report-row__label">Target Role & Context</p>
              <p className="report-row__text">{context}</p>
            </div>
          )}

          <div className="report-row__section">
            <p className="report-row__label">Holistic Feedback & Evaluation</p>
            <p className="report-row__text">{report.feedback}</p>
          </div>

          <div className="report-row__section">
            <p className="report-row__label">
              Full Conversation Transcript ({report.transcript.length} turns)
            </p>
            <div className="report-row__transcript">
              {report.transcript.map((t, idx) => (
                <div
                  key={idx}
                  className={`report-row__turn report-row__turn--${t.role}`}
                >
                  <div className="report-row__turn-sender">
                    {t.role === 'interviewer' ? 'AI Interviewer' : 'You'}
                  </div>
                  <div className="report-row__turn-content">{t.content}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="report-row__actions">
            {!confirming ? (
              <button
                type="button"
                className="report-row__delete"
                onClick={() => setConfirming(true)}
              >
                Delete report
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

function ReportRow({
  report,
  onDelete,
}: {
  report: ReportSummary
  onDelete: (id: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const context = formatContext(report)

  async function handleConfirmDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(report.id)
    } catch (err) {
      setIsDeleting(false)
      setConfirming(false)
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this report.')
    }
  }

  return (
    <li className="report-row">
      <button
        type="button"
        className="report-row__summary"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="report-row__score">{report.score}/10</span>
        <span className="report-row__title">
          {report.role && <span className="report-row__role">{report.role} — </span>}
          <span className="report-row__question">{report.question}</span>
        </span>
        <span className="report-row__date">{formatDate(report.created_at)}</span>
      </button>

      {expanded && (
        <div className="report-row__detail">
          {context && (
            <div className="report-row__section">
              <p className="report-row__label">Target Role & Context</p>
              <p className="report-row__text">{context}</p>
            </div>
          )}

          <div className="report-row__section">
            <p className="report-row__label">Question & Answer Transcript</p>
            <div className="report-row__transcript">
              <div className="report-row__turn report-row__turn--interviewer">
                <div className="report-row__turn-sender">Interviewer Question</div>
                <div className="report-row__turn-content">{report.question}</div>
              </div>
              <div className="report-row__turn report-row__turn--candidate">
                <div className="report-row__turn-sender">Your Answer</div>
                <div className="report-row__turn-content">{report.answer}</div>
              </div>
            </div>
          </div>

          <div className="report-row__section">
            <p className="report-row__label">Feedback & Evaluation</p>
            <p className="report-row__text">{report.feedback}</p>
          </div>

          <div className="report-row__actions">
            {!confirming ? (
              <button
                type="button"
                className="report-row__delete"
                onClick={() => setConfirming(true)}
              >
                Delete report
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

function formatContext(item: {
  role?: string | null
  company?: string | null
  location?: string | null
}): string {
  return [item.role, item.company, item.location].filter(Boolean).join(' · ')
}

function formatDate(iso: string): string {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Could not load saved reports.'
}