import { Link } from 'react-router-dom'
import type { RecommendedDrill, WeakSpotItem } from '../../api/practiceApi'

interface WeakSpotsCardProps {
  weakSpots: WeakSpotItem[]
  recommendedDrills: RecommendedDrill[]
}

export function WeakSpotsCard({ weakSpots, recommendedDrills }: WeakSpotsCardProps) {
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

  return (
    <div className="weak-spots-container">
      {/* 1. Weak Spots Gap Analysis */}
      <div className="weak-spots-header">
        <div>
          <h3 className="weak-spots-title">Targeted Weak-Spot Discovery</h3>
          <p className="weak-spots-subtitle">
            Competency gaps and topics with recurring critical feedback
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
            <h4 className="recommended-title">Recommended Targeted Practice Drills</h4>
            <p className="recommended-subtitle">
              Curated questions from the Question Bank tailored to reinforce your focus areas
            </p>
          </div>
          <Link to="/questions" className="view-bank-link">
            Explore All Questions →
          </Link>
        </div>

        <div className="recommended-cards-grid">
          {recommendedDrills.map((drill) => {
            const isBehavioral = drill.category.toLowerCase() === 'behavioral'
            const practiceUrl = isBehavioral ? '/practice/behavioral' : '/practice'

            return (
              <div key={drill.question_id} className="drill-recommendation-card">
                <div className="drill-rec-header">
                  <div className="drill-rec-badges">
                    <span className="drill-domain-badge">{drill.domain}</span>
                    <span className={`drill-diff-badge ${getDifficultyBadgeClass(drill.difficulty)}`}>
                      {drill.difficulty}
                    </span>
                  </div>
                  <span className="drill-reason-badge">{drill.reason}</span>
                </div>

                <p className="drill-question-text">{drill.question}</p>

                {drill.tags.length > 0 && (
                  <div className="drill-tags">
                    {drill.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="drill-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="drill-actions">
                  <Link to={practiceUrl} className="drill-action-btn drill-action-btn--primary">
                    Practice Drill →
                  </Link>
                  <Link
                    to={`/questions?search=${encodeURIComponent(drill.question.slice(0, 50))}`}
                    className="drill-action-btn drill-action-btn--secondary"
                  >
                    View Rubric
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
