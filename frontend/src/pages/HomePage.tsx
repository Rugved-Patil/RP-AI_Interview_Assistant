import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createPreset,
  getAnalytics,
  listPresets,
  type AnalyticsDashboardResponse,
  type RecommendedDrill,
} from '../api/practiceApi'
import { setActivePresetId } from '../activePreset'
import { PresetsIcon } from '../components/Icons'
import { FormattedFeedback } from '../components/FormattedFeedback'
import './HomePage.css'

export function HomePage() {
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [presetsCount, setPresetsCount] = useState<number | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsDashboardResponse | null>(null)
  const [expandedHomeAnswers, setExpandedHomeAnswers] = useState<Record<string, boolean>>({})

  // Quick setup form state
  const [quickRole, setQuickRole] = useState('')
  const [quickCompany, setQuickCompany] = useState('')
  const [quickLocation, setQuickLocation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listPresets()
      .then((presets) => {
        if (cancelled) return
        setPresetsCount(presets.length)
        if (presets.length === 0) {
          setActivePresetId(null)
        }
        setPresetsLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setPresetsCount(null)
          setPresetsLoading(false)
        }
      })

    // Load analytics to check for training unlock milestone (3+ completed sessions)
    getAnalytics()
      .then((data) => {
        if (!cancelled) {
          setAnalytics(data)
        }
      })
      .catch((err) => {
        console.warn('Analytics fetch on home:', err)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const toggleHomeAnswer = (id: string) => {
    setExpandedHomeAnswers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getPracticeRoute = (drill: RecommendedDrill) => {
    if (drill.recommended_test_type === 'mock_interview') {
      return '/mock-interview?type=technical'
    }
    if (drill.category.toLowerCase() === 'behavioral' || drill.recommended_test_type === 'behavioral_drill') {
      return '/practice/behavioral'
    }
    return '/practice'
  }

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickRole.trim()) {
      setQuickError('Target role title is required.')
      return
    }

    setIsSubmitting(true)
    setQuickError(null)

    try {
      const created = await createPreset({
        role: quickRole.trim(),
        company: quickCompany.trim() || undefined,
        location: quickLocation.trim() || undefined,
      })
      setActivePresetId(created.id)
      setPresetsCount(1)
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : 'Could not save preset.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasNoPresets = !presetsLoading && presetsCount === 0

  return (
    <div className="home">
      {/* Empty Presets Onboarding Setup Banner */}
      {hasNoPresets && (
        <section className="home__preset-onboarding" aria-labelledby="preset-onboarding-title">
          <div className="home__preset-onboarding-header">
            <div className="home__preset-onboarding-icon" aria-hidden="true">
              <PresetsIcon width={22} height={22} />
            </div>
            <div>
              <span className="home__preset-onboarding-eyebrow">Getting Started · Step 1</span>
              <h2 id="preset-onboarding-title" className="home__preset-onboarding-title">
                Configure Your Target Role &amp; Interview Preset
              </h2>
              <p className="home__preset-onboarding-desc">
                RP-AI generates technical questions, STAR behavioral scenarios, and diagnostic rubrics tailored to your specific role and company. Please save your first preset to begin.
              </p>
            </div>
          </div>

          <form onSubmit={handleQuickCreate} className="home__quick-preset-form">
            <div className="home__quick-preset-grid">
              <div className="home__quick-field">
                <label htmlFor="quick-role" className="home__quick-label">
                  Target Role <span className="home__required-star">*</span>
                </label>
                <input
                  id="quick-role"
                  type="text"
                  className="home__quick-input"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={quickRole}
                  onChange={(e) => setQuickRole(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div className="home__quick-field">
                <label htmlFor="quick-company" className="home__quick-label">
                  Target Company <span className="home__optional-tag">(Optional)</span>
                </label>
                <input
                  id="quick-company"
                  type="text"
                  className="home__quick-input"
                  placeholder="e.g. Google, Stripe, Startup"
                  value={quickCompany}
                  onChange={(e) => setQuickCompany(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="home__quick-field">
                <label htmlFor="quick-location" className="home__quick-label">
                  Location / Region <span className="home__optional-tag">(Optional)</span>
                </label>
                <input
                  id="quick-location"
                  type="text"
                  className="home__quick-input"
                  placeholder="e.g. Remote, San Francisco"
                  value={quickLocation}
                  onChange={(e) => setQuickLocation(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {quickError && <p className="home__quick-error">{quickError}</p>}

            <div className="home__quick-preset-actions">
              <button
                type="submit"
                className="home__quick-submit-btn"
                disabled={isSubmitting || !quickRole.trim()}
              >
                {isSubmitting ? 'Saving Preset…' : 'Save Preset & Start Practice'}
              </button>
            </div>
          </form>
        </section>
      )}

      <header className="home__header">
        <h1 className="home__title">Select Your Practice Mode</h1>
        <p className="home__subtitle">
          Choose between rapid single-question drills or full end-to-end mock interviews.
        </p>
      </header>

      <section className="home__section">
        <div className="home__section-header">
          <h2 className="home__section-title">Single Question Practice</h2>
          <p className="home__section-desc">
            Quick, focused practice sessions with instant evaluation and feedback after each question.
          </p>
        </div>

        <div className="home__grid">
          <Link to="/practice" className="mode-card">
            <span className="mode-card__badge">Single Question</span>
            <h3 className="mode-card__title">Technical Questions</h3>
            <p className="mode-card__body">
              Answer role-specific technical and problem-solving questions tailored to your target preset.
            </p>
          </Link>

          <Link to="/practice/behavioral" className="mode-card">
            <span className="mode-card__badge">Single Question</span>
            <h3 className="mode-card__title">Behavioral Questions</h3>
            <p className="mode-card__body">
              Practice open-ended questions assessing communication, leadership, and situational responses.
            </p>
          </Link>

          <Link to="/sandbox" className="mode-card">
            <span className="mode-card__badge">Live Sandbox</span>
            <h3 className="mode-card__title">Interactive Live Coding</h3>
            <p className="mode-card__body">
              Solve algorithmic and system coding problems with real-time test execution and AI diagnostic code reviews.
            </p>
          </Link>
        </div>
      </section>

      <section className="home__section">
        <div className="home__section-header">
          <h2 className="home__section-title">Full Mock Interviews</h2>
          <p className="home__section-desc">
            Interactive multi-turn conversations with follow-up questions and holistic scoring at the end.
          </p>
        </div>

        <div className="home__grid">
          <Link to="/mock-interview?type=technical" className="mode-card">
            <span className="mode-card__badge">Full Mock Interview</span>
            <h3 className="mode-card__title">Technical Mock Interview</h3>
            <p className="mode-card__body">
              A comprehensive technical interview probing deep domain knowledge, system design, and practical experience.
            </p>
          </Link>

          <Link to="/mock-interview?type=hr" className="mode-card">
            <span className="mode-card__badge">Full Mock Interview</span>
            <h3 className="mode-card__title">HR &amp; Behavioral Mock</h3>
            <p className="mode-card__body">
              A complete interview exploring past experience, culture fit, teamwork, and decision-making.
            </p>
          </Link>
        </div>
      </section>

      {/* Progressive Training Milestone Progress Card (when 1 <= sessions < 3) */}
      {analytics &&
        analytics.summary.total_sessions > 0 &&
        analytics.summary.total_sessions < 3 && (
          <section className="home__section">
            <div className="home__training-milestone-card">
              <div className="home__training-milestone-top">
                <div className="home__training-milestone-info">
                  <span className="home__training-milestone-tag">Adaptive Training Engine</span>
                  <h3 className="home__training-milestone-title">
                    Personalized Training Unlocks in {3 - analytics.summary.total_sessions} More Session
                    {3 - analytics.summary.total_sessions === 1 ? '' : 's'}
                  </h3>
                  <p className="home__training-milestone-desc">
                    Complete and save {3 - analytics.summary.total_sessions} more practice session to calibrate your targeted training recommendations and unlock 8/10 benchmark model answers.
                  </p>
                </div>
                <div className="home__training-milestone-fraction">
                  <span className="home__training-fraction-val">{analytics.summary.total_sessions}</span>
                  <span className="home__training-fraction-denom">/ 3</span>
                </div>
              </div>
              <div className="home__training-progress-track">
                <div
                  className="home__training-progress-bar"
                  style={{ width: `${(analytics.summary.total_sessions / 3) * 100}%` }}
                />
              </div>
            </div>
          </section>
        )}

      {/* Recommended Practice Section - Unlocked after completing & saving 3+ sessions */}
      {analytics &&
        analytics.summary.total_sessions >= 3 &&
        analytics.recommended_drills &&
        analytics.recommended_drills.length > 0 && (
          <section className="home__section home__recommended-section" aria-labelledby="recommended-practice-title">
            <div className="home__section-header">
              <div className="home__recommended-badge-row">
                <span className="home__recommended-pill">Targeted Recommendations</span>
                <span className="home__recommended-threshold-tag">
                  Personalized · {analytics.summary.total_sessions} Evaluated Sessions Analyzed
                </span>
              </div>
              <h2 id="recommended-practice-title" className="home__section-title">
                Recommended Practice &amp; 8/10 Model Answers
              </h2>
              <p className="home__section-desc">
                Based on diagnostic evaluations across your saved sessions, here are targeted questions and benchmark answers recommended to strengthen your focus areas.
              </p>
            </div>

            {analytics.weak_spots && analytics.weak_spots.length > 0 && (
              <div className="home__weak-spots-summary">
                <span className="home__weak-spots-label">Identified Focus Areas:</span>
                <div className="home__weak-spots-pills">
                  {analytics.weak_spots.map((ws) => (
                    <span key={ws.domain} className="home__weak-spot-pill">
                      <strong>{ws.domain}</strong> (avg {ws.average_score.toFixed(1)}/10)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="home__recommended-grid">
              {analytics.recommended_drills.slice(0, 4).map((drill) => {
                const practiceUrl = getPracticeRoute(drill)
                const isExpanded = expandedHomeAnswers[drill.question_id] || false

                return (
                  <div key={drill.question_id} className="home__recommended-card">
                    <div className="home__rec-card-top">
                      <div className="home__rec-badges">
                        <span className="home__rec-domain">{drill.domain}</span>
                        <span className={`home__rec-diff home__rec-diff--${drill.difficulty.toLowerCase()}`}>
                          {drill.difficulty}
                        </span>
                        {drill.recommended_test_label && (
                          <span className="home__rec-directive">
                            {drill.recommended_test_label}
                          </span>
                        )}
                      </div>
                      <span className="home__rec-reason">{drill.reason}</span>
                    </div>

                    <p className="home__rec-question">&ldquo;{drill.question}&rdquo;</p>

                    {drill.tags && drill.tags.length > 0 && (
                      <div className="home__rec-tags">
                        {drill.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="home__rec-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 8/10 Model Answer Accordion */}
                    {drill.model_answer && (
                      <div className="home__rec-model-answer-wrap">
                        <button
                          type="button"
                          className="home__rec-model-answer-btn"
                          onClick={() => toggleHomeAnswer(drill.question_id)}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>★</span>
                            <span>8/10 Benchmark Model Answer</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>{isExpanded ? 'Hide' : 'View'}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points={isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                            </svg>
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="home__rec-model-answer-box">
                            <div className="home__rec-model-answer-text">
                              <FormattedFeedback content={drill.model_answer} />
                            </div>
                            {drill.scoring_breakdown && (
                              <div className="home__rec-scoring-box">
                                <div className="home__rec-scoring-title">Why this scores 8/10:</div>
                                <FormattedFeedback content={drill.scoring_breakdown} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="home__rec-actions">
                      <Link
                        to={practiceUrl}
                        state={{
                          directQuestion: drill.question,
                          domain: drill.domain,
                          difficulty: drill.difficulty,
                        }}
                        className="home__rec-btn home__rec-btn--primary"
                      >
                        Start Targeted Practice →
                      </Link>
                      <Link
                        to={`/questions?search=${encodeURIComponent(drill.question.slice(0, 40))}`}
                        className="home__rec-btn home__rec-btn--secondary"
                      >
                        View in Bank
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
    </div>
  )
}