import type { CommunicationInsights } from '../../api/practiceApi'

interface CommunicationInsightsCardProps {
  communication: CommunicationInsights
}

export function CommunicationInsightsCard({ communication }: CommunicationInsightsCardProps) {
  const getConcisenessBadge = (status: CommunicationInsights['conciseness_status']) => {
    switch (status) {
      case 'Concise':
        return { className: 'concise-badge--concise', text: 'Concise & Direct' }
      case 'Balanced':
        return { className: 'concise-badge--balanced', text: 'Optimal Length (Balanced)' }
      case 'Verbose':
        return { className: 'concise-badge--verbose', text: 'Detailed / Extended' }
      default:
        return { className: 'concise-badge--default', text: 'Awaiting Data' }
    }
  }

  const badge = getConcisenessBadge(communication.conciseness_status)

  return (
    <div className="comm-insights-container">
      <div className="comm-insights-header">
        <div>
          <h3 className="comm-insights-title">Communication & Delivery Insights</h3>
          <p className="comm-insights-subtitle">
            Response pacing, answer depth, and structural delivery feedback
          </p>
        </div>
      </div>

      <div className="comm-metrics-grid">
        <div className="comm-metric-card">
          <span className="comm-metric-label">Average Response Length</span>
          <div className="comm-metric-value-row">
            <span className="comm-metric-number">{communication.avg_word_count}</span>
            <span className="comm-metric-unit">words / answer</span>
          </div>
          <span className={`comm-metric-badge ${badge.className}`}>{badge.text}</span>
        </div>

        <div className="comm-metric-card">
          <span className="comm-metric-label">Total Words Articulated</span>
          <div className="comm-metric-value-row">
            <span className="comm-metric-number">
              {communication.total_words_spoken_or_typed.toLocaleString()}
            </span>
            <span className="comm-metric-unit">words spoken / typed</span>
          </div>
          <span className="comm-metric-subtext">Across all recorded sessions</span>
        </div>
      </div>

      <div className="comm-feedback-themes">
        <div className="feedback-column">
          <h4 className="feedback-column-title feedback-column-title--strengths">
            <span>✓</span> Recurring Evaluator Strengths
          </h4>
          <div className="theme-tag-list">
            {communication.common_strength_keywords.length > 0 ? (
              communication.common_strength_keywords.map((kw) => (
                <span key={kw} className="theme-tag theme-tag--strength">
                  {kw}
                </span>
              ))
            ) : (
              <p className="theme-tag-empty">Complete practice drills to discover strength themes.</p>
            )}
          </div>
        </div>

        <div className="feedback-column">
          <h4 className="feedback-column-title feedback-column-title--growth">
            <span>▲</span> High-Yield Growth Areas
          </h4>
          <div className="theme-tag-list">
            {communication.common_growth_keywords.length > 0 ? (
              communication.common_growth_keywords.map((kw) => (
                <span key={kw} className="theme-tag theme-tag--growth">
                  {kw}
                </span>
              ))
            ) : (
              <p className="theme-tag-empty">Growth themes will appear after your first few sessions.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
