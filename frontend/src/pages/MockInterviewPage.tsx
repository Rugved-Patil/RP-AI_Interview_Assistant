import { Link } from 'react-router-dom'
import './MockInterviewPage.css'

export function MockInterviewPage() {
  return (
    <div className="page-section">
      <Link to="/" className="page-back">
        ← All practice modes
      </Link>

      <div className="mock-placeholder">
        <p className="mock-placeholder__eyebrow">Phase 2</p>
        <h1 className="mock-placeholder__title">Full mock interview isn't built yet.</h1>
        <p className="mock-placeholder__body">
          This will run a complete HR or technical interview: the AI asks follow-up questions based on what you
          say, and grades the whole conversation at the end instead of one answer at a time.
        </p>
        <Link to="/practice" className="mock-placeholder__cta">
          Try situational practice instead
        </Link>
      </div>
    </div>
  )
}