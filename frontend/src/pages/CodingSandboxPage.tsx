import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getCodingProblem,
  gradeCodingSubmission,
  listCodingProblems,
  runCodeInSandbox,
  type CodingProblem,
  type CodingProblemSummary,
  type GradeCodeResponse,
  type RunCodeResponse,
  type SupportedLanguage,
} from '../api/practiceApi'
import { FormattedFeedback } from '../components/FormattedFeedback'
import {
  CodeIcon,
  PlayIcon,
  SparklesIcon,
} from '../components/Icons'
import './CodingSandboxPage.css'

export function CodingSandboxPage() {
  const { problemId } = useParams<{ problemId?: string }>()
  const navigate = useNavigate()

  // Problem Catalog State
  const [problems, setProblems] = useState<CodingProblemSummary[]>([])
  const [currentProblem, setCurrentProblem] = useState<CodingProblem | null>(null)
  const [loadingProblem, setLoadingProblem] = useState(true)
  const [problemDrawerOpen, setProblemDrawerOpen] = useState(false)


  // Filters
  const [selectedDomain, setSelectedDomain] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')

  // Editor State
  const [language, setLanguage] = useState<SupportedLanguage>('python')
  const [code, setCode] = useState('')
  const [fontSize, setFontSize] = useState<number>(14)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lineNumbersRef = useRef<HTMLDivElement | null>(null)

  // Execution & Output State
  const [isRunning, setIsRunning] = useState(false)
  const [isGrading, setIsGrading] = useState(false)
  const [activeTab, setActiveTab] = useState<'tests' | 'custom' | 'console' | 'assessment'>('tests')
  const [selectedTestIdx, setSelectedTestIdx] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [runResult, setRunResult] = useState<RunCodeResponse | null>(null)
  const [gradeResult, setGradeResult] = useState<GradeCodeResponse | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Fetch problem catalog on mount
  useEffect(() => {
    let active = true
    listCodingProblems()
      .then((data) => {
        if (!active) return
        setProblems(data)
      })
      .catch((err) => {
        if (!active) return
        setErrorBanner(err instanceof Error ? err.message : 'Failed to load challenges')
      })

    return () => {
      active = false
    }
  }, [])

  // Load active problem
  useEffect(() => {
    let active = true
    const targetId = problemId || (problems.length > 0 ? problems[0].id : 'two-sum')
    if (!targetId) return

    getCodingProblem(targetId)
      .then((prob) => {
        if (!active) return
        setCurrentProblem(prob)
        const defaultCode = prob.starter_code[language] || prob.starter_code['python'] || ''
        setCode(defaultCode)
        setRunResult(null)
        setGradeResult(null)
        setActiveTab('tests')
        setSelectedTestIdx(0)
        setErrorBanner(null)
        setLoadingProblem(false)
      })
      .catch((err) => {
        if (!active) return
        setErrorBanner(err instanceof Error ? err.message : 'Could not load problem details')
        setLoadingProblem(false)
      })

    return () => {
      active = false
    }
  }, [problemId, problems, language])


  // Handle language switch
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang)
    if (currentProblem && currentProblem.starter_code[newLang]) {
      setCode(currentProblem.starter_code[newLang])
    }
  }

  // Reset starter code
  const handleResetCode = () => {
    if (!currentProblem) return
    if (window.confirm('Reset editor back to initial starter code template?')) {
      const defaultCode = currentProblem.starter_code[language] || ''
      setCode(defaultCode)
      setRunResult(null)
    }
  }

  // Handle Tab & Enter in Code Editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ⌘/Ctrl + Enter = Run Tests
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handleSubmitAssessment()
      } else {
        handleRunTests()
      }
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const updated = code.substring(0, start) + '    ' + code.substring(end)
      setCode(updated)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4
      }, 0)
    }

    if (e.key === 'Enter') {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const lines = code.substring(0, start).split('\n')
      const currentLine = lines[lines.length - 1]
      const match = currentLine.match(/^\s+/)
      const indent = match ? match[0] : ''
      const extraIndent = currentLine.trimEnd().endsWith(':') || currentLine.trimEnd().endsWith('{') ? '    ' : ''
      const insertion = '\n' + indent + extraIndent

      e.preventDefault()
      const updated = code.substring(0, start) + insertion + code.substring(textarea.selectionEnd)
      setCode(updated)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + insertion.length
      }, 0)
    }
  }

  // Sync line numbers scrolling
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Run candidate code against test cases
  const handleRunTests = async () => {
    if (!currentProblem || isRunning) return
    setIsRunning(true)
    setErrorBanner(null)

    try {
      const res = await runCodeInSandbox({
        code,
        language,
        test_cases: currentProblem.test_cases,
        entry_function: currentProblem.entry_function,
        custom_input: activeTab === 'custom' ? customInput : undefined,
      })
      setRunResult(res)
      if (activeTab !== 'console' && activeTab !== 'custom') {
        setActiveTab('tests')
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setIsRunning(false)
    }
  }

  // Submit for AI Code Review & Scoring
  const handleSubmitAssessment = async () => {
    if (!currentProblem || isGrading) return
    setIsGrading(true)
    setErrorBanner(null)

    try {
      // First ensure tests are executed
      let tests = runResult?.results || []
      if (tests.length === 0) {
        const runRes = await runCodeInSandbox({
          code,
          language,
          test_cases: currentProblem.test_cases,
          entry_function: currentProblem.entry_function,
        })
        setRunResult(runRes)
        tests = runRes.results
      }

      const assessment = await gradeCodingSubmission({
        problem_id: currentProblem.id,
        problem_title: currentProblem.title,
        code,
        language,
        test_results: tests,
        role: 'Software Engineer',
        experience_level: currentProblem.difficulty,
      })

      setGradeResult(assessment)
      setActiveTab('assessment')
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'AI assessment failed')
    } finally {
      setIsGrading(false)
    }
  }

  // Line count for gutter
  const lineCount = Math.max(1, code.split('\n').length)
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  // Filtered problem list
  const filteredProblems = problems.filter((p) => {
    if (selectedDomain !== 'all' && p.domain.toLowerCase() !== selectedDomain.toLowerCase()) return false
    if (selectedDifficulty !== 'all' && p.difficulty.toLowerCase() !== selectedDifficulty.toLowerCase()) return false
    return true
  })

  return (
    <div className="sandbox-page">
      {/* Top Header Bar */}
      <header className="sandbox-header">
        <div className="sandbox-header__left">
          <button
            type="button"
            className="sandbox-header__catalog-btn"
            onClick={() => setProblemDrawerOpen((prev) => !prev)}
            title="Browse all coding challenges"
          >
            <CodeIcon width={18} height={18} />
            <span>Problem Catalog</span>
            <span className="sandbox-header__catalog-count">({problems.length})</span>
          </button>

          {currentProblem && (
            <div className="sandbox-header__current-info">
              <h1 className="sandbox-header__title">{currentProblem.title}</h1>
              <span className={`sandbox-badge sandbox-badge--${currentProblem.difficulty}`}>
                {currentProblem.difficulty.toUpperCase()}
              </span>
              <span className="sandbox-header__domain-tag">{currentProblem.domain}</span>
            </div>
          )}
        </div>

        <div className="sandbox-header__actions">
          <div className="sandbox-header__lang-toggle">
            <button
              type="button"
              className={`sandbox-lang-btn ${language === 'python' ? 'sandbox-lang-btn--active' : ''}`}
              onClick={() => handleLanguageChange('python')}
            >
              Python 3.14
            </button>
            <button
              type="button"
              className={`sandbox-lang-btn ${language === 'javascript' ? 'sandbox-lang-btn--active' : ''}`}
              onClick={() => handleLanguageChange('javascript')}
            >
              JavaScript
            </button>
          </div>

          <button
            type="button"
            className="sandbox-btn sandbox-btn--outline"
            onClick={handleResetCode}
            title="Reset code template"
          >
            Reset Code
          </button>

          <button
            type="button"
            className="sandbox-btn sandbox-btn--primary"
            onClick={handleRunTests}
            disabled={isRunning || loadingProblem}
          >
            <PlayIcon width={14} height={14} />
            <span>{isRunning ? 'Running…' : 'Run Tests'}</span>
            <kbd className="sandbox-btn__kbd">⌘↵</kbd>
          </button>

          <button
            type="button"
            className="sandbox-btn sandbox-btn--accent"
            onClick={handleSubmitAssessment}
            disabled={isGrading || isRunning || loadingProblem}
          >
            <SparklesIcon width={16} height={16} />
            <span>{isGrading ? 'Evaluating…' : 'AI Code Review'}</span>
          </button>
        </div>
      </header>

      {errorBanner && (
        <div className="sandbox-error-banner" role="alert">
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)}>✕</button>
        </div>
      )}

      {/* Main Sandbox Layout: Split View */}
      <div className="sandbox-body">
        {/* Left Pane: Problem Description, Constraints & Examples */}
        <section className="sandbox-spec-pane" aria-label="Problem Description">
          {loadingProblem ? (
            <div className="sandbox-pane-loading">
              <div className="sandbox-spinner" />
              <p>Loading problem specification…</p>
            </div>
          ) : currentProblem ? (
            <div className="sandbox-spec-content">
              <div className="sandbox-spec-tags">
                {currentProblem.tags.map((tag) => (
                  <span key={tag} className="sandbox-tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="sandbox-spec-description">
                <FormattedFeedback content={currentProblem.description} />
              </div>

              {currentProblem.examples && currentProblem.examples.length > 0 && (
                <div className="sandbox-spec-examples">
                  <h3 className="sandbox-spec-subheading">Examples</h3>
                  {currentProblem.examples.map((ex, i) => (
                    <div key={i} className="sandbox-example-card">
                      <div className="sandbox-example-label">Example {i + 1}</div>
                      <div className="sandbox-example-row">
                        <span className="sandbox-example-key">Input:</span>
                        <code>{ex.input}</code>
                      </div>
                      <div className="sandbox-example-row">
                        <span className="sandbox-example-key">Output:</span>
                        <code>{ex.output}</code>
                      </div>
                      {ex.explanation && (
                        <div className="sandbox-example-explanation">
                          <span className="sandbox-example-key">Explanation:</span>
                          <span>{ex.explanation}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {currentProblem.constraints && currentProblem.constraints.length > 0 && (
                <div className="sandbox-spec-constraints">
                  <h3 className="sandbox-spec-subheading">Constraints</h3>
                  <ul className="sandbox-constraints-list">
                    {currentProblem.constraints.map((c, i) => (
                      <li key={i}>
                        <code>{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="sandbox-spec-empty">No problem selected.</p>
          )}
        </section>

        {/* Right Pane: Code Editor & Bottom Test Runner Output */}
        <section className="sandbox-editor-pane" aria-label="Code Editor & Test Execution">
          {/* Top of Editor: Status & Font Controls */}
          <div className="sandbox-editor-toolbar">
            <div className="sandbox-editor-toolbar__left">
              <span className="sandbox-editor-fn-label">
                Entry: <code>{currentProblem?.entry_function || 'solve'}</code>
              </span>
            </div>
            <div className="sandbox-editor-toolbar__right">
              <span className="sandbox-char-count">{code.length} chars · {lineCount} lines</span>
              <button
                type="button"
                className="sandbox-font-btn"
                onClick={() => setFontSize((f) => (f === 14 ? 16 : f === 16 ? 13 : 14))}
                title="Adjust font size"
              >
                {fontSize}px
              </button>
            </div>
          </div>

          {/* Code Textarea with Line Numbers */}
          <div className="sandbox-code-container" style={{ fontSize: `${fontSize}px` }}>
            <div className="sandbox-line-numbers" ref={lineNumbersRef} aria-hidden="true">
              {lineNumbers.map((num) => (
                <div key={num} className="sandbox-line-num">{num}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="sandbox-code-textarea"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              placeholder="Write your code implementation here…"
            />
          </div>

          {/* Bottom Pane: Test Cases & Output Tabs */}
          <div className="sandbox-output-pane">
            <div className="sandbox-output-tabs">
              <button
                type="button"
                className={`sandbox-tab ${activeTab === 'tests' ? 'sandbox-tab--active' : ''}`}
                onClick={() => setActiveTab('tests')}
              >
                <span>Test Cases</span>
                {runResult && (
                  <span
                    className={`sandbox-tab-badge ${
                      runResult.all_passed ? 'sandbox-tab-badge--pass' : 'sandbox-tab-badge--fail'
                    }`}
                  >
                    {runResult.passed_count}/{runResult.total_count}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`sandbox-tab ${activeTab === 'custom' ? 'sandbox-tab--active' : ''}`}
                onClick={() => setActiveTab('custom')}
              >
                Custom Test
              </button>

              <button
                type="button"
                className={`sandbox-tab ${activeTab === 'console' ? 'sandbox-tab--active' : ''}`}
                onClick={() => setActiveTab('console')}
              >
                <span>Stdout / Logs</span>
                {runResult && (runResult.stdout || runResult.stderr) && (
                  <span className="sandbox-tab-indicator" />
                )}
              </button>

              {gradeResult && (
                <button
                  type="button"
                  className={`sandbox-tab sandbox-tab--assessment ${
                    activeTab === 'assessment' ? 'sandbox-tab--active' : ''
                  }`}
                  onClick={() => setActiveTab('assessment')}
                >
                  <SparklesIcon width={14} height={14} />
                  <span>AI Review ({gradeResult.score}/10)</span>
                </button>
              )}
            </div>

            <div className="sandbox-output-content">
              {/* Test Cases Sub-View */}
              {activeTab === 'tests' && (
                <div className="sandbox-tests-view">
                  <div className="sandbox-test-selector">
                    {(currentProblem?.test_cases || []).map((tc, idx) => {
                      const res = runResult?.results.find((r) => r.test_case_id === tc.id)
                      return (
                        <button
                          key={tc.id}
                          type="button"
                          className={`sandbox-test-pill ${
                            selectedTestIdx === idx ? 'sandbox-test-pill--selected' : ''
                          } ${
                            res
                              ? res.passed
                                ? 'sandbox-test-pill--pass'
                                : 'sandbox-test-pill--fail'
                              : ''
                          }`}
                          onClick={() => setSelectedTestIdx(idx)}
                        >
                          Case {idx + 1}
                          {res && (res.passed ? ' ✓' : ' ✕')}
                        </button>
                      )
                    })}
                  </div>

                  {currentProblem?.test_cases && currentProblem.test_cases[selectedTestIdx] && (
                    <div className="sandbox-test-details">
                      {(() => {
                        const tc = currentProblem.test_cases[selectedTestIdx]
                        const res = runResult?.results.find((r) => r.test_case_id === tc.id)
                        return (
                          <div className="sandbox-case-card">
                            <div className="sandbox-case-row">
                              <span className="sandbox-case-label">Input</span>
                              <pre className="sandbox-case-code">{tc.input_data}</pre>
                            </div>
                            <div className="sandbox-case-row">
                              <span className="sandbox-case-label">Expected Output</span>
                              <pre className="sandbox-case-code">{tc.expected_output}</pre>
                            </div>
                            {res && (
                              <div className="sandbox-case-row">
                                <span className="sandbox-case-label">
                                  Actual Output{' '}
                                  <span
                                    className={`sandbox-status-chip ${
                                      res.passed ? 'sandbox-status-chip--pass' : 'sandbox-status-chip--fail'
                                    }`}
                                  >
                                    {res.passed ? 'Passed' : 'Failed'} ({res.execution_time_ms} ms)
                                  </span>
                                </span>
                                <pre
                                  className={`sandbox-case-code ${
                                    res.passed ? 'sandbox-case-code--pass' : 'sandbox-case-code--fail'
                                  }`}
                                >
                                  {res.actual_output || res.error || '(None)'}
                                </pre>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Input Tab */}
              {activeTab === 'custom' && (
                <div className="sandbox-custom-view">
                  <label className="sandbox-custom-label">
                    Custom Test Arguments (comma separated tuples or values):
                  </label>
                  <textarea
                    className="sandbox-custom-input"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="e.g. [1, 2, 3, 4], 5"
                    rows={4}
                  />
                  <button
                    type="button"
                    className="sandbox-btn sandbox-btn--primary"
                    onClick={handleRunTests}
                    disabled={isRunning}
                  >
                    Run Custom Case
                  </button>
                </div>
              )}

              {/* Console Stdout / Stderr Tab */}
              {activeTab === 'console' && (
                <div className="sandbox-console-view">
                  {runResult?.stdout && (
                    <div className="sandbox-console-section">
                      <div className="sandbox-console-title">Standard Output (stdout):</div>
                      <pre className="sandbox-console-stdout">{runResult.stdout}</pre>
                    </div>
                  )}
                  {runResult?.stderr && (
                    <div className="sandbox-console-section">
                      <div className="sandbox-console-title sandbox-console-title--err">Error / Traceback:</div>
                      <pre className="sandbox-console-stderr">{runResult.stderr}</pre>
                    </div>
                  )}
                  {!runResult?.stdout && !runResult?.stderr && (
                    <p className="sandbox-console-empty">
                      No console output. Click <strong>Run Tests</strong> to execute your code.
                    </p>
                  )}
                </div>
              )}

              {/* AI Assessment Tab */}
              {activeTab === 'assessment' && gradeResult && (
                <div className="sandbox-assessment-view">
                  <div className="sandbox-assessment-hero">
                    <div className="sandbox-assessment-score-badge">
                      <span className="sandbox-score-num">{gradeResult.score}</span>
                      <span className="sandbox-score-max">/10</span>
                    </div>
                    <div className="sandbox-assessment-meta">
                      <h3 className="sandbox-assessment-title">AI Diagnostic Code Assessment</h3>
                      <div className="sandbox-complexity-pills">
                        <span className="sandbox-complexity-pill">
                          Time: <strong>{gradeResult.time_complexity}</strong>
                        </span>
                        <span className="sandbox-complexity-pill">
                          Space: <strong>{gradeResult.space_complexity}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="sandbox-assessment-feedback-grid">
                    <div className="sandbox-feedback-card">
                      <h4 className="sandbox-feedback-title">Correctness &amp; Logic</h4>
                      <p>{gradeResult.correctness_assessment}</p>
                    </div>
                    <div className="sandbox-feedback-card">
                      <h4 className="sandbox-feedback-title">Code Quality &amp; Cleanliness</h4>
                      <p>{gradeResult.code_quality_feedback}</p>
                    </div>
                    <div className="sandbox-feedback-card">
                      <h4 className="sandbox-feedback-title">Edge Cases &amp; Resilience</h4>
                      <p>{gradeResult.edge_cases_feedback}</p>
                    </div>
                  </div>

                  {gradeResult.recommended_improvements && gradeResult.recommended_improvements.length > 0 && (
                    <div className="sandbox-improvements-card">
                      <h4 className="sandbox-feedback-title">Recommended Improvements</h4>
                      <ul className="sandbox-improvements-list">
                        {gradeResult.recommended_improvements.map((imp, idx) => (
                          <li key={idx}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {gradeResult.detailed_markdown && (
                    <div className="sandbox-detailed-md">
                      <FormattedFeedback content={gradeResult.detailed_markdown} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Problem Catalog Drawer Modal */}
      {problemDrawerOpen && (
        <div className="sandbox-drawer-overlay" onClick={() => setProblemDrawerOpen(false)}>
          <div className="sandbox-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sandbox-drawer__header">
              <div>
                <h2 className="sandbox-drawer__title">Coding Problem Catalog</h2>
                <p className="sandbox-drawer__desc">
                  Curated live coding challenges across Algorithms, System Design, and Machine Learning.
                </p>
              </div>
              <button
                type="button"
                className="sandbox-drawer__close-btn"
                onClick={() => setProblemDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Catalog Filters */}
            <div className="sandbox-drawer__filters">
              <select
                className="sandbox-select"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
              >
                <option value="all">All Domains</option>
                <option value="Data Structures & Algorithms">Data Structures &amp; Algorithms</option>
                <option value="System Design">System Design</option>
                <option value="Machine Learning">Machine Learning</option>
              </select>

              <select
                className="sandbox-select"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
              >
                <option value="all">All Difficulties</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid-Level</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>

            {/* Problem List */}
            <div className="sandbox-drawer__list">
              {filteredProblems.map((prob) => {
                const isSelected = currentProblem?.id === prob.id
                return (
                  <div
                    key={prob.id}
                    className={`sandbox-catalog-card ${
                      isSelected ? 'sandbox-catalog-card--selected' : ''
                    }`}
                    onClick={() => {
                      navigate(`/sandbox/${prob.id}`)
                      setProblemDrawerOpen(false)
                    }}
                  >
                    <div className="sandbox-catalog-card__header">
                      <h3 className="sandbox-catalog-card__title">{prob.title}</h3>
                      <span className={`sandbox-badge sandbox-badge--${prob.difficulty}`}>
                        {prob.difficulty.toUpperCase()}
                      </span>
                    </div>
                    <p className="sandbox-catalog-card__snippet">{prob.description_snippet}…</p>
                    <div className="sandbox-catalog-card__footer">
                      <span className="sandbox-catalog-domain">{prob.domain}</span>
                      <div className="sandbox-catalog-tags">
                        {prob.tags.slice(0, 3).map((t) => (
                          <span key={t} className="sandbox-tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
