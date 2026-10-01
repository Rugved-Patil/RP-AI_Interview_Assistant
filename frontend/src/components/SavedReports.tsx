import { useEffect, useMemo, useState } from 'react'
import {
  deleteInterviewReport,
  deleteReport,
  listInterviewReports,
  listReports,
} from '../api/practiceApi'
import type { ReportSummary, SavedInterviewReportSummary } from '../api/practiceApi'
import { FilterIcon } from './Icons'
import { FormattedFeedback } from './FormattedFeedback'
import './SavedReports.css'

export type UnifiedReport =
  | { kind: 'mock'; id: number; data: SavedInterviewReportSummary; createdAt: string }
  | { kind: 'single'; id: number; data: ReportSummary; createdAt: string }

interface AllReportsState {
  status: 'loading' | 'loaded' | 'error'
  singleReports: ReportSummary[]
  mockReports: SavedInterviewReportSummary[]
  errorMessage: string | null
}

export function SavedReports() {
  const [state, setState] = useState<AllReportsState>({
    status: 'loading',
    singleReports: [],
    mockReports: [],
    errorMessage: null,
  })

  // Filter drawer state
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'mock' | 'single'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [scoreFilter, setScoreFilter] = useState<string>('all')

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

  // Combine and sort all reports chronologically
  const unifiedReports: UnifiedReport[] = useMemo(() => {
    const list: UnifiedReport[] = []
    for (const m of state.mockReports) {
      list.push({ kind: 'mock', id: m.id, data: m, createdAt: m.created_at })
    }
    for (const s of state.singleReports) {
      list.push({ kind: 'single', id: s.id, data: s, createdAt: s.created_at })
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return list
  }, [state.mockReports, state.singleReports])

  // Filter and prioritize combined reports
  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    type ScoredItem = { item: UnifiedReport; tier: number }
    const scoredList: ScoredItem[] = []

    for (const item of unifiedReports) {
      // 1. Type filter
      if (typeFilter !== 'all' && item.kind !== typeFilter) {
        continue
      }

      // 2. Score filter (0 - 10)
      if (scoreFilter !== 'all') {
        const targetScore = parseInt(scoreFilter, 10)
        if (Math.round(item.data.score) !== targetScore) {
          continue
        }
      }

      // 3. Search query filter with prioritization:
      // Tier 1 (High priority): Role, Company, Location, or Score exact match
      // Tier 2 (Secondary priority): Feedback, Questions, Answers, Transcripts
      if (q) {
        const role = (item.data.role || '').toLowerCase()
        const comp = (item.data.company || '').toLowerCase()
        const loc = (item.data.location || '').toLowerCase()
        const scoreStr = item.data.score.toString()
        const scoreFraction = `${item.data.score}/10`

        const isTier1 =
          role.includes(q) ||
          comp.includes(q) ||
          loc.includes(q) ||
          scoreStr === q ||
          scoreFraction.includes(q)

        if (isTier1) {
          scoredList.push({ item, tier: 1 })
          continue
        }

        const feedback = (item.data.feedback || '').toLowerCase()
        let isTier2 = feedback.includes(q)

        if (!isTier2 && item.kind === 'single') {
          const question = (item.data.question || '').toLowerCase()
          const answer = (item.data.answer || '').toLowerCase()
          isTier2 = question.includes(q) || answer.includes(q)
        }

        if (!isTier2 && item.kind === 'mock') {
          isTier2 = item.data.transcript.some((t) =>
            t.content.toLowerCase().includes(q),
          )
        }

        if (isTier2) {
          scoredList.push({ item, tier: 2 })
          continue
        }

        // Matched neither tier
        continue
      }

      // If no query, all items have default tier 1
      scoredList.push({ item, tier: 1 })
    }

    // Sort: Tier 1 matches first, then Tier 2; within each tier, keep newest date first
    scoredList.sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier
      }
      return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime()
    })

    return scoredList.map((entry) => entry.item)
  }, [unifiedReports, typeFilter, scoreFilter, searchQuery])

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (scoreFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() !== '' ? 1 : 0)

  const handleResetFilters = () => {
    setTypeFilter('all')
    setSearchQuery('')
    setScoreFilter('all')
  }

  return (
    <section className="saved-reports">
      <div className="saved-reports__header">
        <div>
          <p className="saved-reports__eyebrow">Practice History &amp; Reports</p>
          <h2 className="saved-reports__heading">Saved Interview Reports</h2>
        </div>

        <button
          type="button"
          className={`saved-reports__filter-btn ${
            isFilterOpen || activeFilterCount > 0 ? 'saved-reports__filter-btn--active' : ''
          }`}
          onClick={() => setIsFilterOpen((prev) => !prev)}
          aria-expanded={isFilterOpen}
          aria-label="Toggle Filters"
          title={isFilterOpen ? 'Close filters' : 'Open filters'}
        >
          <FilterIcon width={17} height={17} />
          {activeFilterCount > 0 && (
            <span className="saved-reports__filter-badge">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Expandable Filter Drawer */}
      {isFilterOpen && (
        <div className="saved-reports__filter-drawer">
          <div className="filter-drawer__row">
            <div className="filter-drawer__group filter-drawer__group--search">
              <label htmlFor="report-search" className="filter-drawer__label">Search</label>
              <input
                id="report-search"
                type="text"
                className="filter-drawer__input"
                placeholder="Search by role, company, score, keyword…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-drawer__group">
              <label htmlFor="report-type-select" className="filter-drawer__label">Report Type</label>
              <select
                id="report-type-select"
                className="filter-drawer__select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'mock' | 'single')}
              >
                <option value="all">All Records ({unifiedReports.length})</option>
                <option value="mock">Full Mocks ({state.mockReports.length})</option>
                <option value="single">Single Drills ({state.singleReports.length})</option>
              </select>
            </div>

            <div className="filter-drawer__group">
              <label htmlFor="report-score-select" className="filter-drawer__label">Score</label>
              <select
                id="report-score-select"
                className="filter-drawer__select"
                value={scoreFilter}
                onChange={(e) => setScoreFilter(e.target.value)}
              >
                <option value="all">All Scores</option>
                <option value="10">10 / 10</option>
                <option value="9">9 / 10</option>
                <option value="8">8 / 10</option>
                <option value="7">7 / 10</option>
                <option value="6">6 / 10</option>
                <option value="5">5 / 10</option>
                <option value="4">4 / 10</option>
                <option value="3">3 / 10</option>
                <option value="2">2 / 10</option>
                <option value="1">1 / 10</option>
                <option value="0">0 / 10</option>
              </select>
            </div>
          </div>

          <div className="filter-drawer__footer">
            <span className="filter-drawer__count">
              Showing {filteredReports.length} of {unifiedReports.length} reports
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="filter-drawer__reset-btn"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {state.status === 'loading' && <p className="saved-reports__meta">Loading saved reports…</p>}
      {state.status === 'error' && <p className="saved-reports__meta">{state.errorMessage}</p>}

      {state.status === 'loaded' && (
        <>
          {filteredReports.length === 0 ? (
            <div className="saved-reports__empty">
              {unifiedReports.length === 0 ? (
                <p className="saved-reports__meta">
                  No saved reports yet. Complete a practice drill or mock interview and click &quot;Save this report&quot; to archive it here.
                </p>
              ) : (
                <p className="saved-reports__meta">
                  No reports matched your active filter criteria.{' '}
                  <button
                    type="button"
                    className="saved-reports__link-btn"
                    onClick={handleResetFilters}
                  >
                    Clear filters
                  </button>
                </p>
              )}
            </div>
          ) : (
            <ul className="saved-reports__list">
              {filteredReports.map((item) =>
                item.kind === 'mock' ? (
                  <MockReportRow
                    key={`mock-${item.id}`}
                    report={item.data}
                    onDelete={handleDeleteMock}
                  />
                ) : (
                  <ReportRow
                    key={`single-${item.id}`}
                    report={item.data}
                    onDelete={handleDeleteSingle}
                  />
                ),
              )}
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

  const roleText = report.role || 'Mock Interview'
  const companyText = report.company ? ` · ${report.company}` : ''

  return (
    <li className={`report-row ${expanded ? 'report-row--expanded' : ''}`}>
      <button
        type="button"
        className="report-row__summary"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="report-row__score">{report.score}/10</span>
        <span className="report-row__badge report-row__badge--mock">Mock Interview</span>
        <span className="report-row__primary-info" title={`${roleText}${companyText}`}>
          <span className="report-row__role">{roleText}</span>
          {report.company && <span className="report-row__company">{companyText}</span>}
        </span>
        <span className="report-row__date">{formatDate(report.created_at)}</span>
        <span className={`report-row__chevron ${expanded ? 'report-row__chevron--open' : ''}`}>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="report-row__detail">
          <div className="report-row__tags-row">
            <span className="report-row__subbadge">
              Track: {report.interview_type === 'hr' ? 'HR / Behavioral' : 'Technical'}
            </span>
            <span className="report-row__subbadge">
              Level: {report.experience_level.toUpperCase()}
            </span>
            {context && <span className="report-row__context-text">{context}</span>}
          </div>

          <div className="report-row__section">
            <p className="report-row__label">Diagnostic Feedback &amp; Assessment</p>
            <FormattedFeedback content={report.feedback} className="report-row__text" />
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
                    {t.role === 'interviewer' ? 'AI Interviewer' : 'You (Candidate)'}
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
    <li className={`report-row ${expanded ? 'report-row--expanded' : ''}`}>
      <button
        type="button"
        className="report-row__summary"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="report-row__score">{report.score}/10</span>
        <span className="report-row__badge report-row__badge--single">Single Drill</span>
        <span
          className="report-row__primary-info"
          title={report.role ? `${report.role} · ${report.question}` : report.question}
        >
          {report.role ? (
            <>
              <span className="report-row__role">{report.role}</span>
              <span className="report-row__company"> · {report.question}</span>
            </>
          ) : (
            <span className="report-row__role">{report.question}</span>
          )}
        </span>
        <span className="report-row__date">{formatDate(report.created_at)}</span>
        <span className={`report-row__chevron ${expanded ? 'report-row__chevron--open' : ''}`}>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="report-row__detail">
          {context && (
            <div className="report-row__section">
              <p className="report-row__label">Target Role &amp; Context</p>
              <p className="report-row__text">{context}</p>
            </div>
          )}

          <div className="report-row__section">
            <p className="report-row__label">Question &amp; Candidate Response</p>
            <div className="report-row__transcript">
              <div className="report-row__turn report-row__turn--interviewer">
                <div className="report-row__turn-sender">Drill Question</div>
                <div className="report-row__turn-content">{report.question}</div>
              </div>
              <div className="report-row__turn report-row__turn--candidate">
                <div className="report-row__turn-sender">Your Response</div>
                <div className="report-row__turn-content">{report.answer}</div>
              </div>
            </div>
          </div>

          <div className="report-row__section">
            <p className="report-row__label">Feedback &amp; Evaluation</p>
            <FormattedFeedback content={report.feedback} className="report-row__text" />
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
  if (isNaN(date.getTime())) return ''
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