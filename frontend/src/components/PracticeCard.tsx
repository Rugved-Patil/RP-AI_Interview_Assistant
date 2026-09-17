import { useState } from 'react'
import {
  API_BASE_URL,
  gradeSession,
  saveReport,
  startSituationalSession,
  submitAnswer,
} from '../api/practiceApi'
import './PracticeCard.css'

/**
 * A discriminated union models the four stages of one practice attempt.
 * `graded` now also carries `sessionId` (needed to call the save endpoint)
 * and `saveState` - the opt-in save action is a sub-state of being graded,
 * not a separate stage, since you're still looking at the same panel.
 *
 * role/company/location are NOT part of Stage - they're the setup form's
 * own state (below), independent of which stage the attempt is in. Per
 * the "no memory" decision, they get reset to blank whenever the user
 * starts a fresh attempt (see handleStartAnother), rather than persisting
 * across attempts or page visits.
 */
type Stage =
  | { name: 'idle' }
  | { name: 'question'; sessionId: string; question: string; answer: string; submitting: boolean }
  | {
      name: 'graded'
      sessionId: string
      score: number
      feedback: string
      saveState: 'unsaved' | 'saving' | 'saved' | 'error'
    }
  | { name: 'error'; message: string }

export function PracticeCard() {
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')

  const canStart = role.trim().length > 0

  async function handleStart() {
    if (!canStart) return
    try {
      const { session_id, question } = await startSituationalSession({
        role: role.trim(),
        company: company.trim() || undefined,
        location: location.trim() || undefined,
      })
      setStage({ name: 'question', sessionId: session_id, question, answer: '', submitting: false })
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
    }
  }

  async function handleSubmit() {
    if (stage.name !== 'question') return
    const { sessionId, answer } = stage
    setStage({ ...stage, submitting: true })
    try {
      await submitAnswer(sessionId, answer)
      const grade = await gradeSession(sessionId)
      setStage({
        name: 'graded',
        sessionId,
        score: grade.score,
        feedback: grade.feedback,
        saveState: 'unsaved',
      })
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
    }
  }

  async function handleSave() {
    if (stage.name !== 'graded') return
    const { sessionId } = stage
    setStage({ ...stage, saveState: 'saving' })
    try {
      await saveReport(sessionId)
      setStage((current) => (current.name === 'graded' ? { ...current, saveState: 'saved' } : current))
    } catch {
      setStage((current) => (current.name === 'graded' ? { ...current, saveState: 'error' } : current))
    }
  }

  /**
   * Returns to the setup form with blank fields for a new attempt. Used
   * from the `graded` panel's "Start another question" - deliberately
   * distinct from `handleStart`, which reuses whatever role/company/
   * location are currently in the form (e.g. for the `error` panel's
   * "Try again", where retrying the same attempt with the same context
   * makes more sense than forcing a re-type).
   */
  function handleStartAnother() {
    setRole('')
    setCompany('')
    setLocation('')
    setStage({ name: 'idle' })
  }

  return (
    <div className="practice-card">
      <p className="practice-card__eyebrow">Situational practice</p>

      {stage.name === 'idle' && (
        <div className="practice-card__panel practice-card__panel--idle">
          <p className="practice-card__lede">Set up your question.</p>

          <div className="practice-card__field">
            <label className="practice-card__field-label" htmlFor="role">
              Role
            </label>
            <input
              id="role"
              className="practice-card__input"
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. Backend Engineer"
            />
          </div>

          <div className="practice-card__field">
            <label className="practice-card__field-label" htmlFor="company">
              Company <span className="practice-card__field-optional">(optional)</span>
            </label>
            <input
              id="company"
              className="practice-card__input"
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="practice-card__field">
            <label className="practice-card__field-label" htmlFor="location">
              Location <span className="practice-card__field-optional">(optional)</span>
            </label>
            <input
              id="location"
              className="practice-card__input"
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Bengaluru, India"
            />
          </div>

          <button className="practice-card__button" onClick={handleStart} disabled={!canStart}>
            Start a practice question
          </button>
        </div>
      )}

      {stage.name === 'question' && (
        <div className="practice-card__panel">
          <p className="practice-card__question">{stage.question}</p>

          <label className="sr-only" htmlFor="answer">
            Your answer
          </label>
          <textarea
            id="answer"
            className="practice-card__textarea"
            value={stage.answer}
            onChange={(event) => setStage({ ...stage, answer: event.target.value })}
            placeholder="Type your answer here..."
            rows={8}
            disabled={stage.submitting}
          />

          <button
            className="practice-card__button"
            onClick={handleSubmit}
            disabled={stage.submitting || stage.answer.trim().length === 0}
          >
            {stage.submitting ? 'Grading…' : 'Submit answer'}
          </button>
        </div>
      )}

      {stage.name === 'graded' && (
        <div className="practice-card__panel">
          <ScoreMark score={stage.score} />
          <p className="practice-card__feedback">{stage.feedback}</p>

          <div className="practice-card__actions">
            <button
              className="practice-card__button practice-card__button--ghost"
              onClick={handleSave}
              disabled={stage.saveState === 'saving' || stage.saveState === 'saved'}
            >
              {saveButtonLabel(stage.saveState)}
            </button>
            <button className="practice-card__button" onClick={handleStartAnother}>
              Start another question
            </button>
          </div>
        </div>
      )}

      {stage.name === 'error' && (
        <div className="practice-card__panel">
          <p className="practice-card__error">{stage.message}</p>
          <button className="practice-card__button" onClick={handleStart}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function saveButtonLabel(saveState: 'unsaved' | 'saving' | 'saved' | 'error'): string {
  switch (saveState) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved ✓'
    case 'error':
      return 'Save failed — retry'
    default:
      return 'Save this report'
  }
}

function ScoreMark({ score }: { score: number }) {
  return (
    <div className="score-mark">
      <svg viewBox="0 0 96 96" className="score-mark__ring" aria-hidden="true">
        <circle cx="48" cy="48" r="42" />
      </svg>
      <span className="score-mark__value">
        {score}
        <span className="score-mark__denominator">/10</span>
      </span>
    </div>
  )
}

function toMessage(err: unknown): string {
  if (err instanceof TypeError) {
    return `Could not reach the backend at ${API_BASE_URL} — check that it's running.`
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Something went wrong talking to the backend.'
}