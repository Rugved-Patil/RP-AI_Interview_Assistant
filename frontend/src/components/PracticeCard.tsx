import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  API_BASE_URL,
  MAX_ANSWER_LENGTH,
  getPreset,
  gradeSession,
  saveReport,
  startSituationalSession,
  submitAnswer,
} from '../api/practiceApi'
import type { PresetSummary } from '../api/practiceApi'
import { getActivePresetId, setActivePresetId } from '../activePreset'
import { UnsavedSessionModal } from './UnsavedSessionModal'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { MicIcon, SpeakerIcon, StopIcon } from './Icons'
import { FormattedFeedback } from './FormattedFeedback'
import './PracticeCard.css'

/**
 * A discriminated union models the four stages of one practice attempt.
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

type ActivePresetState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'loaded'; preset: PresetSummary }
  | { status: 'error'; message: string }

export function PracticeCard() {
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const [activePreset, setActivePreset] = useState<ActivePresetState>(() =>
    getActivePresetId() === null ? { status: 'none' } : { status: 'loading' },
  )

  // Speech hooks for voice interaction (TTS & STT)
  const tts = useSpeechSynthesis()

  const stt = useSpeechRecognition({
    onTranscriptChange: (transcript) => {
      setStage((current) => {
        if (current.name !== 'question') return current
        const separator = current.answer.length > 0 && !current.answer.endsWith(' ') ? ' ' : ''
        const newAnswer = (current.answer + separator + transcript).trim()
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
      // Speak the generated question
      tts.speak(question)
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
    }
  }

  async function handleSubmit() {
    if (stage.name !== 'question') return
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

  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null)
  const isUnsavedGraded = stage.name === 'graded' && stage.saveState !== 'saved'

  // Warn on browser tab close/refresh if graded session is unsaved
  useEffect(() => {
    if (!isUnsavedGraded) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isUnsavedGraded])

  const guardedExit = (action: () => void) => {
    if (isUnsavedGraded) {
      setPendingExitAction(() => action)
    } else {
      action()
    }
  }

  const handleModalSaveAndProceed = async () => {
    if (stage.name !== 'graded') return
    setStage({ ...stage, saveState: 'saving' })
    try {
      await saveReport(stage.sessionId)
      setStage((current) => (current.name === 'graded' ? { ...current, saveState: 'saved' } : current))
      const action = pendingExitAction
      setPendingExitAction(null)
      if (action) action()
    } catch {
      setStage((current) => (current.name === 'graded' ? { ...current, saveState: 'error' } : current))
      setPendingExitAction(null)
    }
  }

  const handleModalDiscardAndProceed = () => {
    const action = pendingExitAction
    setPendingExitAction(null)
    if (action) action()
  }

  function handleStartOver() {
    stt.stopListening()
    tts.cancel()
    guardedExit(() => setStage({ name: 'idle' }))
  }

  return (
    <div className="practice-card">
      <UnsavedSessionModal
        isOpen={pendingExitAction !== null}
        isSaving={stage.name === 'graded' && stage.saveState === 'saving'}
        sessionTitle="Technical Practice Question"
        onSaveAndProceed={handleModalSaveAndProceed}
        onDiscardAndProceed={handleModalDiscardAndProceed}
        onCancel={() => setPendingExitAction(null)}
      />

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
          <div className="practice-card__question-header">
            <p className="practice-card__question">{stage.question}</p>
            {tts.isSupported && (
              <button
                type="button"
                className={`practice-card__voice-btn ${tts.isSpeaking ? 'practice-card__voice-btn--active' : ''}`}
                onClick={() => (tts.isSpeaking ? tts.cancel() : tts.speak(stage.question))}
                title={tts.isSpeaking ? 'Stop audio' : 'Listen to question'}
                aria-label={tts.isSpeaking ? 'Stop audio' : 'Listen to question'}
              >
                {tts.isSpeaking ? <StopIcon width={13} height={13} /> : <SpeakerIcon width={15} height={15} />}
              </button>
            )}
          </div>

          <div className="practice-card__textarea-wrapper">
            <label className="sr-only" htmlFor="answer">
              Your answer
            </label>
            <textarea
              id="answer"
              className="practice-card__textarea"
              value={stage.answer}
              onChange={(event) => setStage({ ...stage, answer: event.target.value })}
              placeholder="Type or dictate your answer here..."
              rows={8}
              maxLength={MAX_ANSWER_LENGTH}
              disabled={stage.submitting}
            />

            <div className="practice-card__input-toolbar">
              <div className="practice-card__mic-container">
                {stt.isSupported && (
                  <button
                    type="button"
                    className={`practice-card__mic-btn ${
                      stt.isListening ? 'practice-card__mic-btn--listening' : ''
                    }`}
                    onClick={stt.toggleListening}
                    disabled={stage.submitting}
                    title={stt.isListening ? 'Stop dictating' : 'Dictate answer with microphone'}
                    aria-label={stt.isListening ? 'Stop dictating' : 'Dictate answer with microphone'}
                  >
                    <MicIcon width={16} height={16} />
                  </button>
                )}
                {stt.isListening && (
                  <span className="practice-card__stt-live">
                    <span className="practice-card__pulse-dot" />
                    <span>Recording…</span>
                  </span>
                )}
                {stt.error && (
                  <span className="practice-card__stt-error">{stt.error}</span>
                )}
              </div>
              <div className="practice-card__char-counter">
                {stage.answer.length} / {MAX_ANSWER_LENGTH} chars
              </div>
            </div>
          </div>

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
        <div className="practice-card__panel">
          <ScoreMark score={stage.score} />
          
          <div className="practice-card__feedback-header">
            <div className="practice-card__feedback-top">
              <span className="practice-card__feedback-label">Diagnostic Feedback</span>
              {tts.isSupported && (
                <button
                  type="button"
                  className={`practice-card__voice-btn ${tts.isSpeaking ? 'practice-card__voice-btn--active' : ''}`}
                  onClick={() => (tts.isSpeaking ? tts.cancel() : tts.speak(stage.feedback))}
                  title={tts.isSpeaking ? 'Stop feedback audio' : 'Listen to feedback'}
                  aria-label={tts.isSpeaking ? 'Stop feedback audio' : 'Listen to feedback'}
                >
                  {tts.isSpeaking ? <StopIcon width={13} height={13} /> : <SpeakerIcon width={14} height={14} />}
                </button>
              )}
            </div>
            <FormattedFeedback content={stage.feedback} className="practice-card__feedback" />
          </div>

          <div className="practice-card__actions">
            <button
              className="practice-card__button practice-card__button--ghost"
              onClick={handleSave}
              disabled={stage.saveState === 'saving' || stage.saveState === 'saved'}
            >
              {saveButtonLabel(stage.saveState)}
            </button>
            <button
              className="practice-card__button"
              onClick={() => guardedExit(() => {
                tts.cancel()
                setStage({ name: 'idle' })
              })}
            >
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