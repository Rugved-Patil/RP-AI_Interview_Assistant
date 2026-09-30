import { Link } from 'react-router-dom'
import './HomePage.css'

export function HomePage() {
  return (
    <div className="home">
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
            <h3 className="mode-card__title">HR & Behavioral Mock</h3>
            <p className="mode-card__body">
              A complete interview exploring past experience, culture fit, teamwork, and decision-making.
            </p>
          </Link>
        </div>
      </section>

      <section className="home__section">
        <div className="home__section-header">
          <h2 className="home__section-title">Preparation Insights & Tools</h2>
          <p className="home__section-desc">
            Track historical mastery trajectories, explore curated questions, and configure role presets.
          </p>
        </div>

        <div className="home__grid">
          <Link to="/analytics" className="mode-card">
            <span className="mode-card__badge mode-card__badge--accent">Phase 4 Analytics</span>
            <h3 className="mode-card__title">Progress & Analytics</h3>
            <p className="mode-card__body">
              Visual score trajectory (0–10), domain competency radar, weak-spot gap analysis, and delivery insights.
            </p>
          </Link>

          <Link to="/questions" className="mode-card">
            <span className="mode-card__badge">Question Library</span>
            <h3 className="mode-card__title">Question Bank Explorer</h3>
            <p className="mode-card__body">
              Browse curated exemplar questions with sublinear TF-IDF + BM25 vector search and evaluation rubrics.
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}