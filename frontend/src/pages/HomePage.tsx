import { Link } from 'react-router-dom'
import './HomePage.css'

export function HomePage() {
  return (
    <div className="home">
      <p className="home__lede">Pick a way to practice.</p>

      <div className="home__modes">
        <Link to="/practice" className="mode-tile mode-tile--live">
          <span className="mode-tile__eyebrow">Ready now</span>
          <h2 className="mode-tile__title">Situational practice</h2>
          <p className="mode-tile__body">
            Answer one question at a time — a self-introduction, a single behavioral prompt, a single technical
            one — and get graded right after.
          </p>
        </Link>

        <Link to="/mock-interview" className="mode-tile mode-tile--placeholder">
          <span className="mode-tile__eyebrow">Phase 2</span>
          <h2 className="mode-tile__title">Full mock interview</h2>
          <p className="mode-tile__body">
            A complete back-and-forth interview with follow-up questions, graded once at the end. Not built yet.
          </p>
        </Link>
      </div>
    </div>
  )
}