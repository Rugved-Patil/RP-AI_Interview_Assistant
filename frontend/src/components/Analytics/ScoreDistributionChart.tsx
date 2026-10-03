import type { ScoreDistribution } from '../../api/practiceApi'

interface ScoreDistributionChartProps {
  distribution: ScoreDistribution
}

export function ScoreDistributionChart({ distribution }: ScoreDistributionChartProps) {
  const total =
    distribution.mastered +
    distribution.proficient +
    distribution.developing +
    distribution.needs_work

  const tiers = [
    {
      label: 'Mastered (9–10)',
      count: distribution.mastered,
      color: '#16a34a',
      desc: 'Offer-level mastery',
    },
    {
      label: 'Proficient (7–8)',
      count: distribution.proficient,
      color: '#2563eb',
      desc: 'Solid understanding',
    },
    {
      label: 'Developing (5–6)',
      count: distribution.developing,
      color: '#d97706',
      desc: 'Room for growth',
    },
    {
      label: 'Needs Work (0–4)',
      count: distribution.needs_work,
      color: '#dc2626',
      desc: 'Foundational gaps',
    },
  ]

  if (total === 0) {
    return (
      <div className="analytics-empty-chart">
        <p>No score distribution data recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="score-distribution-container">
      <div className="score-distribution-header">
        <h3 className="score-distribution-title">Score Tier Distribution</h3>
        <p className="score-distribution-subtitle">
          Breakdown of evaluation scores across all completed drills
        </p>
      </div>

      <div className="distribution-bars">
        {tiers.map((tier) => {
          const pct = total > 0 ? Math.round((tier.count / total) * 100) : 0
          return (
            <div key={tier.label} className="dist-row">
              <div className="dist-row__label-group">
                <span className="dist-row__tier-name">{tier.label}</span>
                <span className="dist-row__desc">{tier.desc}</span>
              </div>

              <div className="dist-row__meter-track">
                <div
                  className="dist-row__meter-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: tier.color,
                    '--target-width': `${pct}%`,
                  } as React.CSSProperties}
                />
              </div>

              <div className="dist-row__stat">
                <span className="dist-row__count">{tier.count}</span>
                <span className="dist-row__pct">({pct}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
