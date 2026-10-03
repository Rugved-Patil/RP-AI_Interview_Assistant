import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  API_BASE_URL,
  MAX_ANSWER_LENGTH,
  endInterview,
  getPreset,
  gradeInterview,
  saveInterviewReport,
  startInterview,
  submitInterviewAnswer,
} from '../api/practiceApi'
import type { InterviewDimensions, PresetSummary } from '../api/practiceApi'
import { getActivePresetId, setActivePresetId } from '../activePreset'
import { UnsavedSessionModal } from '../components/UnsavedSessionModal'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { MicIcon, SpeakerIcon, SpeakerOffIcon, StopIcon } from '../components/Icons'
import { FormattedFeedback } from '../components/FormattedFeedback'
import { useTranslation } from '../i18n/LanguageContext'
import './MockInterviewPage.css'

interface MessageTurn {
  role: 'interviewer' | 'candidate'
  content: string
}

type ActivePresetState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'loaded'; preset: PresetSummary }
  | { status: 'error'; message: string }

type InterviewType = 'hr' | 'technical'
type ExperienceLevel = 'junior' | 'mid' | 'senior'

type MockStage =
  | { name: 'setup' }
  | {
      name: 'in_progress'
      sessionId: string
      interviewType: InterviewType
      experienceLevel: ExperienceLevel
      transcript: MessageTurn[]
      currentAnswer: string
      submitting: boolean
      error: string | null
    }
  | {
      name: 'concluded'
      sessionId: string
      transcript: MessageTurn[]
      grading: boolean
      error: string | null
    }
  | {
      name: 'graded'
      sessionId: string
      transcript: MessageTurn[]
      score: number
      feedback: string
      dimensions?: InterviewDimensions | null
      saving?: boolean
      saved?: boolean
      saveError?: string | null
    }
  | { name: 'error'; message: string }

