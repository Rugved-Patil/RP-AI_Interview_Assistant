import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getQuestionBankStats,
  listQuestionBank,
  searchRAG,
  type QuestionBankStats,
  type QuestionDoc,
  type RetrievedQuestion,
} from '../api/practiceApi'
import './QuestionBankPage.css'

export function QuestionBankPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<QuestionBankStats | null>(null)
  const [questions, setQuestions] = useState<QuestionDoc[]>([])
  const [retrievedResults, setRetrievedResults] = useState<RetrievedQuestion[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [searching, setSearching] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'technical' | 'behavioral'>('all')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Load initial stats & questions
  useEffect(() => {
    let cancelled = false

    Promise.all([getQuestionBankStats(), listQuestionBank({ limit: 200 })])
      .then(([statsData, listData]) => {
        if (!cancelled) {
          setStats(statsData)
          setQuestions(listData.items)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load question bank')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Execute Vector Search when query changes
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      return
    }

    const timer = setTimeout(() => {
      setSearching(true)
      searchRAG({
        query: trimmed,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        domain: selectedDomain === 'all' ? undefined : selectedDomain,
        difficulty: selectedDifficulty === 'all' ? undefined : (selectedDifficulty as 'junior' | 'mid' | 'senior' | 'lead'),
        top_k: 30,
      })
        .then((res) => {
          setRetrievedResults(res.retrieved_questions)
          setSearching(false)
        })
        .catch(() => {
          setRetrievedResults(null)
          setSearching(false)
        })
    }, 200)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedCategory, selectedDomain, selectedDifficulty])

  const effectiveRetrievedResults = searchQuery.trim() ? retrievedResults : null

  const toggleCriteria = (id: string) => {
    setExpandedCriteria((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleCopyQuestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handlePracticeQuestion = (q: QuestionDoc | RetrievedQuestion) => {
    if (q.category === 'behavioral') {
      navigate('/practice/behavioral', {
        state: { directQuestion: q.question, domain: q.domain, difficulty: q.difficulty },
      })
    } else {
      navigate('/practice', {
        state: { directQuestion: q.question, domain: q.domain, difficulty: q.difficulty },
      })
    }
  }

  // Filtered standard questions when not searching
  const displayedQuestions = useMemo(() => {
    if (effectiveRetrievedResults !== null) {
      return []
    }
    return questions.filter((q) => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory) return false
      if (selectedDomain !== 'all' && q.domain.toLowerCase() !== selectedDomain.toLowerCase()) return false
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false
      return true
    })
  }, [questions, effectiveRetrievedResults, selectedCategory, selectedDomain, selectedDifficulty])

  const currentCount = effectiveRetrievedResults !== null ? effectiveRetrievedResults.length : displayedQuestions.length

  return (
    <div className="qb-container">
      <button
        type="button"
        className="page-back"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1)
          } else {
            navigate('/')
          }
        }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        ← Back
      </button>

      {/* Header */}
      <header className="qb-header">
        <div className="qb-title-row">
          <h1 className="qb-title">Question Bank</h1>
          {stats && (
            <div className="qb-count-pill">
              {stats.total_questions} Curated Questions • {stats.domains.length} Domains
            </div>
          )}
        </div>
        <p className="qb-subtitle">
          Explore vetted interview questions frequently asked across diverse industries and roles. Practice with instant feedback or inspect detailed evaluation rubrics.
        </p>
      </header>

      {/* Search & Filter Controls */}
      <section className="qb-search-section">
        <div className="qb-search-row">
          <div className="qb-search-input-wrap">
            <svg
              className="qb-search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="qb-search-input"
              placeholder="Search by keyword, concept, or role (e.g., 'React Fiber', 'Kubernetes', 'B-Tree', 'Triage', 'STAR', 'Cash flow')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <button className="qb-clear-btn" onClick={() => setSearchQuery('')}>
              Clear
            </button>
          )}
        </div>

        {/* Category & Difficulty Filters */}
        <div className="qb-filters-row">
          <div className="qb-segmented-tabs">
            <button
              className={`qb-tab-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Categories
            </button>
            <button
              className={`qb-tab-btn ${selectedCategory === 'technical' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('technical')}
            >
              Technical & Domain
            </button>
            <button
              className={`qb-tab-btn ${selectedCategory === 'behavioral' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('behavioral')}
            >
              Behavioral (STAR)
            </button>
          </div>

          <div className="qb-filter-dropdowns">
            <select
              className="qb-select"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
            >
              <option value="all">All Difficulties</option>
              <option value="junior">Junior / Entry</option>
              <option value="mid">Mid-Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead / Staff</option>
            </select>
          </div>
        </div>

        {/* Domain Filter Chips */}
        {stats && (
          <div className="qb-domains-scroll">
            <button
              className={`qb-domain-chip ${selectedDomain === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDomain('all')}
            >
              All Domains ({stats.total_questions})
            </button>
            {stats.domains.map((d) => (
              <button
                key={d.domain}
                className={`qb-domain-chip ${selectedDomain.toLowerCase() === d.domain.toLowerCase() ? 'active' : ''}`}
                onClick={() =>
                  setSelectedDomain(
                    selectedDomain.toLowerCase() === d.domain.toLowerCase() ? 'all' : d.domain
                  )
                }
              >
                {d.domain} ({d.count})
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Results Header Count */}
      <div className="qb-results-header">
        <span className="qb-results-count">
          Showing <strong>{currentCount}</strong> question{currentCount === 1 ? '' : 's'}
          {searchQuery.trim() ? ` matching "${searchQuery}"` : ''}
        </span>
      </div>

      {/* Error state */}
      {error && <div className="qb-empty">{error}</div>}

      {/* Loading state */}
      {loading && <div className="qb-empty">Loading question bank…</div>}

      {/* Question List */}
      {!loading && !error && (
        <section className="qb-list">
          {searching && <div className="qb-empty">Searching questions…</div>}

          {/* Search Results */}
          {effectiveRetrievedResults !== null && !searching && (
            <>
              {effectiveRetrievedResults.length === 0 ? (
                <div className="qb-empty">No matching questions found for your search query.</div>
              ) : (
                effectiveRetrievedResults.map((q) => (
                  <article key={q.id} className="qb-card">
                    <div className="qb-card-top">
                      <div className="qb-card-meta">
                        <span className="qb-domain-badge">{q.domain}</span>
                        <span className={`qb-cat-pill ${q.category}`}>{q.category}</span>
                        <span className="qb-diff-badge">{q.difficulty}</span>
                      </div>
                      <span className="qb-score-badge">
                        Match: {Math.round(q.score * 100)}%
                      </span>
                    </div>

                    <p className="qb-question-text">{q.question}</p>

                    <div className="qb-tags-wrap">
                      {q.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`qb-tag ${q.matched_tags.includes(tag) ? 'matched' : ''}`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {q.evaluation_criteria && (
                      <div className="qb-criteria-container">
                        <button
                          className="qb-criteria-toggle"
                          onClick={() => toggleCriteria(q.id)}
                          type="button"
                        >
                          <span>Evaluation Rubric & Key Concepts</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            {expandedCriteria[q.id] ? 'Hide Rubric' : 'View Rubric'}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points={expandedCriteria[q.id] ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                            </svg>
                          </span>
                        </button>
                        {expandedCriteria[q.id] && (
                          <div className="qb-criteria-content">{q.evaluation_criteria}</div>
                        )}
                      </div>
                    )}

                    <div className="qb-card-actions">
                      <button
                        type="button"
                        className="qb-practice-btn"
                        onClick={() => handlePracticeQuestion(q)}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>Practice Question</span>
                      </button>
                      <button
                        type="button"
                        className="qb-copy-btn"
                        onClick={() => handleCopyQuestion(q.id, q.question)}
                      >
                        {copiedId === q.id ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </>
          )}

          {/* Default Filtered Question Bank Results */}
          {effectiveRetrievedResults === null && !searching && (
            <>
              {displayedQuestions.length === 0 ? (
                <div className="qb-empty">No questions match the selected filters.</div>
              ) : (
                displayedQuestions.map((q) => (
                  <article key={q.id} className="qb-card">
                    <div className="qb-card-top">
                      <div className="qb-card-meta">
                        <span className="qb-domain-badge">{q.domain}</span>
                        <span className={`qb-cat-pill ${q.category}`}>{q.category}</span>
                        <span className="qb-diff-badge">{q.difficulty}</span>
                      </div>
                    </div>

                    <p className="qb-question-text">{q.question}</p>

                    <div className="qb-tags-wrap">
                      {q.tags.map((tag) => (
                        <span key={tag} className="qb-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {q.evaluation_criteria && (
                      <div className="qb-criteria-container">
                        <button
                          className="qb-criteria-toggle"
                          onClick={() => toggleCriteria(q.id)}
                          type="button"
                        >
                          <span>Evaluation Rubric & Key Concepts</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            {expandedCriteria[q.id] ? 'Hide Rubric' : 'View Rubric'}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points={expandedCriteria[q.id] ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                            </svg>
                          </span>
                        </button>
                        {expandedCriteria[q.id] && (
                          <div className="qb-criteria-content">{q.evaluation_criteria}</div>
                        )}
                      </div>
                    )}

                    <div className="qb-card-actions">
                      <button
                        type="button"
                        className="qb-practice-btn"
                        onClick={() => handlePracticeQuestion(q)}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>Practice Question</span>
                      </button>
                      <button
                        type="button"
                        className="qb-copy-btn"
                        onClick={() => handleCopyQuestion(q.id, q.question)}
                      >
                        {copiedId === q.id ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

