import type { DomainBreakdown } from '../../api/practiceApi'

interface DomainCompetencyChartProps {
  domains: DomainBreakdown[]
}

export function DomainCompetencyChart({ domains }: DomainCompetencyChartProps) {
  if (domains.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <p>No domain performance data available yet.</p>
      </div>
    )
  }

  const getStatusClass = (status: DomainBreakdown['status']) => {
    switch (status) {
      case 'Strong':
        return 'status-badge--strong'
      case 'Competent':
        return 'status-badge--competent'
      case 'Needs Practice':
        return 'status-badge--needs-practice'
    }
  }

  const getMeterColor = (score: number) => {
    if (score >= 8.0) return 'var(--color-meter-strong, #16a34a)'
    if (score >= 6.5) return 'var(--color-meter-competent, #2563eb)'
    return 'var(--color-meter-weak, #dc2626)'
  }

  return (
    <div className="domain-competency-container">
      <div className="domain-competency-header">
        <div>
          <h3 className="domain-competency-title">Domain Competency Breakdown</h3>
          <p className="domain-competency-subtitle">
            Average performance across core technical and behavioral domains
          </p>
        </div>
      </div>

      <div className="domain-list">
        {domains.map((d) => {
          const percentage = Math.min(100, Math.max(0, (d.average_score / 10) * 100))
          return (
            <div key={d.domain} className="domain-row">
              <div className="domain-row__header">
                <div className="domain-row__title-group">
                  <span className="domain-row__name">{d.domain}</span>
                  <span className="domain-row__category-badge">{d.category}</span>
                  <span className={`domain-row__status ${getStatusClass(d.status)}`}>
                    {d.status}
                  </span>
                </div>
                <div className="domain-row__score-group">
                  <span className="domain-row__score-val">{d.average_score.toFixed(1)}</span>
                  <span className="domain-row__score-max">/ 10</span>
                </div>
              </div>

              <div className="domain-row__meter-track">
                <div
                  className="domain-row__meter-fill"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: getMeterColor(d.average_score),
                    '--target-width': `${percentage}%`,
                  } as React.CSSProperties}
                />
              </div>

              <div className="domain-row__footer">
                <span className="domain-row__meta">
                  {d.sessions_count} {d.sessions_count === 1 ? 'practice attempt' : 'practice attempts'}
                </span>
                <span className="domain-row__meta">
                  Score range: {d.min_score} – {d.max_score}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
