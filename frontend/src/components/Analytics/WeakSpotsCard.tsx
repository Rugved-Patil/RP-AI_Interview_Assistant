import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { RecommendedDrill, WeakSpotItem } from '../../api/practiceApi'
import { FormattedFeedback } from '../FormattedFeedback'

interface WeakSpotsCardProps {
  weakSpots: WeakSpotItem[]
  recommendedDrills: RecommendedDrill[]
  trainingUnlocked?: boolean
  sessionsUntilUnlock?: number
}

export function WeakSpotsCard({
  weakSpots,
  recommendedDrills,
  trainingUnlocked = true,
  sessionsUntilUnlock = 0,
}: WeakSpotsCardProps) {
  const [expandedModelAnswers, setExpandedModelAnswers] = useState<Record<string, boolean>>({})

  const toggleModelAnswer = (id: string) => {
    setExpandedModelAnswers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getDifficultyBadgeClass = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'junior':
        return 'diff-badge--junior'
      case 'senior':
        return 'diff-badge--senior'
      case 'lead':
        return 'diff-badge--lead'
      default:
        return 'diff-badge--mid'
    }
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

  return (
    <div className="weak-spots-container">
      {/* 1. Weak Spots Gap Analysis */}
      <div className="weak-spots-header">
        <div>
          <h3 className="weak-spots-title">Targeted Weak-Spot Discovery</h3>
          <p className="weak-spots-subtitle">
            Competency gaps and topics with recurring critical feedback across your attempts
          </p>
        </div>
      </div>

      {weakSpots.length > 0 ? (
        <div className="weak-spots-grid">
          {weakSpots.map((ws) => (
            <div key={ws.domain} className="weak-spot-card">
              <div className="weak-spot-card__header">
                <div>
                  <span className="weak-spot-card__domain">{ws.domain}</span>
                  <h4 className="weak-spot-card__topic">{ws.topic}</h4>
                </div>
                <div className="weak-spot-card__score-badge">
                  <span className="ws-score-val">{ws.average_score.toFixed(1)}</span>
                  <span className="ws-score-label">avg score</span>
                </div>
              </div>

              <ul className="weak-spot-reasons">
                {ws.reasons.map((r, idx) => (
                  <li key={idx} className="weak-spot-reason-item">
                    <span className="reason-bullet">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="weak-spots-well-done">
          <span className="well-done-icon">★</span>
          <div>
            <h4>Strong Performance Consistency</h4>
            <p>
              No severe competency gaps detected across your recorded practice sessions. Keep drilling to maintain mastery!
            </p>
          </div>
        </div>
      )}

      {/* 2. Targeted Question Bank Recommendations */}
      <div className="recommended-section">
        <div className="recommended-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h4 className="recommended-title">Recommended Targeted Practice &amp; Model Answers</h4>
              {trainingUnlocked && (
                <span className="training-active-tag">Personalized Training Active</span>
              )}
            </div>
            <p className="recommended-subtitle">
              Curated questions from the Question Bank with calibrated 8/10 benchmark answers to reinforce your focus areas
            </p>
          </div>
          <Link to="/questions" className="view-bank-link">
            Explore All Questions →
          </Link>
        </div>

        {!trainingUnlocked && sessionsUntilUnlock > 0 && (
          <div className="training-locked-card">
            <div className="training-locked-icon">🎯</div>
            <div>
              <h5 className="training-locked-title">
                Personalized Training Unlocks in {sessionsUntilUnlock} More Session{sessionsUntilUnlock === 1 ? '' : 's'}
              </h5>
              <p className="training-locked-desc">
                Complete and save {sessionsUntilUnlock} more practice session to calibrate your targeted training recommendations and unlock deep weak-spot diagnostics. Below are general recommended questions.
              </p>
            </div>
          </div>
        )}

        <div className="recommended-cards-grid">
          {recommendedDrills.map((drill) => {
            const practiceUrl = getPracticeRoute(drill)
            const isExpanded = expandedModelAnswers[drill.question_id] || false

            return (
              <div key={drill.question_id} className="drill-recommendation-card">
                <div className="drill-rec-header">
                  <div className="drill-rec-badges">
                    <span className="drill-domain-badge">{drill.domain}</span>
                    <span className={`drill-diff-badge ${getDifficultyBadgeClass(drill.difficulty)}`}>
                      {drill.difficulty}
                    </span>
                    {drill.recommended_test_label && (
                      <span className="drill-directive-badge">
                        {drill.recommended_test_label}
                      </span>
                    )}
                  </div>
                  <span className="drill-reason-badge">{drill.reason}</span>
                </div>

                <p className="drill-question-text">{drill.question}</p>

                {drill.tags && drill.tags.length > 0 && (
                  <div className="drill-tags">
                    {drill.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="drill-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 8/10 Exemplar Model Answer Accordion */}
                {drill.model_answer && (
                  <div className="drill-model-answer-container">
                    <button
                      type="button"
                      className="drill-model-answer-toggle"
                      onClick={() => toggleModelAnswer(drill.question_id)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>★</span>
                        <span>8/10 Benchmark Model Answer</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{isExpanded ? 'Hide Answer' : 'View Exemplar Answer'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points={isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                        </svg>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="drill-model-answer-box">
                        <div className="drill-model-answer-content">
                          <FormattedFeedback content={drill.model_answer} />
                        </div>
                        {drill.scoring_breakdown && (
                          <div className="drill-scoring-breakdown">
                            <div className="drill-scoring-title">Why this response achieves an 8/10 score:</div>
                            <FormattedFeedback content={drill.scoring_breakdown} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="drill-actions">
                  <Link
                    to={practiceUrl}
                    state={{
                      directQuestion: drill.question,
                      domain: drill.domain,
                      difficulty: drill.difficulty,
                    }}
                    className="drill-action-btn drill-action-btn--primary"
                  >
                    ▶ Start Practice →
                  </Link>
                  <Link
                    to={`/questions?search=${encodeURIComponent(drill.question.slice(0, 45))}`}
                    className="drill-action-btn drill-action-btn--secondary"
                  >
                    View in Bank
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
