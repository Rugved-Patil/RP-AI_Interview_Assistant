import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  API_BASE_URL,
  getPreset,
  gradeSession,
  saveReport,
  startSituationalSession,
  submitAnswer,
} from '../api/practiceApi'
import type { PresetSummary } from '../api/practiceApi'
import { getActivePresetId, setActivePresetId } from '../activePreset'
import './PracticeCard.css'

/**
 * A discriminated union models the four stages of one practice attempt.
 * `question` carries its own `error` so a failed grading attempt keeps the
 * user on the question with their typed answer intact, instead of dropping
 * them into the generic `error` stage (which can only restart from scratch).
 * `graded` also carries `sessionId` (needed to call the save endpoint)
 * and `saveState` - the opt-in save action is a sub-state of being
 * graded, not a separate stage, since you're still looking at the same
 * panel.
 */
type Stage =
  | { name: 'idle' }
  | {
      name: 'question'
      sessionId: string
      question: string
      answer: string
      submitting: boolean
      error: string | null
    }
  | {
      name: 'graded'
      sessionId: string
      score: number
      feedback: string
      saveState: 'unsaved' | 'saving' | 'saved' | 'error'
    }
  | { name: 'error'; message: string }

/**
 * Which interview preset the technical question gets built from. Resolved
 * from activePreset.ts's localStorage pointer, fetched fresh on every mount
 * (i.e. every time this page is navigated to) so a change made on the
 * Presets page is always picked up.
 */
type ActivePresetState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'loaded'; preset: PresetSummary }
  | { status: 'error'; message: string }

export function PracticeCard() {
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  // Lazy initial state: whether a preset id is stored is knowable
  // synchronously (it's a localStorage read), so "none" is decided here
  // instead of by calling setState inside the effect below - that's what
  // the react-hooks/set-state-in-effect lint rule objects to.
  const [activePreset, setActivePreset] = useState<ActivePresetState>(() =>
    getActivePresetId() === null ? { status: 'none' } : { status: 'loading' },
  )

  useEffect(() => {
    let cancelled = false
    const id = getActivePresetId()
    if (id !== null) {
      getPreset(id)
        .then((preset) => {
          if (!cancelled) setActivePreset({ status: 'loaded', preset })
        })
        .catch((err) => {
          if (cancelled) return
          // A 404 here means the active preset was deleted from another
          // page/tab since this pointer was saved - clear the stale
          // pointer instead of showing a permanent error for it.
          if (err instanceof Error && err.message.includes('(404)')) {
            setActivePresetId(null)
            setActivePreset({ status: 'none' })
          } else {
            setActivePreset({ status: 'error', message: 'Could not load your interview preset.' })
          }
        })
    }
    return () => {
      cancelled = true
    }
  }, [])

  async function handleStart() {
    if (activePreset.status !== 'loaded') return
    const { role, company, location } = activePreset.preset
    try {
      const { session_id, question } = await startSituationalSession({
        role,
        company: company ?? undefined,
        location: location ?? undefined,
      })
      setStage({
        name: 'question',
        sessionId: session_id,
        question,
        answer: '',
        submitting: false,
        error: null,
      })
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
    }
  }

  async function handleSubmit() {
    if (stage.name !== 'question') return
    const { sessionId, answer } = stage
    setStage({ ...stage, submitting: true, error: null })
    try {
      // Re-sending the answer on a retry is harmless: the backend just
      // overwrites session.answer with the same text (or the edited text).
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
      // Stay on the question with the typed answer preserved, so a failed
      // grade (e.g. a free-tier rate limit) costs the user a retry click,
      // not their whole answer.
      setStage({ ...stage, submitting: false, error: toMessage(err) })
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
      <p className="practice-card__eyebrow">Technical questions</p>

      {stage.name === 'idle' && (
        <div className="practice-card__panel">
          <ActivePresetBanner state={activePreset} />
          <button
            className="practice-card__button"
            onClick={handleStart}
            disabled={activePreset.status !== 'loaded'}
          >
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

          {stage.error && <p className="practice-card__error">{stage.error}</p>}

          <div className="practice-card__actions">
            <button
              className="practice-card__button"
              onClick={handleSubmit}
              disabled={stage.submitting || stage.answer.trim().length === 0}
            >
              {stage.submitting ? 'Grading…' : stage.error ? 'Retry grading' : 'Submit answer'}
            </button>
            {stage.error && (
              <button
                className="practice-card__button practice-card__button--ghost"
                onClick={() => setStage({ name: 'idle' })}
                disabled={stage.submitting}
              >
                Start over
              </button>
            )}
          </div>
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
            <button className="practice-card__button" onClick={() => setStage({ name: 'idle' })}>
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

function ActivePresetBanner({ state }: { state: ActivePresetState }) {
  if (state.status === 'loading') {
    return <p className="practice-card__preset-banner">Loading your interview preset…</p>
  }

  if (state.status === 'error') {
    return <p className="practice-card__preset-banner">{state.message}</p>
  }

  if (state.status === 'none') {
    return (
      <p className="practice-card__preset-banner">
        <span>No interview preset selected.</span>
        <Link to="/presets" className="practice-card__preset-change">
          Choose one →
        </Link>
      </p>
    )
  }

  const { role, company, location } = state.preset
  const context = [company, location].filter(Boolean).join(' · ')

  return (
    <p className="practice-card__preset-banner">
      <span>
        Practicing as <strong>{role}</strong>
        {context ? ` — ${context}` : ''}
      </span>
      <Link to="/presets" className="practice-card__preset-change">
        Change
      </Link>
    </p>
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