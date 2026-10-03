import { useEffect, useMemo, useState } from 'react'
import {
  deleteInterviewReport,
  deleteReport,
  listInterviewReports,
  listReports,
} from '../api/practiceApi'
import type { ReportSummary, SavedInterviewReportSummary } from '../api/practiceApi'
import { CheckIcon, FilterIcon, PdfIcon, SavedReportsIcon, ShareIcon } from './Icons'
import { FormattedFeedback } from './FormattedFeedback'
import { useTranslation } from '../i18n/LanguageContext'
import {
  copyShareableSummary,
  exportAllReportsToPDF,
  exportMockInterviewReportToPDF,
  exportSingleReportToPDF,
} from '../pdfExport'
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
  const { t } = useTranslation()
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
        <div className="page-title-row">
          <div className="page-title-icon page-title-icon--reports">
            <SavedReportsIcon width={24} height={24} />
          </div>
          <div>
            <h1 className="page-title">{t('reports.heading', undefined, 'Saved Interview Reports')}</h1>
            <p className="page-subtitle">{t('reports.eyebrow', undefined, 'Practice History & Reports')}</p>
          </div>
        </div>

        <div className="saved-reports__header-actions">
          {unifiedReports.length > 0 && (
            <button
              type="button"
              className="saved-reports__export-all-btn"
              onClick={() => exportAllReportsToPDF(state.singleReports, state.mockReports)}
              title={t('reports.export_all_pdf_tooltip', undefined, 'Download complete portfolio PDF of all saved assessments')}
            >
              <PdfIcon width={15} height={15} />
              <span>{t('settings.export_pdf_btn', undefined, 'Export All (PDF)')}</span>
            </button>
          )}

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
      </div>

      {/* Expandable Filter Drawer */}
      {isFilterOpen && (
        <div className="saved-reports__filter-drawer">
          <div className="filter-drawer__row">
            <div className="filter-drawer__group filter-drawer__group--search">
              <label htmlFor="report-search" className="filter-drawer__label">{t('reports.search_label', undefined, 'Search')}</label>
              <input
                id="report-search"
                type="text"
                className="filter-drawer__input"
                placeholder={t('reports.search_placeholder', undefined, 'Search by role, company, score, keyword…')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-drawer__group">
              <label htmlFor="report-type-select" className="filter-drawer__label">{t('reports.type_label', undefined, 'Report Type')}</label>
              <select
                id="report-type-select"
                className="filter-drawer__select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'mock' | 'single')}
              >
                <option value="all">{t('reports.type_all', { count: unifiedReports.length }, `All Records (${unifiedReports.length})`)}</option>
                <option value="mock">{t('reports.type_mock', { count: state.mockReports.length }, `Full Mocks (${state.mockReports.length})`)}</option>
                <option value="single">{t('reports.type_single', { count: state.singleReports.length }, `Single Drills (${state.singleReports.length})`)}</option>
              </select>
            </div>

            <div className="filter-drawer__group">
              <label htmlFor="report-score-select" className="filter-drawer__label">{t('reports.score_label', undefined, 'Score')}</label>
              <select
                id="report-score-select"
                className="filter-drawer__select"
                value={scoreFilter}
                onChange={(e) => setScoreFilter(e.target.value)}
              >
                <option value="all">{t('reports.score_all', undefined, 'All Scores')}</option>
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
              {t('reports.showing_count', { filtered: filteredReports.length, total: unifiedReports.length }, `Showing ${filteredReports.length} of ${unifiedReports.length} reports`)}
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="filter-drawer__reset-btn"
                onClick={handleResetFilters}
              >
                {t('reports.reset_filters', undefined, 'Reset Filters')}
              </button>
            )}
          </div>
        </div>
      )}

      {state.status === 'loading' && <p className="saved-reports__meta">{t('reports.loading', undefined, 'Loading saved reports…')}</p>}
      {state.status === 'error' && <p className="saved-reports__meta">{state.errorMessage}</p>}

      {state.status === 'loaded' && (
        <>
          {filteredReports.length === 0 ? (
            <div className="saved-reports__empty">
              {unifiedReports.length === 0 ? (
                <p className="saved-reports__meta">
                  {t('reports.empty_no_saved', undefined, 'No saved reports yet. Complete a practice drill or mock interview and click "Save this report" to archive it here.')}
                </p>
              ) : (
                <p className="saved-reports__meta">
                  {t('reports.empty_no_match', undefined, 'No reports matched your active filter criteria.')}{' '}
                  <button
                    type="button"
                    className="saved-reports__link-btn"
                    onClick={handleResetFilters}
                  >
                    {t('reports.clear_filters', undefined, 'Clear filters')}
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
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const context = formatContext({
    role: report.role,
    company: report.company,
    location: report.location,
  })

  async function handleShare() {
    const success = await copyShareableSummary(report)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }

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

  const roleText = report.role || t('reports.mock_badge', undefined, 'Mock Interview')
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
        <span className="report-row__badge report-row__badge--mock">{t('reports.mock_badge', undefined, 'Mock Interview')}</span>
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
              {t('reports.track_label', { track: report.interview_type === 'hr' ? 'HR / Behavioral' : 'Technical' }, `Track: ${report.interview_type === 'hr' ? 'HR / Behavioral' : 'Technical'}`)}
            </span>
            <span className="report-row__subbadge">
              {t('reports.level_label', { level: report.experience_level.toUpperCase() }, `Level: ${report.experience_level.toUpperCase()}`)}
            </span>
            {context && <span className="report-row__context-text">{context}</span>}
          </div>

          <div className="report-row__section">
            <p className="report-row__label">{t('reports.diag_feedback', undefined, 'Diagnostic Feedback & Assessment')}</p>
            <FormattedFeedback content={report.feedback} className="report-row__text" />
          </div>

          <div className="report-row__section">
            <p className="report-row__label">
              {t('reports.full_transcript', { count: report.transcript.length }, `Full Conversation Transcript (${report.transcript.length} turns)`)}
            </p>
            <div className="report-row__transcript">
              {report.transcript.map((tTurn, idx) => (
                <div
                  key={idx}
                  className={`report-row__turn report-row__turn--${tTurn.role}`}
                >
                  <div className="report-row__turn-sender">
                    {tTurn.role === 'interviewer' ? t('reports.ai_interviewer', undefined, 'AI Interviewer') : t('reports.you_candidate', undefined, 'You (Candidate)')}
                  </div>
                  <div className="report-row__turn-content">
                    <FormattedFeedback content={tTurn.content} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="report-row__actions">
            <div className="report-row__action-group">
              <button
                type="button"
                className="report-row__action-btn"
                onClick={() => exportMockInterviewReportToPDF(report)}
                title={t('reports.export_pdf_tooltip', undefined, 'Download printable assessment PDF')}
              >
                <PdfIcon width={14} height={14} />
                <span>{t('reports.export_pdf', undefined, 'Export PDF')}</span>
              </button>
              <button
                type="button"
                className={`report-row__action-btn ${copied ? 'report-row__action-btn--copied' : ''}`}
                onClick={handleShare}
                title={t('reports.share_summary_tooltip', undefined, 'Copy formatted summary to clipboard')}
              >
                {copied ? <CheckIcon width={14} height={14} /> : <ShareIcon width={14} height={14} />}
                <span>{copied ? t('reports.copied_btn', undefined, 'Copied!') : t('reports.share_summary', undefined, 'Share Summary')}</span>
              </button>
            </div>

            {!confirming ? (
              <button
                type="button"
                className="report-row__delete"
                onClick={() => setConfirming(true)}
              >
                {t('reports.delete_report', undefined, 'Delete report')}
              </button>
            ) : (
              <span className="report-row__confirm-group">
                <button
                  type="button"
                  className="report-row__delete report-row__delete--confirm"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? t('preset.deleting', undefined, 'Deleting…') : t('preset.confirm_delete', undefined, 'Confirm delete')}
                </button>
                <button
                  type="button"
                  className="report-row__cancel"
                  onClick={() => setConfirming(false)}
                  disabled={isDeleting}
                >
                  {t('preset.cancel', undefined, 'Cancel')}
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
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const context = formatContext(report)

  async function handleShare() {
    const success = await copyShareableSummary(report)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }

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

  const isCoding = report.session_id.startsWith('coding-') || report.company === 'Coding Sandbox'

  return (
    <li className={`report-row ${expanded ? 'report-row--expanded' : ''}`}>
      <button
        type="button"
        className="report-row__summary"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="report-row__score">{report.score}/10</span>
        {isCoding ? (
          <span className="report-row__badge report-row__badge--coding">{t('reports.coding_badge', undefined, 'Coding')}</span>
        ) : (
          <span className="report-row__badge report-row__badge--single">{t('reports.single_badge', undefined, 'Single Drill')}</span>
        )}
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
              <p className="report-row__label">{t('reports.target_role_ctx', undefined, 'Target Role & Context')}</p>
              <p className="report-row__text">{context}</p>
            </div>
          )}

          <div className="report-row__section">
            <p className="report-row__label">{isCoding ? t('reports.challenge_submission', undefined, 'Challenge & Code Submission') : t('reports.question_response', undefined, 'Question & Candidate Response')}</p>
            <div className="report-row__transcript">
              <div className="report-row__turn report-row__turn--interviewer">
                <div className="report-row__turn-sender">{isCoding ? t('reports.coding_problem', undefined, 'Coding Problem') : t('reports.drill_question', undefined, 'Drill Question')}</div>
                <div className="report-row__turn-content">
                  <FormattedFeedback content={report.question} />
                </div>
              </div>
              <div className="report-row__turn--candidate">
                <div className="report-row__turn-sender">{isCoding ? t('reports.code_submission', { lang: report.location || 'Code' }, `Code Submission (${report.location || 'Code'})`) : t('reports.your_response', undefined, 'Your Response')}</div>
                <div className="report-row__turn-content">
                  <FormattedFeedback content={report.answer} />
                </div>
              </div>
            </div>
          </div>


          <div className="report-row__section">
            <p className="report-row__label">{t('reports.feedback_eval', undefined, 'Feedback & Evaluation')}</p>
            <FormattedFeedback content={report.feedback} className="report-row__text" />
          </div>

          <div className="report-row__actions">
            <div className="report-row__action-group">
              <button
                type="button"
                className="report-row__action-btn"
                onClick={() => exportSingleReportToPDF(report)}
                title={t('reports.export_pdf_tooltip', undefined, 'Download printable assessment PDF')}
              >
                <PdfIcon width={14} height={14} />
                <span>{t('reports.export_pdf', undefined, 'Export PDF')}</span>
              </button>
              <button
                type="button"
                className={`report-row__action-btn ${copied ? 'report-row__action-btn--copied' : ''}`}
                onClick={handleShare}
                title={t('reports.share_summary_tooltip', undefined, 'Copy formatted summary to clipboard')}
              >
                {copied ? <CheckIcon width={14} height={14} /> : <ShareIcon width={14} height={14} />}
                <span>{copied ? t('reports.copied_btn', undefined, 'Copied!') : t('reports.share_summary', undefined, 'Share Summary')}</span>
              </button>
            </div>

            {!confirming ? (
              <button
                type="button"
                className="report-row__delete"
                onClick={() => setConfirming(true)}
              >
                {t('reports.delete_report', undefined, 'Delete report')}
              </button>
            ) : (
              <span className="report-row__confirm-group">
                <button
                  type="button"
                  className="report-row__delete report-row__delete--confirm"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? t('preset.deleting', undefined, 'Deleting…') : t('preset.confirm_delete', undefined, 'Confirm delete')}
                </button>
                <button
                  type="button"
                  className="report-row__cancel"
                  onClick={() => setConfirming(false)}
                  disabled={isDeleting}
                >
                  {t('preset.cancel', undefined, 'Cancel')}
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