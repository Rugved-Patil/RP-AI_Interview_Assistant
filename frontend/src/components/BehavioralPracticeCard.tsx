import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
import { UnsavedSessionModal } from './UnsavedSessionModal'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { MicIcon, SpeakerIcon, StopIcon } from './Icons'
import { FormattedFeedback } from './FormattedFeedback'
import { useTranslation } from '../i18n/LanguageContext'
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
  const location = useLocation()
  const { t, currentLanguage } = useTranslation()
  const navState = (location.state || {}) as {
    directQuestion?: string
    domain?: string
    difficulty?: string
  }
  const directQuestion = navState.directQuestion

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
    const role = activePreset.status === 'loaded' ? activePreset.preset.role : 'Candidate'
    const company = activePreset.status === 'loaded' ? activePreset.preset.company : undefined
    const loc = activePreset.status === 'loaded' ? activePreset.preset.location : undefined

    try {
      const { session_id, question } = await startBehavioralSession({
        role,
        company: company ?? undefined,
        location: loc ?? undefined,
        question: directQuestion,
        language: currentLanguage,
      })
      setStage({
        name: 'question',
        sessionId: session_id,
        question,
        answer: '',
        submitting: false,
        error: null,
      })
      // Speak the generated behavioral question
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
    <div className="behavioral-card">
      <UnsavedSessionModal
        isOpen={pendingExitAction !== null}
        isSaving={stage.name === 'graded' && stage.saveState === 'saving'}
        sessionTitle="Behavioral Practice Question"
        onSaveAndProceed={handleModalSaveAndProceed}
        onDiscardAndProceed={handleModalDiscardAndProceed}
        onCancel={() => setPendingExitAction(null)}
      />

      <p className="behavioral-card__eyebrow">{t('practice.behavioral_eyebrow', undefined, 'Behavioral Questions')}</p>

      {stage.name === 'idle' && (
        <div className="behavioral-card__panel">
          {directQuestion ? (
            <div className="targeted-drill-banner">
              <div className="targeted-drill-header">
                <span className="targeted-drill-tag">{t('practice.targeted_drill_tag', undefined, '🎯 Targeted Weak-Spot Drill')}</span>
                {navState.domain && <span className="targeted-drill-domain">{navState.domain}</span>}
              </div>
              <p className="targeted-drill-question">&ldquo;{directQuestion}&rdquo;</p>
            </div>
          ) : (
            <ActivePresetBanner state={activePreset} />
          )}

          <button
            className="behavioral-card__button"
            onClick={handleStart}
            disabled={activePreset.status !== 'loaded' && !directQuestion}
          >
            {directQuestion ? t('practice.start_targeted_drill', undefined, 'Start Targeted Drill') : t('practice.start_behavioral_btn', undefined, 'Start a behavioral question')}
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
                title={tts.isSpeaking ? t('mock.stop_audio', undefined, 'Stop audio') : t('mock.listen_question', undefined, 'Listen to question')}
                aria-label={tts.isSpeaking ? t('mock.stop_audio', undefined, 'Stop audio') : t('mock.listen_question', undefined, 'Listen to question')}
              >
                {tts.isSpeaking ? <StopIcon width={13} height={13} /> : <SpeakerIcon width={15} height={15} />}
              </button>
            )}
          </div>

          <div className="behavioral-card__textarea-wrapper">
            <label className="sr-only" htmlFor="behavioral-answer">
              {t('practice.your_answer', undefined, 'Your Response')}
            </label>
            <textarea
              id="behavioral-answer"
              className="behavioral-card__textarea"
              value={stage.answer}
              onChange={(event) => setStage({ ...stage, answer: event.target.value })}
              placeholder={t('practice.type_placeholder', undefined, 'Structure your answer using the STAR method: Situation, Task, Action, and Result…')}
              rows={8}
              maxLength={MAX_ANSWER_LENGTH}
              disabled={stage.submitting}
            />

            <div className="behavioral-card__input-toolbar">
              <div className="behavioral-card__mic-container">
                {stt.isSupported && (
                  <button
                    type="button"
                    className={`behavioral-card__mic-btn ${
                      stt.isListening ? 'behavioral-card__mic-btn--listening' : ''
                    }`}
                    onClick={stt.toggleListening}
                    disabled={stage.submitting}
                    title={stt.isListening ? t('practice.mic_stop', undefined, 'Stop Dictation') : t('practice.mic_start', undefined, 'Start Voice Dictation')}
                    aria-label={stt.isListening ? t('practice.mic_stop', undefined, 'Stop Dictation') : t('practice.mic_start', undefined, 'Start Voice Dictation')}
                  >
                    <MicIcon width={16} height={16} />
                  </button>
                )}
                {stt.isListening && (
                  <span className="behavioral-card__stt-live">
                    <span className="behavioral-card__pulse-dot" />
                    <span>{t('common.recording', undefined, 'Recording…')}</span>
                  </span>
                )}
                {stt.error && (
                  <span className="behavioral-card__stt-error">{stt.error}</span>
                )}
              </div>
              <div className="behavioral-card__char-counter">
                {stage.answer.length} / {MAX_ANSWER_LENGTH} {t('common.chars', undefined, 'chars')}
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
              {stage.submitting ? t('practice.evaluating', undefined, 'Evaluating Response…') : stage.error ? t('practice.retry_grading', undefined, 'Retry grading') : t('practice.submit_eval', undefined, 'Submit for Evaluation')}
            </button>
            {stage.error && (
              <button
                className="behavioral-card__button behavioral-card__button--ghost"
                onClick={handleStartOver}
                disabled={stage.submitting}
              >
                {t('practice.start_over', undefined, 'Start over')}
              </button>
            )}
          </div>
        </div>
      )}

      {stage.name === 'graded' && (
        <div className="behavioral-card__panel">
          <ScoreMark score={stage.score} />

          <div className="behavioral-card__feedback-header">
            <div className="behavioral-card__feedback-top">
              <span className="behavioral-card__feedback-label">{t('practice.score_title', undefined, 'Diagnostic Performance Assessment')}</span>
              {tts.isSupported && (
                <button
                  type="button"
                  className={`behavioral-card__voice-btn ${tts.isSpeaking ? 'behavioral-card__voice-btn--active' : ''}`}
                  onClick={() => (tts.isSpeaking ? tts.cancel() : tts.speak(stage.feedback))}
                  title={tts.isSpeaking ? t('mock.stop_audio', undefined, 'Stop audio') : t('mock.replay_audio', undefined, 'Listen to feedback')}
                  aria-label={tts.isSpeaking ? t('mock.stop_audio', undefined, 'Stop audio') : t('mock.replay_audio', undefined, 'Listen to feedback')}
                >
                  {tts.isSpeaking ? <StopIcon width={13} height={13} /> : <SpeakerIcon width={14} height={14} />}
                </button>
              )}
            </div>
            <FormattedFeedback content={stage.feedback} className="behavioral-card__feedback" />
          </div>

          <div className="behavioral-card__actions">
            <button
              className="behavioral-card__button behavioral-card__button--ghost"
              onClick={handleSave}
              disabled={stage.saveState === 'saving' || stage.saveState === 'saved'}
            >
              {stage.saveState === 'saved' ? t('practice.saved_success', undefined, 'Report Saved!') : t('practice.save_report', undefined, 'Save Report')}
            </button>
            <button
              className="behavioral-card__button"
              onClick={() => guardedExit(() => {
                tts.cancel()
                setStage({ name: 'idle' })
              })}
            >
              {t('practice.next_question', undefined, 'Next Practice Question →')}
            </button>
          </div>
        </div>
      )}

      {stage.name === 'error' && (
        <div className="behavioral-card__panel">
          <p className="behavioral-card__error">{stage.message}</p>
          <button className="behavioral-card__button" onClick={handleStart}>
            {t('practice.try_again', undefined, 'Try again')}
          </button>
        </div>
      )}
    </div>
  )
}

function ActivePresetBanner({ state }: { state: ActivePresetState }) {
  const { t } = useTranslation()
  if (state.status === 'loading') {
    return <p className="behavioral-card__preset-banner">{t('preset.loading', undefined, 'Loading your interview preset…')}</p>
  }

  if (state.status === 'error') {
    return <p className="behavioral-card__preset-banner">{state.message}</p>
  }

  if (state.status === 'none') {
    return (
      <p className="behavioral-card__preset-banner">
        <span>{t('preset.no_preset', undefined, 'No interview preset selected.')}</span>
        <Link to="/presets" className="behavioral-card__preset-change">
          {t('preset.choose_one', undefined, 'Choose one →')}
        </Link>
      </p>
    )
  }

  const { role, company, location } = state.preset
  const context = [company, location].filter(Boolean).join(' · ')

  return (
    <p className="behavioral-card__preset-banner">
      <span>
        {t('preset.practicing_as', { role }, `Practicing as ${role}`)}
        {context ? ` — ${context}` : ''}
      </span>
      <Link to="/presets" className="behavioral-card__preset-change">
        {t('preset.change_link', undefined, 'Change')}
      </Link>
    </p>
  )
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
