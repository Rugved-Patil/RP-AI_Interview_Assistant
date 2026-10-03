import { useState } from 'react'
import type { ScoreDataPoint } from '../../api/practiceApi'

interface ScoreTrajectoryChartProps {
  timeline: ScoreDataPoint[]
}

export function ScoreTrajectoryChart({ timeline }: ScoreTrajectoryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (timeline.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <p>No historical attempts recorded in this timeframe.</p>
      </div>
    )
  }

  // SVG dimensions
  const width = 760
  const height = 260
  const paddingLeft = 45
  const paddingRight = 30
  const paddingTop = 25
  const paddingBottom = 40

  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom

  // Score range: 0 to 10
  const minY = 0
  const maxY = 10

  const getY = (score: number) => {
    const clamped = Math.max(minY, Math.min(maxY, score))
    return paddingTop + plotHeight - ((clamped - minY) / (maxY - minY)) * plotHeight
  }

  const getX = (index: number) => {
    if (timeline.length === 1) {
      return paddingLeft + plotWidth / 2
    }
    return paddingLeft + (index / (timeline.length - 1)) * plotWidth
  }

  // Generate SVG path for line
  const points = timeline.map((pt, idx) => ({ x: getX(idx), y: getY(pt.score), pt, idx }))

  const linePath =
    points.length === 1
      ? `M ${paddingLeft} ${points[0].y} L ${paddingLeft + plotWidth} ${points[0].y}`
      : points.reduce((acc, curr, idx) => {
          return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`
        }, '')

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`
      : ''

  // Benchmark target line (8.0 / 10)
  const benchmarkY = getY(8.0)

  // Y-axis grid ticks (0, 2, 4, 6, 8, 10)
  const yTicks = [0, 2, 4, 6, 8, 10]

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <div className="score-trajectory-container">
      <div className="trajectory-header">
        <div>
          <h3 className="trajectory-title">Score Trajectory Over Time</h3>
          <p className="trajectory-subtitle">
            Progress of all evaluated single drills and full mock interviews (0–10 scale)
          </p>
        </div>
        <div className="trajectory-legend">
          <div className="legend-item">
            <span className="legend-dot legend-dot--score" />
            <span>Score (0–10)</span>
          </div>
          <div className="legend-item">
            <span className="legend-line legend-line--target" />
            <span>Offer-Ready Benchmark (8.0)</span>
          </div>
        </div>
      </div>

      <div className="chart-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="trajectory-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#596044" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#596044" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y Axis */}
          {yTicks.map((tick) => {
            const yPos = getY(tick)
            return (
              <g key={tick} className="grid-group">
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={width - paddingRight}
                  y2={yPos}
                  className="grid-line"
                />
                <text
                  x={paddingLeft - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  className="axis-label axis-label--y"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Benchmark Target Line (8.0) */}
          <line
            x1={paddingLeft}
            y1={benchmarkY}
            x2={width - paddingRight}
            y2={benchmarkY}
            className="benchmark-line"
          />
          <text
            x={width - paddingRight}
            y={benchmarkY - 6}
            textAnchor="end"
            className="benchmark-text"
          >
            Target (8.0)
          </text>

          {/* Area Fill */}
          {areaPath && <path d={areaPath} className="trajectory-area" fill="url(#scoreAreaGradient)" />}

          {/* Line Path */}
          {linePath && <path d={linePath} className="trajectory-line" fill="none" />}

          {/* Data Points */}
          {points.map((p) => {
            const isHovered = hoveredIndex === p.idx
            return (
              <g
                key={p.idx}
                className="point-group"
                style={{ '--pt-idx': p.idx } as React.CSSProperties}
                onMouseEnter={() => setHoveredIndex(p.idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                tabIndex={0}
                role="button"
                aria-label={`Attempt ${p.idx + 1}: score ${p.pt.score}/10`}
              >
                {/* Larger transparent target circle for easy hovering */}
                <circle cx={p.x} cy={p.y} r={14} className="point-hitbox" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6.5 : 4.5}
                  className={`trajectory-point ${isHovered ? 'trajectory-point--hovered' : ''}`}
                />
              </g>
            )
          })}

          {/* X Axis Date labels (First, Middle, Last) */}
          {points.length > 0 && (
            <text
              x={points[0].x}
              y={height - 10}
              textAnchor={points.length === 1 ? 'middle' : 'start'}
              className="axis-label axis-label--x"
            >
              {points[0].pt.date.split(' ')[0]}
            </text>
          )}
          {points.length > 2 && (
            <text
              x={points[Math.floor(points.length / 2)].x}
              y={height - 10}
              textAnchor="middle"
              className="axis-label axis-label--x"
            >
              {points[Math.floor(points.length / 2)].pt.date.split(' ')[0]}
            </text>
          )}
          {points.length > 1 && (
            <text
              x={points[points.length - 1].x}
              y={height - 10}
              textAnchor="end"
              className="axis-label axis-label--x"
            >
              {points[points.length - 1].pt.date.split(' ')[0]}
            </text>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activePoint && (
          <div
            className="trajectory-tooltip"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${Math.max(10, (activePoint.y / height) * 100 - 35)}%`,
            }}
          >
            <div className="tooltip-header">
              <span className="tooltip-type">{activePoint.pt.session_type_label}</span>
              <span className="tooltip-score">{activePoint.pt.score}/10</span>
            </div>
            <div className="tooltip-meta">
              <strong>{activePoint.pt.role}</strong>
              {activePoint.pt.company && <span> @ {activePoint.pt.company}</span>}
              <span className="tooltip-date">{activePoint.pt.date}</span>
            </div>
            {activePoint.pt.feedback_excerpt && (
              <p className="tooltip-feedback">"{activePoint.pt.feedback_excerpt}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