export function MockInterviewPage() {
  const navigate = useNavigate()
  const { t, currentLanguage } = useTranslation()
  const [searchParams] = useSearchParams()
  const urlType: InterviewType = searchParams.get('type') === 'hr' ? 'hr' : 'technical'
  const [overrideType, setOverrideType] = useState<InterviewType | null>(null)
  const interviewType = overrideType ?? urlType

  const [stage, setStage] = useState<MockStage>({ name: 'setup' })
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('mid')

  const [activePreset, setActivePreset] = useState<ActivePresetState>(() =>
    getActivePresetId() === null ? { status: 'none' } : { status: 'loading' },
  )

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Voice Output (TTS)
  const {
    speak,
    cancel: cancelSpeech,
    toggleMute,
    isMuted,
    isSpeaking: isAiSpeaking,
    isSupported: isTtsSupported,
  } = useSpeechSynthesis()

  // Voice Input (STT) callback to append transcribed text
  const handleTranscriptAppend = useCallback((text: string) => {
    setStage((prev) => {
      if (prev.name !== 'in_progress') return prev
      const current = prev.currentAnswer
      const separator = current.length > 0 && !current.endsWith(' ') ? ' ' : ''
      const combined = (current + separator + text).slice(0, MAX_ANSWER_LENGTH)
      return {
        ...prev,
        currentAnswer: combined,
      }
    })
  }, [])

  const {
    isSupported: isSttSupported,
    isListening,
    error: sttError,
    toggleListening,
    stopListening,
  } = useSpeechRecognition({
    onTranscriptChange: handleTranscriptAppend,
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

  // Auto-scroll transcript on new messages
  useEffect(() => {
    if (stage.name === 'in_progress' || stage.name === 'concluded' || stage.name === 'graded') {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [stage])

  async function handleStart() {
    if (activePreset.status !== 'loaded') return
    const { role, company, location } = activePreset.preset

    try {
      const response = await startInterview({
        interview_type: interviewType,
        experience_level: experienceLevel,
        role,
        company: company ?? undefined,
        location: location ?? undefined,
        language: currentLanguage,
      })

      setStage({
        name: 'in_progress',
        sessionId: response.session_id,
        interviewType,
        experienceLevel,
        transcript: [{ role: 'interviewer', content: response.first_question }],
        currentAnswer: '',
        submitting: false,
        error: null,
      })

      // Speak opening question
      speak(response.first_question)
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
    }
  }

  async function handleSubmitAnswer() {
    if (stage.name !== 'in_progress') return
    const { sessionId, currentAnswer, transcript } = stage
    const trimmed = currentAnswer.trim()
    if (!trimmed) return

    // Stop recording and cancel any speech output before sending
    stopListening()
    cancelSpeech()

    const updatedTranscript: MessageTurn[] = [
      ...transcript,
      { role: 'candidate', content: trimmed },
    ]

    setStage({
      ...stage,
      transcript: updatedTranscript,
      submitting: true,
      error: null,
    })

    try {
      const response = await submitInterviewAnswer(sessionId, trimmed)

      if (response.interview_ended) {
        const finalTranscript: MessageTurn[] = response.interviewer_message
          ? [...updatedTranscript, { role: 'interviewer', content: response.interviewer_message }]
          : updatedTranscript

        setStage({
          name: 'concluded',
          sessionId,
          transcript: finalTranscript,
          grading: false,
          error: null,
        })

        if (response.interviewer_message) {
          speak(response.interviewer_message)
        }
      } else if (response.interviewer_message) {
        setStage({
          ...stage,
          transcript: [
            ...updatedTranscript,
            { role: 'interviewer', content: response.interviewer_message },
          ],
          currentAnswer: '',
          submitting: false,
          error: null,
        })

        speak(response.interviewer_message)
      }
    } catch (err) {
      // Keep candidate answer in state so it isn't lost on network/provider failure
      setStage({
        ...stage,
        transcript, // rollback candidate message from UI to match backend rollback
        submitting: false,
        error: toMessage(err),
      })
    }
  }

  async function handleEndInterviewEarly() {
    if (stage.name !== 'in_progress') return
    const { sessionId, transcript } = stage

    stopListening()
    cancelSpeech()

    try {
      await endInterview(sessionId)
      setStage({
        name: 'concluded',
        sessionId,
        transcript,
        grading: false,
        error: null,
      })
    } catch (err) {
      setStage({
        ...stage,
        error: toMessage(err),
      })
    }
  }

  async function handleGradeInterview() {
    if (stage.name !== 'concluded') return
    const { sessionId, transcript } = stage

    cancelSpeech()
    setStage({
      ...stage,
      grading: true,
      error: null,
    })

    try {
      const grade = await gradeInterview(sessionId)
      setStage({
        name: 'graded',
        sessionId,
        transcript,
        score: grade.score,
        feedback: grade.feedback,
        dimensions: grade.dimensions,
      })
    } catch (err) {
      setStage({
        ...stage,
        grading: false,
        error: toMessage(err),
      })
    }
  }

  async function handleSaveReport() {
    if (stage.name !== 'graded') return
    const { sessionId } = stage

    setStage({
      ...stage,
      saving: true,
      saveError: null,
    })

    try {
      await saveInterviewReport(sessionId)
      setStage({
        ...stage,
        saving: false,
        saved: true,
        saveError: null,
      })
    } catch (err) {
      setStage({
        ...stage,
        saving: false,
        saveError: toMessage(err),
      })
    }
  }

  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null)
  const isUnsavedGraded = stage.name === 'graded' && !stage.saved

  // Warn if user attempts to refresh/close tab with an unsaved graded report
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
    try {
      setStage((prev) => (prev.name === 'graded' ? { ...prev, saving: true } : prev))
      await saveInterviewReport(stage.sessionId)
      setStage((prev) => (prev.name === 'graded' ? { ...prev, saving: false, saved: true } : prev))
      const action = pendingExitAction
      setPendingExitAction(null)
      if (action) action()
    } catch (err) {
      setStage((prev) =>
        prev.name === 'graded'
          ? { ...prev, saving: false, saveError: toMessage(err) }
          : prev,
      )
      setPendingExitAction(null)
    }
  }

  const handleModalDiscardAndProceed = () => {
    const action = pendingExitAction
    setPendingExitAction(null)
    if (action) action()
  }

  return (
    <div className="page-section">
      <UnsavedSessionModal
        isOpen={pendingExitAction !== null}
        isSaving={stage.name === 'graded' && Boolean(stage.saving)}
        sessionTitle="Mock Interview Report"
        onSaveAndProceed={handleModalSaveAndProceed}
        onDiscardAndProceed={handleModalDiscardAndProceed}
        onCancel={() => setPendingExitAction(null)}
      />

      <button
        type="button"
        className="page-back"
        onClick={() => {
          stopListening()
          cancelSpeech()
          guardedExit(() => {
            if (window.history.length > 1) {
              navigate(-1)
            } else {
              navigate('/')
            }
          })
        }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        {t('nav.back', undefined, '← Back')}
      </button>

      <div className="mock-card">
        <p className="mock-card__eyebrow">
          Full Mock Interview · {interviewType === 'hr' ? 'HR & Behavioral' : 'Technical'}
        </p>

        {stage.name === 'setup' && (
          <div className="mock-card__panel">
            <ActivePresetBanner state={activePreset} />

            <div className="mock-form__group">
              <label className="mock-form__label">Interview Focus</label>
              <div className="mock-form__segmented">
                <button
                  type="button"
                  className={`mock-form__segment-btn ${
                    interviewType === 'technical' ? 'mock-form__segment-btn--selected' : ''
                  }`}
                  onClick={() => setOverrideType('technical')}
                >
                  Technical
                </button>
                <button
                  type="button"
                  className={`mock-form__segment-btn ${
                    interviewType === 'hr' ? 'mock-form__segment-btn--selected' : ''
                  }`}
                  onClick={() => setOverrideType('hr')}
                >
                  HR & Behavioral
                </button>
              </div>
            </div>

            <div className="mock-form__group">
              <label className="mock-form__label">Experience Level</label>
              <div className="mock-form__segmented">
                {(['junior', 'mid', 'senior'] as ExperienceLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`mock-form__segment-btn ${
                      experienceLevel === level ? 'mock-form__segment-btn--selected' : ''
                    }`}
                    onClick={() => setExperienceLevel(level)}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mock-card__actions">
              <button
                className="mock-card__button"
                onClick={handleStart}
                disabled={activePreset.status !== 'loaded'}
              >
                Start Mock Interview
              </button>
            </div>
          </div>
        )}

        {(stage.name === 'in_progress' || stage.name === 'concluded') && (
          <div className="mock-card__panel mock-chat__container">
            <div className="mock-chat__header">
              <div className="mock-chat__header-left">
                <span className="mock-chat__badge">
                  {stage.name === 'in_progress'
                    ? `${stage.interviewType.toUpperCase()} • ${stage.experienceLevel.toUpperCase()}`
                    : 'CONCLUDED'}
                </span>
                {isTtsSupported && (
                  <button
                    type="button"
                    className={`mock-voice__toggle-btn ${
                      isMuted ? 'mock-voice__toggle-btn--muted' : ''
                    }`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
                    aria-label={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
                  >
                    {isMuted ? <SpeakerOffIcon width={15} height={15} /> : <SpeakerIcon width={15} height={15} />}
                  </button>
                )}
              </div>
              {stage.name === 'in_progress' && (
                <button
                  type="button"
                  className="mock-chat__end-btn"
                  onClick={handleEndInterviewEarly}
                  disabled={stage.submitting}
                >
                  End interview early
                </button>
              )}
            </div>

            <div className="mock-chat__transcript">
              {stage.transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mock-chat__bubble mock-chat__bubble--${msg.role}`}
                >
                  <div className="mock-chat__sender-line">
                    <div className="mock-chat__sender">
                      {msg.role === 'interviewer' ? 'AI Interviewer' : 'You'}
                    </div>
                    {msg.role === 'interviewer' && isTtsSupported && (
                      <button
                        type="button"
                        className="mock-voice__replay-btn"
                        onClick={() => speak(msg.content)}
                        title="Replay audio"
                        aria-label="Replay audio"
                      >
                        <SpeakerIcon width={13} height={13} />
                      </button>
                    )}
                  </div>
                  <div className="mock-chat__message">{msg.content}</div>
                </div>
              ))}

              {stage.name === 'in_progress' && stage.submitting && (
                <div className="mock-chat__bubble mock-chat__bubble--interviewer">
                  <div className="mock-chat__sender">AI Interviewer</div>
                  <div className="mock-chat__typing">
                    <span>•</span>
                    <span>•</span>
                    <span>•</span>
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>

            {stage.name === 'in_progress' && (
              <div className="mock-chat__input-area">
                <div className="mock-chat__textarea-wrapper">
                  <label htmlFor="mock-answer" className="sr-only">
                    Your answer
                  </label>
                  <textarea
                    id="mock-answer"
                    className="mock-chat__textarea"
                    value={stage.currentAnswer}
                    onChange={(e) =>
                      setStage({ ...stage, currentAnswer: e.target.value })
                    }
                    placeholder={
                      isListening
                        ? 'Listening… Speak your response'
                        : 'Type your response to the interviewer...'
                    }
                    rows={4}
                    maxLength={MAX_ANSWER_LENGTH}
                    disabled={stage.submitting}
                  />

                  {isListening && (
                    <div className="mock-voice__listening-badge">
                      <span className="mock-voice__pulse-dot" aria-hidden="true" />
                      <span>Recording…</span>
                    </div>
                  )}

                  {isAiSpeaking && (
                    <div className="mock-voice__speaking-badge">
                      <div className="mock-voice__speaking-indicator">
                        <SpeakerIcon width={13} height={13} />
                        <span>Speaking…</span>
                      </div>
                      <button
                        type="button"
                        className="mock-voice__stop-speech-btn"
                        onClick={cancelSpeech}
                        title="Stop audio"
                        aria-label="Stop audio"
                      >
                        <StopIcon width={12} height={12} />
                      </button>
                    </div>
                  )}
                </div>

                {sttError && <p className="mock-card__error">{sttError}</p>}
                {stage.error && <p className="mock-card__error">{stage.error}</p>}

                <div className="mock-card__actions mock-chat__actions">
                  {isSttSupported && (
                    <button
                      type="button"
                      className={`mock-voice__mic-btn ${
                        isListening ? 'mock-voice__mic-btn--listening' : ''
                      }`}
                      onClick={() => {
                        cancelSpeech()
                        toggleListening()
                      }}
                      disabled={stage.submitting}
                      title={isListening ? 'Stop recording' : 'Dictate response'}
                      aria-label={isListening ? 'Stop recording' : 'Dictate response'}
                    >
                      <MicIcon width={16} height={16} />
                    </button>
                  )}

                  <button
                    className="mock-card__button mock-chat__send-btn"
                    onClick={handleSubmitAnswer}
                    disabled={stage.submitting || stage.currentAnswer.trim().length === 0}
                  >
                    {stage.submitting ? 'Sending…' : 'Send response'}
                  </button>
                </div>
              </div>
            )}

            {stage.name === 'concluded' && (
              <div className="mock-concluded__panel">
                <div className="mock-concluded__header">
                  <h2 className="mock-concluded__title">Interview Complete</h2>
                  <p className="mock-concluded__desc">
                    Ready to evaluate your full conversation across all questions with the diagnostic assessment engine.
                  </p>
                </div>

                {stage.error && <p className="mock-card__error">{stage.error}</p>}

                <div className="mock-card__actions">
                  <button
                    className="mock-card__button"
                    onClick={handleGradeInterview}
                    disabled={stage.grading}
                  >
                    {stage.grading ? 'Generating diagnostic assessment…' : 'Grade interview transcript'}
                  </button>
                  <button
                    className="mock-card__button mock-card__button--ghost"
                    onClick={() => setStage({ name: 'setup' })}
                    disabled={stage.grading}
                  >
                    Start over
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {stage.name === 'graded' && (
          <div className="mock-card__panel">
            <ScoreMark score={stage.score} />

            {stage.dimensions && <DimensionsBreakdown dimensions={stage.dimensions} />}

            <h2 className="mock-graded__title">Holistic Feedback</h2>
            <FormattedFeedback content={stage.feedback} className="mock-graded__feedback" />

            <details className="mock-graded__transcript-details">
              <summary className="mock-graded__transcript-summary">
                View full transcript ({stage.transcript.length} messages)
              </summary>
              <div className="mock-chat__transcript mock-chat__transcript--compact">
                {stage.transcript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`mock-chat__bubble mock-chat__bubble--${msg.role}`}
                  >
                    <div className="mock-chat__sender">
                      {msg.role === 'interviewer' ? 'AI Interviewer' : 'You'}
                    </div>
                    <div className="mock-chat__message">{msg.content}</div>
                  </div>
                ))}
              </div>
            </details>

            <div className="mock-card__actions">
              <button
                type="button"
                className="mock-card__button"
                onClick={handleSaveReport}
                disabled={stage.saving || stage.saved}
              >
                {stage.saved
                  ? '✓ Saved to reports'
                  : stage.saving
                    ? 'Saving report…'
                    : 'Save this interview report'}
              </button>
              <button
                className="mock-card__button mock-card__button--ghost"
                onClick={() => guardedExit(() => setStage({ name: 'setup' }))}
              >
                Start another interview
              </button>
            </div>

            {stage.saveError && <p className="mock-card__error">{stage.saveError}</p>}
          </div>
        )}

        {stage.name === 'error' && (
          <div className="mock-card__panel">
            <p className="mock-card__error">{stage.message}</p>
            <button className="mock-card__button" onClick={() => setStage({ name: 'setup' })}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface DimensionConfigItem {
  key: keyof InterviewDimensions
  label: string
  description: string
}

const DIMENSION_CONFIG: DimensionConfigItem[] = [
  {
    key: 'technical_correctness',
    label: 'Technical Correctness',
    description: 'Factual accuracy and correct application of domain concepts',
  },
  {
    key: 'depth_of_knowledge',
    label: 'Depth of Knowledge',
    description: 'Mechanisms, trade-offs, and reasoning beyond surface-level definitions',
  },
  {
    key: 'problem_solving',
    label: 'Problem Solving',
    description: 'Decomposition, constraint evaluation, and adaptive logical deduction',
  },
  {
    key: 'communication',
    label: 'Communication',
    description: 'Clarity, conciseness, structured delivery, and technical coherence',
  },
  {
    key: 'practical_readiness',
    label: 'Practical Readiness',
    description: 'Implementation thinking, production readiness, and failure considerations',
  },
]

function DimensionsBreakdown({ dimensions }: { dimensions: InterviewDimensions }) {
  return (
    <div className="mock-dimensions">
      <div className="mock-dimensions__header">
        <h3 className="mock-dimensions__title">Diagnostic Dimensions</h3>
        <p className="mock-dimensions__subtitle">
          Dimension scores explain specific aspects of performance. The overall score is your primary holistic evaluation.
        </p>
      </div>

      <div className="mock-dimensions__list">
        {DIMENSION_CONFIG.map(({ key, label, description }) => {
          const val = dimensions[key]
          if (typeof val !== 'number') return null
          const pct = Math.max(0, Math.min(100, val * 10))
          return (
            <div key={key} className="mock-dimensions__item">
              <div className="mock-dimensions__item-header">
                <div className="mock-dimensions__item-info">
                  <span className="mock-dimensions__item-label">{label}</span>
                  <span className="mock-dimensions__item-desc">{description}</span>
                </div>
                <span className="mock-dimensions__item-score">
                  <strong>{val}</strong>
                  <span className="mock-dimensions__item-denom">/10</span>
                </span>
              </div>
              <div className="mock-dimensions__bar-track" aria-hidden="true">
                <div
                  className="mock-dimensions__bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mock-dimensions__footer-note">
        <em>Note:</em> Practical readiness reflects evidence verified in this interview. If coding or live debugging was not tested, a moderate score denotes unverified scope rather than a performance flaw.
      </div>
    </div>
  )
}

function ActivePresetBanner({ state }: { state: ActivePresetState }) {
  if (state.status === 'loading') {
    return <p className="mock-card__preset-banner">Loading your interview preset…</p>
  }

  if (state.status === 'error') {
    return <p className="mock-card__preset-banner">{state.message}</p>
  }

  if (state.status === 'none') {
    return (
      <p className="mock-card__preset-banner">
        <span>No interview preset selected.</span>
        <Link to="/presets" className="mock-card__preset-change">
          Choose one →
        </Link>
      </p>
    )
  }

  const { role, company, location } = state.preset
  const context = [company, location].filter(Boolean).join(' · ')

  return (
    <p className="mock-card__preset-banner">
      <span>
        Target role: <strong>{role}</strong>
        {context ? ` — ${context}` : ''}
      </span>
      <Link to="/presets" className="mock-card__preset-change">
        Change
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