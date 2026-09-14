import { useState } from 'react'
import { API_BASE_URL, gradeSession, startSituationalSession, submitAnswer } from '../api/practiceApi'
import './PracticeCard.css'

/**
 * A discriminated union models the four stages of one practice attempt.
 * Using one Stage variable (instead of several loose useState calls for
 * sessionId/question/answer/score/etc. separately) means it's impossible
 * to end up in an inconsistent combination - e.g. "submitting" true while
 * there's no session yet. TypeScript narrows `stage` inside each branch
 * below based on `stage.name`, so e.g. `stage.question` is only valid to
 * read where TS already knows `stage.name === 'question'`.
 */
type Stage =
  | { name: 'idle' }
  | { name: 'question'; sessionId: string; question: string; answer: string; submitting: boolean }
  | { name: 'graded'; score: number; feedback: string }
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
      setStage({ name: 'graded', score: grade.score, feedback: grade.feedback })
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
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
          <button className="practice-card__button practice-card__button--ghost" onClick={handleStart}>
            Start another question
          </button>
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

/**
 * The score, ringed by a stroke that draws itself in once on mount - a red-
 * pen circle marking the answer, tied to the grading action that just
 * completed rather than a decorative loop. Respects reduced-motion (see
 * PracticeCard.css) by skipping straight to the finished state.
 */
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
    // fetch() itself throws a TypeError when it can't reach the server at
    // all - connection refused, DNS failure, CORS block, etc. This is the
    // one case where "the backend isn't running" is actually the right guess.
    return `Could not reach the backend at ${API_BASE_URL} — check that it's running.`
  }
  if (err instanceof Error) {
    // Otherwise a real HTTP response came back with an error status (see
    // parseOrThrow in practiceApi.ts) - the backend IS up, something failed
    // server-side instead (a provider outage, an unexpected grader reply,
    // etc.). Show what it actually said rather than a generic guess.
    return err.message
  }
  return 'Something went wrong talking to the backend.'
}