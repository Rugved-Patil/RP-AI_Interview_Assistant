import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  API_BASE_URL,
  MAX_ANSWER_LENGTH,
  endInterview,
  getPreset,
  gradeInterview,
  startInterview,
  submitInterviewAnswer,
} from '../api/practiceApi'
import type { PresetSummary } from '../api/practiceApi'
import { getActivePresetId, setActivePresetId } from '../activePreset'
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
    }
  | { name: 'error'; message: string }

export function MockInterviewPage() {
  const [stage, setStage] = useState<MockStage>({ name: 'setup' })
  const [interviewType, setInterviewType] = useState<InterviewType>('technical')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('mid')

  const [activePreset, setActivePreset] = useState<ActivePresetState>(() =>
    getActivePresetId() === null ? { status: 'none' } : { status: 'loading' },
  )

  const transcriptEndRef = useRef<HTMLDivElement>(null)

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
    } catch (err) {
      setStage({ name: 'error', message: toMessage(err) })
    }
  }

  async function handleSubmitAnswer() {
    if (stage.name !== 'in_progress') return
    const { sessionId, currentAnswer, transcript } = stage
    const trimmed = currentAnswer.trim()
    if (!trimmed) return

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
      })
    } catch (err) {
      setStage({
        ...stage,
        grading: false,
        error: toMessage(err),
      })
    }
  }

  return (
    <div className="page-section">
      <Link to="/" className="page-back">
        ← All practice modes
      </Link>

      <div className="mock-card">
        <p className="mock-card__eyebrow">Full Mock Interview</p>

        {stage.name === 'setup' && (
          <div className="mock-card__panel">
            <ActivePresetBanner state={activePreset} />

            <div className="mock-form__group">
              <label className="mock-form__label">Interview Focus</label>
              <div className="mock-form__options">
                <button
                  type="button"
                  className={`mock-form__option-btn ${
                    interviewType === 'technical' ? 'mock-form__option-btn--selected' : ''
                  }`}
                  onClick={() => setInterviewType('technical')}
                >
                  <span className="mock-form__option-title">Technical Interview</span>
                  <span className="mock-form__option-desc">
                    Domain depth, systems, practical problem-solving
                  </span>
                </button>
                <button
                  type="button"
                  className={`mock-form__option-btn ${
                    interviewType === 'hr' ? 'mock-form__option-btn--selected' : ''
                  }`}
                  onClick={() => setInterviewType('hr')}
                >
                  <span className="mock-form__option-title">HR / Behavioral</span>
                  <span className="mock-form__option-desc">
                    Culture fit, motivation, interpersonal teamwork
                  </span>
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
              <span className="mock-chat__badge">
                {stage.name === 'in_progress'
                  ? `${stage.interviewType.toUpperCase()} • ${stage.experienceLevel.toUpperCase()}`
                  : 'CONCLUDED'}
              </span>
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
                  <div className="mock-chat__sender">
                    {msg.role === 'interviewer' ? 'AI Interviewer' : 'You'}
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
                  placeholder="Type your response to the interviewer..."
                  rows={4}
                  maxLength={MAX_ANSWER_LENGTH}
                  disabled={stage.submitting}
                />

                {stage.error && <p className="mock-card__error">{stage.error}</p>}

                <div className="mock-card__actions">
                  <button
                    className="mock-card__button"
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
                    Ready to evaluate your full conversation across all questions with Gemini.
                  </p>
                </div>

                {stage.error && <p className="mock-card__error">{stage.error}</p>}

                <div className="mock-card__actions">
                  <button
                    className="mock-card__button"
                    onClick={handleGradeInterview}
                    disabled={stage.grading}
                  >
                    {stage.grading ? 'Grading conversation with Gemini…' : 'Grade interview transcript'}
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
            <h2 className="mock-graded__title">Holistic Feedback</h2>
            <p className="mock-graded__feedback">{stage.feedback}</p>

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
                className="mock-card__button"
                onClick={() => setStage({ name: 'setup' })}
              >
                Start another interview
              </button>
            </div>
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