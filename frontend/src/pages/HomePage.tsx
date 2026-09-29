import { Link } from 'react-router-dom'
import './HomePage.css'

export function HomePage() {
  return (
    <div className="home">
      <p className="home__lede">Pick a way to practice.</p>

      <div className="home__modes">
        <Link to="/practice" className="mode-tile mode-tile--live">
          <span className="mode-tile__eyebrow">Ready now</span>
          <h2 className="mode-tile__title">Technical questions</h2>
          <p className="mode-tile__body">
            Answer one technical question at a time, tailored to your role, and get graded right after.
          </p>
        </Link>

        <Link to="/practice/behavioral" className="mode-tile mode-tile--live">
          <span className="mode-tile__eyebrow">Ready now · STAR Rubric</span>
          <h2 className="mode-tile__title">Behavioral questions</h2>
          <p className="mode-tile__body">
            Practice storytelling with open-ended behavioral questions and get scored on the STAR framework.
          </p>
        </Link>

        <Link to="/mock-interview" className="mode-tile mode-tile--live">
          <span className="mode-tile__eyebrow">Ready now · Voice & Text</span>
          <h2 className="mode-tile__title">Full mock interview</h2>
          <p className="mode-tile__body">
            A complete back-and-forth interview with follow-up questions, graded holistically at the end.
          </p>
        </Link>
      </div>
    </div>
  )
}