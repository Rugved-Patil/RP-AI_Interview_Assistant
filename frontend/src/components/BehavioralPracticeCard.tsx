import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  API_BASE_URL,
  MAX_ANSWER_LENGTH,
  getPreset,
  gradeSession,
  saveReport,
  startBehavioralSession,
  submitAnswer,
} from '../api/practiceApi'
import type { PresetSummary } from '../api/practiceApi'
import { getActivePresetId, setActivePresetId } from '../activePreset'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import './BehavioralPracticeCard.css'

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

type ActivePresetState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'loaded'; preset: PresetSummary }
  | { status: 'error'; message: string }

export function BehavioralPracticeCard() {
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const [activePreset, setActivePreset] = useState<ActivePresetState>(() =>
    getActivePresetId() === null ? { status: 'none' } : { status: 'loading' },
  )

  // Speech hooks for voice interaction
  const tts = useSpeechSynthesis()

  const stt = useSpeechRecognition({
    onTranscriptChange: (transcript) => {
      setStage((current) => {
        if (current.name !== 'question') return current
        const newAnswer = (current.answer + ' ' + transcript).trim()
        return {
          ...current,
          answer: newAnswer.slice(0, MAX_ANSWER_LENGTH),
        }
      })
    },
  })

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
      const { session_id, question } = await startBehavioralSession({
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
      // Speak the generated question automatically if speech is enabled
      tts.speak(question)
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
    }
  }

  async function handleSubmit() {
    if (stage.name !== 'question') return
    // Stop any ongoing speech
    stt.stopListening()
    tts.cancel()

    const { sessionId, answer } = stage
    setStage({ ...stage, submitting: true, error: null })
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

  function handleStartOver() {
    stt.stopListening()
    tts.cancel()
    setStage({ name: 'idle' })
  }

  return (
    <div className="behavioral-card">
      <p className="behavioral-card__eyebrow">Behavioral questions · STAR Method</p>

      {stage.name === 'idle' && (
        <div className="behavioral-card__panel">
          <ActivePresetBanner state={activePreset} />

          <div className="behavioral-card__star-hint">
            <div className="behavioral-card__star-title">Framework: The STAR Technique</div>
            <div className="behavioral-card__star-grid">
              <div className="behavioral-card__star-item">
                <strong>Situation:</strong> Context & background
              </div>
              <div className="behavioral-card__star-item">
                <strong>Task:</strong> Your goal & responsibility
              </div>
              <div className="behavioral-card__star-item">
                <strong>Action:</strong> Steps you personally took
              </div>
              <div className="behavioral-card__star-item">
                <strong>Result:</strong> Quantifiable outcomes & learnings
              </div>
            </div>
          </div>

          <button
            className="behavioral-card__button"
            onClick={handleStart}
            disabled={activePreset.status !== 'loaded'}
          >
            Start a behavioral question
          </button>
        </div>
      )}

      {stage.name === 'question' && (
        <div className="behavioral-card__panel">
          <div className="behavioral-card__question-header">
            <p className="behavioral-card__question">{stage.question}</p>
            {tts.isSupported && (
              <button
                type="button"
                className={`behavioral-card__voice-btn ${tts.isSpeaking ? 'behavioral-card__voice-btn--active' : ''}`}
                onClick={() => (tts.isSpeaking ? tts.cancel() : tts.speak(stage.question))}
                title="Listen to question"
              >
                {tts.isSpeaking ? '⏹ Stop Audio' : '🔊 Listen'}
              </button>
            )}
          </div>

          <div className="behavioral-card__star-hint" style={{ margin: '1rem 0' }}>
            <div className="behavioral-card__star-grid">
              <div className="behavioral-card__star-item">
                <strong>S:</strong> Set the context
              </div>
              <div className="behavioral-card__star-item">
                <strong>T:</strong> State your task
              </div>
              <div className="behavioral-card__star-item">
                <strong>A:</strong> Detail your actions
              </div>
              <div className="behavioral-card__star-item">
                <strong>R:</strong> Share the result
              </div>
            </div>
          </div>

          <div className="behavioral-card__textarea-wrapper">
            <label className="sr-only" htmlFor="behavioral-answer">
              Your answer
            </label>
            <textarea
              id="behavioral-answer"
              className="behavioral-card__textarea"
              value={stage.answer}
              onChange={(event) => setStage({ ...stage, answer: event.target.value })}
              placeholder="Structure your answer using Situation, Task, Action, and Result..."
              rows={8}
              maxLength={MAX_ANSWER_LENGTH}
              disabled={stage.submitting}
            />

            <div className="behavioral-card__input-toolbar">
              <div>
                {stt.isSupported && (
                  <button
                    type="button"
                    className={`behavioral-card__mic-btn ${
                      stt.isListening ? 'behavioral-card__mic-btn--listening' : ''
                    }`}
                    onClick={stt.toggleListening}
                    disabled={stage.submitting}
                  >
                    {stt.isListening ? '🔴 Stop Dictating' : '🎙 Dictate Answer'}
                  </button>
                )}
                {stt.error && <span style={{ color: 'var(--ink-red)', marginLeft: '0.5rem' }}>{stt.error}</span>}
              </div>
              <div>
                {stage.answer.length} / {MAX_ANSWER_LENGTH} chars
              </div>
            </div>
          </div>

          {stage.error && <p className="behavioral-card__error">{stage.error}</p>}

          <div className="behavioral-card__actions">
            <button
              className="behavioral-card__button"
              onClick={handleSubmit}
              disabled={stage.submitting || stage.answer.trim().length === 0}
            >
              {stage.submitting ? 'Grading with STAR Rubric…' : stage.error ? 'Retry grading' : 'Submit answer'}
            </button>
            {stage.error && (
              <button
                className="behavioral-card__button behavioral-card__button--ghost"
                onClick={handleStartOver}
                disabled={stage.submitting}
              >
                Start over
              </button>
            )}
          </div>
        </div>
      )}

      {stage.name === 'graded' && (
        <div className="behavioral-card__panel">
          <ScoreMark score={stage.score} />
          <p className="behavioral-card__feedback">{stage.feedback}</p>

          <div className="behavioral-card__actions">
            <button
              className="behavioral-card__button behavioral-card__button--ghost"
              onClick={handleSave}
              disabled={stage.saveState === 'saving' || stage.saveState === 'saved'}
            >
              {saveButtonLabel(stage.saveState)}
            </button>
            <button className="behavioral-card__button" onClick={handleStartOver}>
              Start another question
            </button>
          </div>
        </div>
      )}

      {stage.name === 'error' && (
        <div className="behavioral-card__panel">
          <p className="behavioral-card__error">{stage.message}</p>
          <button className="behavioral-card__button" onClick={handleStart}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function ActivePresetBanner({ state }: { state: ActivePresetState }) {
  if (state.status === 'loading') {
    return <p className="behavioral-card__preset-banner">Loading your interview preset…</p>
  }

  if (state.status === 'error') {
    return <p className="behavioral-card__preset-banner">{state.message}</p>
  }

  if (state.status === 'none') {
    return (
      <p className="behavioral-card__preset-banner">
        <span>No interview preset selected.</span>
        <Link to="/presets" className="behavioral-card__preset-change">
          Choose one →
        </Link>
      </p>
    )
  }

  const { role, company, location } = state.preset
  const context = [company, location].filter(Boolean).join(' · ')

  return (
    <p className="behavioral-card__preset-banner">
      <span>
        Practicing as <strong>{role}</strong>
        {context ? ` — ${context}` : ''}
      </span>
      <Link to="/presets" className="behavioral-card__preset-change">
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
