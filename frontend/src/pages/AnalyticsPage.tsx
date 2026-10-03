import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getAnalytics,
  type AnalyticsDashboardResponse,
  type AnalyticsFilters,
} from '../api/practiceApi'
import { ScoreTrajectoryChart } from '../components/Analytics/ScoreTrajectoryChart'
import { DomainCompetencyChart } from '../components/Analytics/DomainCompetencyChart'
import { ScoreDistributionChart } from '../components/Analytics/ScoreDistributionChart'
import { CommunicationInsightsCard } from '../components/Analytics/CommunicationInsightsCard'
import { WeakSpotsCard } from '../components/Analytics/WeakSpotsCard'
import { useTranslation } from '../i18n/LanguageContext'
import '../components/Analytics/AnalyticsCharts.css'
import './AnalyticsPage.css'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { t, formatDomain } = useTranslation()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null)

  // Filters state
  const [timeframe, setTimeframe] = useState<number | undefined>(undefined) // undefined = all time
  const [sessionType, setSessionType] = useState<'all' | 'mock' | 'single'>('all')

  const handleTimeframeChange = (tf: number | undefined) => {
    setTimeframe(tf)
    setLoading(true)
  }

  const handleSessionTypeChange = (st: 'all' | 'mock' | 'single') => {
    setSessionType(st)
    setLoading(true)
  }

  useEffect(() => {
    let cancelled = false

    const filters: AnalyticsFilters = {
      timeframe,
      session_type: sessionType,
    }

    getAnalytics(filters)
      .then((res) => {
        if (!cancelled) {
          setData(res)
          setError(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [timeframe, sessionType])

  return (
    <div className="analytics-page">
      {/* Universal Smart History Back Navigation */}
      <button
        type="button"
        className="page-back"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1)
          } else {
            navigate('/')
          }
        }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        ← Back
      </button>

      {/* Page Header */}
      <header className="analytics-header">
        <div>
          <h1 className="analytics-title">{t('nav.analytics', undefined, 'Analytics & Progress Tracking')}</h1>
          <p className="analytics-subtitle">
            {t('analytics.page_subtitle', undefined, 'Track your interview performance trajectory, analyze domain competencies, and discover high-yield improvement areas.')}
          </p>
        </div>
      </header>

      {/* Unified Single-Row Filter Control Bar */}
      <div className="analytics-filter-bar">
        <div className="filter-group">
          <span className="filter-label">Time:</span>
          <div className="filter-segmented" data-active={timeframe === undefined ? 'all' : timeframe === 30 ? '30' : '7'}>
            <button
              type="button"
              className={`filter-btn ${timeframe === undefined ? 'filter-btn--active' : ''}`}
              onClick={() => handleTimeframeChange(undefined)}
            >
              All Time
            </button>
            <button
              type="button"
              className={`filter-btn ${timeframe === 30 ? 'filter-btn--active' : ''}`}
              onClick={() => handleTimeframeChange(30)}
            >
              30 Days
            </button>
            <button
              type="button"
              className={`filter-btn ${timeframe === 7 ? 'filter-btn--active' : ''}`}
              onClick={() => handleTimeframeChange(7)}
            >
              7 Days
            </button>
          </div>
        </div>

        <div className="filter-separator" />

        <div className="filter-group">
          <span className="filter-label">Type:</span>
          <div className="filter-segmented" data-active={sessionType}>
            <button
              type="button"
              className={`filter-btn ${sessionType === 'all' ? 'filter-btn--active' : ''}`}
              onClick={() => handleSessionTypeChange('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-btn ${sessionType === 'mock' ? 'filter-btn--active' : ''}`}
              onClick={() => handleSessionTypeChange('mock')}
            >
              Full Mocks
            </button>
            <button
              type="button"
              className={`filter-btn ${sessionType === 'single' ? 'filter-btn--active' : ''}`}
              onClick={() => handleSessionTypeChange('single')}
            >
              Single Drills
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="analytics-loading-state">
          <div className="analytics-spinner" />
          <p>Analyzing practice reports & computing progress metrics...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="analytics-error-banner">
          <p>
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Content State */}
      {!loading && !error && data && (
        <>
          {data.summary.total_sessions === 0 ? (
            <div className="analytics-empty-state">
              <div className="empty-state-icon">📊</div>
              <h2 className="empty-state-title">No Saved Reports Yet</h2>
              <p className="empty-state-text">
                Complete single-question practice drills or full mock interviews and save your evaluated reports to unlock your score progression trajectory, competency radars, and targeted weak-spot diagnostics.
              </p>
              <div className="empty-state-actions">
                <Link to="/practice" className="empty-cta empty-cta--primary">
                  Start Technical Drill →
                </Link>
                <Link to="/mock-interview?type=technical" className="empty-cta empty-cta--secondary">
                  Start Mock Interview →
                </Link>
              </div>
            </div>
          ) : (
            <div className="analytics-dashboard-grid">
              {/* Top Summary Stat Cards */}
              <div className="summary-cards-grid">
                {/* 1. Total Completed */}
                <div className="stat-card">
                  <span className="stat-card__eyebrow">Practices Completed</span>
                  <div className="stat-card__val-row">
                    <span className="stat-card__main-val">{data.summary.total_sessions}</span>
                    <span className="stat-card__unit">sessions</span>
                  </div>
                  <div className="stat-card__subtext">
                    {data.summary.total_mock_interviews} mocks • {data.summary.total_single_drills} single drills
                  </div>
                </div>

                {/* 2. Overall Average Score */}
                <div className="stat-card">
                  <span className="stat-card__eyebrow">Average Score</span>
                  <div className="stat-card__val-row">
                    <span className="stat-card__main-val stat-card__main-val--score">
                      {data.summary.average_score.toFixed(1)}
                    </span>
                    <span className="stat-card__unit">/ 10</span>
                  </div>
                  <div className="stat-card__subtext">
                    {data.summary.highest_score !== null && (
                      <span>Peak: {data.summary.highest_score}/10 • Min: {data.summary.lowest_score}/10</span>
                    )}
                  </div>
                </div>

                {/* 3. Trajectory Trend */}
                <div className="stat-card">
                  <span className="stat-card__eyebrow">Recent Trajectory</span>
                  <div className="stat-card__val-row">
                    <span
                      className={`stat-card__main-val ${
                        data.summary.score_trend > 0
                          ? 'trend-up'
                          : data.summary.score_trend < 0
                          ? 'trend-down'
                          : ''
                      }`}
                    >
                      {data.summary.score_trend > 0
                        ? `+${data.summary.score_trend.toFixed(1)}`
                        : data.summary.score_trend.toFixed(1)}
                    </span>
                    <span className="stat-card__unit">trend</span>
                  </div>
                  <div className="stat-card__subtext">
                    {data.summary.recent_average !== null
                      ? `Recent 5 sessions: ${data.summary.recent_average.toFixed(1)}/10`
                      : 'Across evaluated attempts'}
                  </div>
                </div>

                {/* 4. Top Strength & Focus Domain */}
                <div className="stat-card">
                  <span className="stat-card__eyebrow">Top Strength & Focus</span>
                  <div className="stat-card__domains-row">
                    <div className="domain-pill domain-pill--strength">
                      <span className="domain-pill__label">Top:</span>
                      <span className="domain-pill__name">
                        {data.summary.top_strength_domain ? formatDomain(data.summary.top_strength_domain) : 'N/A'}
                      </span>
                    </div>
                    <div className="domain-pill domain-pill--focus">
                      <span className="domain-pill__label">Focus:</span>
                      <span className="domain-pill__name">
                        {data.summary.focus_domain ? formatDomain(data.summary.focus_domain) : 'Mastery Achieved'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Visuals Row: Trajectory Chart */}
              <section className="dashboard-section">
                <ScoreTrajectoryChart timeline={data.timeline} />
              </section>

              {/* Two Column Grid: Domain Competency & Score Tier Distribution */}
              <div className="dashboard-two-col">
                <DomainCompetencyChart domains={data.domains} />
                <ScoreDistributionChart distribution={data.score_distribution} />
              </div>

              {/* Communication & Delivery Insights */}
              <section className="dashboard-section">
                <CommunicationInsightsCard communication={data.communication} />
              </section>

              {/* Weak-Spot & Targeted Practice Question Recommendations */}
              <section className="dashboard-section">
                <WeakSpotsCard
                  weakSpots={data.weak_spots}
                  recommendedDrills={data.recommended_drills}
                  trainingUnlocked={data.summary.training_unlocked}
                  sessionsUntilUnlock={data.summary.sessions_until_unlock}
                />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
