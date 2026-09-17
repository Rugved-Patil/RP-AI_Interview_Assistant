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

  async function handleStart() {
    try {
      const { session_id, question } = await startSituationalSession()
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

  return (
    <div className="practice-card">
      <p className="practice-card__eyebrow">Situational practice</p>

      {stage.name === 'idle' && (
        <div className="practice-card__panel practice-card__panel--idle">
          <p className="practice-card__lede">Ready when you are.</p>
          <button className="practice-card__button" onClick={handleStart}>
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
            <button className="practice-card__button" onClick={handleStart}>
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