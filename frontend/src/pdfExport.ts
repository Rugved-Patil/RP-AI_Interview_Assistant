import type { ReportSummary, SavedInterviewReportSummary } from './api/practiceApi'

export interface MockInterviewReportData {
  score: number
  feedback: string
  role?: string | null
  company?: string | null
  location?: string | null
  experience_level?: string | null
  interview_type?: string | null
  session_id?: string | null
  created_at?: string | null
  transcript: Array<{ role: 'interviewer' | 'candidate'; content: string }>
  dimensions?: {
    technical_accuracy?: number
    communication_clarity?: number
    problem_solving?: number
    experience_depth?: number
    situational_awareness?: number
  } | null
}

export interface SinglePracticeReportData {
  id?: number
  session_id: string
  role?: string | null
  company?: string | null
  location?: string | null
  question: string
  answer: string
  score: number
  feedback: string
  created_at?: string
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  // Replace markdown headers
  let html = markdown
    .replace(/^####\s+(.*?)$/gm, '<h5 class="pdf-section-subsubtitle">$1</h5>')
    .replace(/^###\s+(.*?)$/gm, '<h4 class="pdf-section-subtitle">$1</h4>')
    .replace(/^##\s+(.*?)$/gm, '<h3 class="pdf-section-title">$1</h3>')
    .replace(/^#\s+(.*?)$/gm, '<h2 class="pdf-section-title">$1</h2>')

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  // Code blocks & inline code
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="pdf-code-block"><code>$1</code></pre>')
  html = html.replace(/`([^`]+)`/g, '<code class="pdf-inline-code">$1</code>')

  // Bullet lists
  html = html.replace(/^[*-]\s+(.*?)$/gm, '<li class="pdf-bullet-item">$1</li>')

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li class="pdf-bullet-item">.*?<\/li>\s*)+/g, '<ul class="pdf-bullet-list">$&</ul>')

  // Convert double linebreaks to paragraphs if not already in tags
  const paragraphs = html.split(/\n\n+/)
  return paragraphs
    .map((p) => {
      const trimmed = p.trim()
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<li') ||
        trimmed.startsWith('<pre')
      ) {
        return trimmed
      }
      return `<p class="pdf-text-paragraph">${trimmed.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

export function getScoreRating(score: number): { label: string; color: string; bg: string; description: string } {
  if (score >= 9.0) {
    return {
      label: 'Exceptional (Strong Hire)',
      color: '#245a31',
      bg: '#eaf4eb',
      description: 'Demonstrates deep mastery, structured rationale, and comprehensive real-world execution capability.',
    }
  }
  if (score >= 7.0) {
    return {
      label: 'Proficient (Hire)',
      color: '#3a4d3f',
      bg: '#edf3ee',
      description: 'Solid competency with sound architectural decisions and clear communication of core principles.',
    }
  }
  if (score >= 5.0) {
    return {
      label: 'Developing (Needs Focus)',
      color: '#926014',
      bg: '#fdf6e9',
      description: 'Adequate fundamental baseline with opportunities to deepen specific technical nuances and examples.',
    }
  }
  return {
    label: 'Foundational (Critical Review)',
    color: '#8c2d20',
    bg: '#fdede9',
    description: 'Requires targeted practice on core principles, edge-case mitigation, and structured problem framing.',
  }
}

const BASE_PDF_STYLES = `
  @page {
    size: A4 portrait;
    margin: 14mm 12mm 14mm 12mm;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #24201b;
    background: #ffffff;
    margin: 0;
    padding: 0;
    font-size: 10.5pt;
    line-height: 1.5;
  }

  .pdf-container {
    max-width: 100%;
    margin: 0 auto;
  }

  /* Header Banner */
  .pdf-header {
    border-bottom: 2px solid #3a4d3f;
    padding-bottom: 12px;
    margin-bottom: 18px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .pdf-header-main {
    flex: 1;
  }

  .pdf-header-eyebrow {
    font-family: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #3a4d3f;
    font-weight: 700;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pdf-header-title {
    font-family: Georgia, Cambria, "Times New Roman", Times, serif;
    font-size: 19pt;
    font-weight: 700;
    color: #1a1714;
    margin: 0 0 4px 0;
    letter-spacing: -0.01em;
  }

  .pdf-header-meta {
    font-size: 9pt;
    color: #635b50;
    display: flex;
    gap: 16px;
    margin-top: 4px;
  }

  .pdf-header-badge {
    text-align: right;
    flex-shrink: 0;
  }

  .pdf-doc-stamp {
    font-family: ui-monospace, monospace;
    font-size: 7pt;
    text-transform: uppercase;
    background: #f0ece3;
    border: 1px solid #d8d0c3;
    padding: 3px 8px;
    border-radius: 4px;
    color: #4f473c;
    font-weight: 600;
  }

  /* KPI / Overview Hero Grid */
  .pdf-hero-scorecard {
    background: #f9f7f2;
    border: 1px solid #dfd8cc;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .pdf-hero-score-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .pdf-hero-score-circle {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: #ffffff;
    border: 3px solid #3a4d3f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  }

  .pdf-hero-score-val {
    font-family: Georgia, serif;
    font-size: 22pt;
    font-weight: 700;
    line-height: 1;
    color: #3a4d3f;
  }

  .pdf-hero-score-denom {
    font-size: 8pt;
    color: #8c8273;
    font-weight: 600;
  }

  .pdf-hero-score-details {
    flex: 1;
  }

  .pdf-hero-rating-badge {
    display: inline-block;
    font-family: ui-monospace, monospace;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .pdf-hero-rating-desc {
    font-size: 9pt;
    color: #5c5346;
    margin: 0;
    line-height: 1.4;
  }

  .pdf-hero-meta-col {
    border-left: 1px dashed #d8d0c3;
    padding-left: 16px;
    font-size: 8.5pt;
    color: #6e6456;
    min-width: 170px;
  }

  .pdf-hero-meta-item {
    margin-bottom: 4px;
  }

  .pdf-hero-meta-item strong {
    color: #2b2721;
  }

  /* Radar / Dimensions Grid */
  .pdf-dimensions-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 20px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .pdf-dimension-card {
    background: #ffffff;
    border: 1px solid #d8d0c3;
    border-radius: 6px;
    padding: 8px 10px;
    text-align: center;
  }

  .pdf-dimension-val {
    font-family: Georgia, serif;
    font-size: 14pt;
    font-weight: 700;
    color: #3a4d3f;
    line-height: 1.1;
  }

  .pdf-dimension-label {
    font-family: ui-monospace, monospace;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6e6456;
    margin-top: 3px;
  }

  /* Section Headings */
  .pdf-division-title {
    font-family: Georgia, serif;
    font-size: 13pt;
    font-weight: 700;
    color: #1a1714;
    border-bottom: 1.5px solid #d8d0c3;
    padding-bottom: 5px;
    margin: 20px 0 12px 0;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .pdf-section-title {
    font-family: Georgia, serif;
    font-size: 11pt;
    font-weight: 700;
    color: #2b2721;
    margin: 14px 0 6px 0;
  }

  .pdf-section-subtitle {
    font-family: Georgia, serif;
    font-size: 10pt;
    font-weight: 700;
    color: #3a4d3f;
    margin: 10px 0 4px 0;
  }

  .pdf-section-subsubtitle {
    font-size: 9.5pt;
    font-weight: 700;
    color: #5c5346;
    margin: 8px 0 3px 0;
  }

  .pdf-text-paragraph {
    margin: 0 0 8px 0;
    font-size: 9.5pt;
    line-height: 1.5;
    color: #2b2721;
  }

  .pdf-bullet-list {
    margin: 4px 0 10px 0;
    padding-left: 18px;
  }

  .pdf-bullet-item {
    font-size: 9.5pt;
    margin-bottom: 4px;
    line-height: 1.45;
    color: #2b2721;
  }

  .pdf-code-block {
    background: #f7f4ee;
    border: 1px solid #d8d0c3;
    border-radius: 4px;
    padding: 8px 10px;
    font-family: ui-monospace, Menlo, Monaco, Consolas, monospace;
    font-size: 8.5pt;
    line-height: 1.4;
    margin: 8px 0;
    overflow-x: auto;
  }

  .pdf-inline-code {
    font-family: ui-monospace, Menlo, Monaco, Consolas, monospace;
    font-size: 8.5pt;
    background: #f0ece3;
    padding: 1px 4px;
    border-radius: 3px;
    color: #3a4d3f;
  }

  /* Question / Answer / Content Box */
  .pdf-qa-box {
    background: #fbf9f5;
    border: 1px solid #e5dfd4;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 12px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .pdf-qa-box--candidate {
    background: #ffffff;
    border-left: 4px solid #3a4d3f;
  }

  .pdf-qa-box--question {
    background: #f6f3eb;
    border-left: 4px solid #8c3b2d;
  }

  .pdf-qa-label {
    font-family: ui-monospace, monospace;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #5c5346;
    margin-bottom: 4px;
  }

  .pdf-qa-text {
    font-size: 9.5pt;
    color: #1a1714;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  /* Transcript Turns in Mocks */
  .pdf-transcript-wrap {
    margin-top: 14px;
    border-top: 1px solid #ede7db;
    padding-top: 10px;
  }

  .pdf-turn-box {
    margin-bottom: 9px;
    padding: 9px 12px;
    border-radius: 6px;
    font-size: 9pt;
    line-height: 1.45;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .pdf-turn--interviewer {
    background: #f4f1eb;
    border-left: 3px solid #3a4d3f;
  }

  .pdf-turn--candidate {
    background: #ffffff;
    border: 1px solid #e5dfd4;
    border-left: 3px solid #8c3b2d;
  }

  .pdf-turn-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px;
  }

  .pdf-turn-speaker {
    font-family: ui-monospace, monospace;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #4a4339;
  }

  .pdf-turn-index {
    font-family: ui-monospace, monospace;
    font-size: 7pt;
    color: #8c8273;
  }

  /* Pills & Badges */
  .pdf-pill {
    font-family: ui-monospace, monospace;
    font-size: 7.5pt;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: #e9e3d6;
    color: #38322a;
    display: inline-block;
  }

  .pdf-pill--olive {
    background: #3a4d3f;
    color: #ffffff;
  }

  .pdf-pill--red {
    background: #8c3b2d;
    color: #ffffff;
  }

  /* Footer */
  .pdf-footer {
    border-top: 1px solid #d8d0c3;
    padding-top: 8px;
    margin-top: 24px;
    font-family: ui-monospace, monospace;
    font-size: 7.5pt;
    color: #8c8273;
    display: flex;
    justify-content: space-between;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .pdf-page-break {
    page-break-before: always;
    break-before: always;
  }
`

/**
 * Triggers printing using a hidden iframe.
 */
export function printHTMLDocument(htmlContent: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Unable to create PDF print document.')
  }

  doc.open()
  doc.write(htmlContent)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Print dialog failed:', e)
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 2500)
    }
  }, 450)
}

/**
 * Generates an executive-grade assessment PDF HTML for a Single Practice Drill.
 */
export function generateSingleReportPrintHTML(report: SinglePracticeReportData): string {
  const exportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const rating = getScoreRating(report.score)
  const formattedFeedback = formatMarkdownToHtml(report.feedback)
  const context = [report.role, report.company, report.location].filter(Boolean).join(' · ')
  const dateCreated = report.created_at
    ? new Date(report.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : exportDate

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Practice Assessment Report - ${escapeHtml(report.role || 'Question Drill')}</title>
  <style>${BASE_PDF_STYLES}</style>
</head>
<body>
  <div class="pdf-container">
    <!-- Header -->
    <header class="pdf-header">
      <div class="pdf-header-main">
        <div class="pdf-header-eyebrow">
          <span>RP-AI Interview Assistant</span>
          <span>·</span>
          <span>Individual Drill Diagnostic</span>
        </div>
        <h1 class="pdf-header-title">Diagnostic Assessment Report</h1>
        <div class="pdf-header-meta">
          <span><strong>Context:</strong> ${escapeHtml(context || 'General Practice Drill')}</span>
          <span><strong>Date:</strong> ${escapeHtml(dateCreated)}</span>
          <span><strong>Session ID:</strong> ${escapeHtml(report.session_id)}</span>
        </div>
      </div>
      <div class="pdf-header-badge">
        <div class="pdf-doc-stamp">Verified AI Assessment</div>
      </div>
    </header>

    <!-- Hero Scorecard -->
    <div class="pdf-hero-scorecard">
      <div class="pdf-hero-score-left">
        <div class="pdf-hero-score-circle">
          <span class="pdf-hero-score-val">${report.score}</span>
          <span class="pdf-hero-score-denom">/10</span>
        </div>
        <div class="pdf-hero-score-details">
          <div class="pdf-hero-rating-badge" style="background: ${rating.bg}; color: ${rating.color};">
            ${escapeHtml(rating.label)}
          </div>
          <p class="pdf-hero-rating-desc">${escapeHtml(rating.description)}</p>
        </div>
      </div>
      <div class="pdf-hero-meta-col">
        <div class="pdf-hero-meta-item"><strong>Track:</strong> Single Question Drill</div>
        <div class="pdf-hero-meta-item"><strong>Status:</strong> Evaluated &amp; Scored</div>
        <div class="pdf-hero-meta-item"><strong>Rubric:</strong> Evidence-Based Calibration</div>
      </div>
    </div>

    <!-- Question Box -->
    <div class="pdf-qa-box pdf-qa-box--question">
      <div class="pdf-qa-label">Prompt Question:</div>
      <div class="pdf-qa-text">${escapeHtml(report.question)}</div>
    </div>

    <!-- Candidate Answer Box -->
    <div class="pdf-qa-box pdf-qa-box--candidate">
      <div class="pdf-qa-label">Candidate Submitted Response:</div>
      <div class="pdf-qa-text">${escapeHtml(report.answer)}</div>
    </div>

    <!-- Diagnostic Feedback -->
    <div class="pdf-division-title">
      <span>Diagnostic Assessment &amp; Growth Plan</span>
    </div>
    <div class="pdf-feedback-content">
      ${formattedFeedback}
    </div>

    <!-- Footer -->
    <footer class="pdf-footer">
      <span>RP-AI Interview Assistant · Evidence-Based Candidate Dossier</span>
      <span>Confidential Evaluation Record · Page 1 of 1</span>
    </footer>
  </div>
</body>
</html>`
}

/**
 * Generates an executive-grade comprehensive assessment PDF HTML for a Full Mock Interview.
 */
export function generateMockReportPrintHTML(report: MockInterviewReportData): string {
  const exportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const rating = getScoreRating(report.score)
  const isHr = report.interview_type === 'hr'
  const formattedFeedback = formatMarkdownToHtml(report.feedback)
  const context = [report.company, report.location].filter(Boolean).join(' · ')
  const dateCreated = report.created_at
    ? new Date(report.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : exportDate

  const dims = report.dimensions

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mock Interview Evaluation - ${escapeHtml(report.role || 'Assessment')}</title>
  <style>${BASE_PDF_STYLES}</style>
</head>
<body>
  <div class="pdf-container">
    <!-- Header -->
    <header class="pdf-header">
      <div class="pdf-header-main">
        <div class="pdf-header-eyebrow">
          <span>RP-AI Interview Assistant</span>
          <span>·</span>
          <span>Full Mock Interview Dossier</span>
        </div>
        <h1 class="pdf-header-title">${escapeHtml(report.role || 'Full Mock Interview Assessment')}</h1>
        <div class="pdf-header-meta">
          <span><strong>Track:</strong> ${isHr ? 'HR &amp; Behavioral Leadership' : 'Technical Architecture &amp; Engineering'}</span>
          <span><strong>Level:</strong> ${escapeHtml((report.experience_level || 'mid').toUpperCase())}</span>
          ${context ? `<span><strong>Company:</strong> ${escapeHtml(context)}</span>` : ''}
          <span><strong>Date:</strong> ${escapeHtml(dateCreated)}</span>
        </div>
      </div>
      <div class="pdf-header-badge">
        <div class="pdf-doc-stamp">Executive Dossier</div>
      </div>
    </header>

    <!-- Hero Scorecard -->
    <div class="pdf-hero-scorecard">
      <div class="pdf-hero-score-left">
        <div class="pdf-hero-score-circle">
          <span class="pdf-hero-score-val">${report.score}</span>
          <span class="pdf-hero-score-denom">/10</span>
        </div>
        <div class="pdf-hero-score-details">
          <div class="pdf-hero-rating-badge" style="background: ${rating.bg}; color: ${rating.color};">
            ${escapeHtml(rating.label)}
          </div>
          <p class="pdf-hero-rating-desc">${escapeHtml(rating.description)}</p>
        </div>
      </div>
      <div class="pdf-hero-meta-col">
        <div class="pdf-hero-meta-item"><strong>Total Turns:</strong> ${report.transcript.length} turns</div>
        <div class="pdf-hero-meta-item"><strong>Format:</strong> Multi-Turn Conversational</div>
        <div class="pdf-hero-meta-item"><strong>Session ID:</strong> ${escapeHtml(report.session_id || 'N/A')}</div>
      </div>
    </div>

    <!-- Dimensional Radars if present -->
    ${
      dims
        ? `
      <div class="pdf-division-title">
        <span>I. Competency Dimension Scorecard</span>
      </div>
      <div class="pdf-dimensions-grid">
        <div class="pdf-dimension-card">
          <div class="pdf-dimension-val">${dims.technical_accuracy ?? 'N/A'}<span style="font-size: 8pt; color: #8c8273;">/10</span></div>
          <div class="pdf-dimension-label">Technical Precision</div>
        </div>
        <div class="pdf-dimension-card">
          <div class="pdf-dimension-val">${dims.communication_clarity ?? 'N/A'}<span style="font-size: 8pt; color: #8c8273;">/10</span></div>
          <div class="pdf-dimension-label">Communication</div>
        </div>
        <div class="pdf-dimension-card">
          <div class="pdf-dimension-val">${dims.problem_solving ?? 'N/A'}<span style="font-size: 8pt; color: #8c8273;">/10</span></div>
          <div class="pdf-dimension-label">Problem Solving</div>
        </div>
        <div class="pdf-dimension-card">
          <div class="pdf-dimension-val">${dims.experience_depth ?? 'N/A'}<span style="font-size: 8pt; color: #8c8273;">/10</span></div>
          <div class="pdf-dimension-label">Experience Depth</div>
        </div>
        <div class="pdf-dimension-card">
          <div class="pdf-dimension-val">${dims.situational_awareness ?? 'N/A'}<span style="font-size: 8pt; color: #8c8273;">/10</span></div>
          <div class="pdf-dimension-label">Situational Framing</div>
        </div>
      </div>
    `
        : ''
    }

    <!-- Holistic Diagnostic Assessment -->
    <div class="pdf-division-title">
      <span>II. Holistic Diagnostic Assessment &amp; Key Takeaways</span>
    </div>
    <div class="pdf-feedback-content">
      ${formattedFeedback}
    </div>

    <!-- Complete Transcript -->
    ${
      report.transcript && report.transcript.length > 0
        ? `
      <div class="pdf-page-break"></div>
      <div class="pdf-division-title">
        <span>III. Complete Interview Conversation Transcript (${report.transcript.length} turns)</span>
      </div>
      <div class="pdf-transcript-wrap">
        ${report.transcript
          .map((turn, idx) => {
            const isCand = turn.role === 'candidate'
            return `
            <div class="pdf-turn-box ${isCand ? 'pdf-turn--candidate' : 'pdf-turn--interviewer'}">
              <div class="pdf-turn-header">
                <span class="pdf-turn-speaker">${isCand ? 'You (Candidate)' : 'AI Interviewer'}</span>
                <span class="pdf-turn-index">Turn #${idx + 1}</span>
              </div>
              <div style="white-space: pre-wrap;">${escapeHtml(turn.content)}</div>
            </div>
          `
          })
          .join('')}
      </div>
    `
        : ''
    }

    <!-- Footer -->
    <footer class="pdf-footer">
      <span>RP-AI Interview Assistant · Multi-Turn Assessment Dossier</span>
      <span>Confidential Evaluation Record</span>
    </footer>
  </div>
</body>
</html>`
}

/**
 * Generates master multi-page PDF HTML for all saved reports in the database.
 */
export function generateReportsPrintHTML(
  singleReports: ReportSummary[],
  mockReports: SavedInterviewReportSummary[],
): string {
  const exportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const totalReports = singleReports.length + mockReports.length
  const allScores = [...singleReports.map((r) => r.score), ...mockReports.map((m) => m.score)]
  const avgScore = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : 'N/A'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RP-AI Interview Assistant - All Saved Reports Master Portfolio</title>
  <style>${BASE_PDF_STYLES}</style>
</head>
<body>
  <div class="pdf-container">
    <!-- Header -->
    <header class="pdf-header">
      <div class="pdf-header-main">
        <div class="pdf-header-eyebrow">
          <span>RP-AI Interview Assistant</span>
          <span>·</span>
          <span>Comprehensive Candidate Dossier</span>
        </div>
        <h1 class="pdf-header-title">Historical Interview &amp; Practice Assessment Portfolio</h1>
        <div class="pdf-header-meta">
          <span><strong>Generated:</strong> ${escapeHtml(exportDate)}</span>
          <span><strong>Total Records:</strong> ${totalReports} assessments</span>
        </div>
      </div>
      <div class="pdf-header-badge">
        <div class="pdf-doc-stamp">Master Portfolio</div>
      </div>
    </header>

    <!-- KPI Summary Grid -->
    <div class="pdf-hero-scorecard">
      <div class="pdf-hero-score-left">
        <div class="pdf-hero-score-circle">
          <span class="pdf-hero-score-val">${avgScore}</span>
          <span class="pdf-hero-score-denom">/10</span>
        </div>
        <div class="pdf-hero-score-details">
          <div class="pdf-hero-rating-badge" style="background: #edf3ee; color: #3a4d3f;">
            Lifetime Performance Portfolio
          </div>
          <p class="pdf-hero-rating-desc">Aggregated assessment metrics across full conversational mocks and targeted single question drills.</p>
        </div>
      </div>
      <div class="pdf-hero-meta-col">
        <div class="pdf-hero-meta-item"><strong>Total Records:</strong> ${totalReports}</div>
        <div class="pdf-hero-meta-item"><strong>Full Mocks:</strong> ${mockReports.length}</div>
        <div class="pdf-hero-meta-item"><strong>Single Drills:</strong> ${singleReports.length}</div>
      </div>
    </div>

    <!-- Section 1: Full Mock Interviews -->
    <div class="pdf-division-title">
      <span>I. Full Multi-Turn Mock Interviews</span>
      <span style="font-family: ui-monospace, monospace; font-size: 8.5pt; color: #6e6456;">${mockReports.length} Session${mockReports.length === 1 ? '' : 's'}</span>
    </div>

    ${
      mockReports.length === 0
        ? '<p class="pdf-text-paragraph" style="font-style: italic; color: #8c8273;">No full mock interviews recorded yet.</p>'
        : mockReports
            .map((m, idx) => {
              const isHr = m.interview_type === 'hr'
              const formattedFeedback = formatMarkdownToHtml(m.feedback)
              const context = [m.company, m.location].filter(Boolean).join(' · ')
              const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' }) : ''
              const rating = getScoreRating(m.score)

              return `
              <div class="pdf-qa-box" style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed #e0d9cd; padding-bottom: 8px; margin-bottom: 10px;">
                  <div>
                    <div style="display: flex; gap: 6px; margin-bottom: 4px;">
                      <span class="pdf-pill pdf-pill--olive">Mock #${idx + 1}</span>
                      <span class="pdf-pill ${isHr ? 'pdf-pill--red' : ''}">${isHr ? 'HR &amp; Behavioral' : 'Technical'}</span>
                      <span class="pdf-pill">${escapeHtml(m.experience_level.toUpperCase())}</span>
                    </div>
                    <h3 style="font-family: Georgia, serif; font-size: 13pt; margin: 2px 0; color: #1a1714;">${escapeHtml(m.role)}</h3>
                    <div style="font-size: 8.5pt; color: #6e6456;">${context ? escapeHtml(context) + ' — ' : ''}${escapeHtml(dateStr)} (Session: ${escapeHtml(m.session_id)})</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-family: Georgia, serif; font-size: 18pt; font-weight: 700; color: #3a4d3f; line-height: 1;">${m.score}<span style="font-size: 9pt; color: #8c8273;">/10</span></div>
                    <div style="font-family: ui-monospace, monospace; font-size: 7pt; color: ${rating.color}; font-weight: 700;">${escapeHtml(rating.label.split(' ')[0])}</div>
                  </div>
                </div>

                <div class="pdf-feedback-content">
                  <div class="pdf-section-subtitle">Diagnostic Feedback</div>
                  ${formattedFeedback}
                </div>

                ${
                  m.transcript && m.transcript.length > 0
                    ? `
                    <div class="pdf-transcript-wrap">
                      <div class="pdf-section-subtitle">Conversation Transcript (${m.transcript.length} turns)</div>
                      ${m.transcript
                        .slice(0, 8)
                        .map((t) => {
                          const isCand = t.role === 'candidate'
                          return `
                          <div class="pdf-turn-box ${isCand ? 'pdf-turn--candidate' : 'pdf-turn--interviewer'}">
                            <div class="pdf-turn-speaker">${isCand ? 'Candidate' : 'Interviewer'}</div>
                            <div>${escapeHtml(t.content)}</div>
                          </div>
                        `
                        })
                        .join('')}
                      ${m.transcript.length > 8 ? `<p style="font-size: 8pt; color: #8c8273; font-style: italic; margin-top: 4px;">(+${m.transcript.length - 8} additional turns in full session dossier)</p>` : ''}
                    </div>
                  `
                    : ''
                }
              </div>
            `
            })
            .join('')
    }

    <!-- Section 2: Single Practice Drills -->
    <div class="pdf-division-title ${mockReports.length > 1 ? 'pdf-page-break' : ''}">
      <span>II. Single-Question Practice Drills</span>
      <span style="font-family: ui-monospace, monospace; font-size: 8.5pt; color: #6e6456;">${singleReports.length} Drill${singleReports.length === 1 ? '' : 's'}</span>
    </div>

    ${
      singleReports.length === 0
        ? '<p class="pdf-text-paragraph" style="font-style: italic; color: #8c8273;">No single practice drills recorded yet.</p>'
        : singleReports
            .map((r, idx) => {
              const formattedFeedback = formatMarkdownToHtml(r.feedback)
              const context = [r.company, r.location].filter(Boolean).join(' · ')
              const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' }) : ''

              return `
              <div class="pdf-qa-box" style="margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed #e0d9cd; padding-bottom: 6px; margin-bottom: 8px;">
                  <div>
                    <span class="pdf-pill">Drill #${idx + 1}</span>
                    <h3 style="font-family: Georgia, serif; font-size: 12pt; margin: 2px 0; color: #1a1714;">${escapeHtml(r.role || 'Single Question Practice')}</h3>
                    <div style="font-size: 8.5pt; color: #6e6456;">${context ? escapeHtml(context) + ' — ' : ''}${escapeHtml(dateStr)}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-family: Georgia, serif; font-size: 16pt; font-weight: 700; color: #3a4d3f; line-height: 1;">${r.score}<span style="font-size: 9pt; color: #8c8273;">/10</span></div>
                  </div>
                </div>

                <div class="pdf-qa-box pdf-qa-box--question" style="margin-bottom: 8px; padding: 6px 10px;">
                  <div class="pdf-qa-label">Question:</div>
                  <div class="pdf-qa-text">${escapeHtml(r.question)}</div>
                </div>

                <div class="pdf-qa-box pdf-qa-box--candidate" style="margin-bottom: 8px; padding: 6px 10px;">
                  <div class="pdf-qa-label">Response:</div>
                  <div class="pdf-qa-text">${escapeHtml(r.answer)}</div>
                </div>

                <div class="pdf-feedback-content">
                  <div class="pdf-section-subtitle">Diagnostic Feedback</div>
                  ${formattedFeedback}
                </div>
              </div>
            `
            })
            .join('')
    }

    <!-- Footer -->
    <footer class="pdf-footer">
      <span>RP-AI Interview Assistant · Comprehensive Candidate Portfolio</span>
      <span>100% Offline SQLite Backup &amp; Verification</span>
    </footer>
  </div>
</body>
</html>`
}

/**
 * Export functions for direct user invocation.
 */
export function exportSingleReportToPDF(report: SinglePracticeReportData): void {
  const html = generateSingleReportPrintHTML(report)
  printHTMLDocument(html)
}

export function exportMockInterviewReportToPDF(report: MockInterviewReportData): void {
  const html = generateMockReportPrintHTML(report)
  printHTMLDocument(html)
}

export function exportAllReportsToPDF(
  singleReports: ReportSummary[],
  mockReports: SavedInterviewReportSummary[],
): void {
  const html = generateReportsPrintHTML(singleReports, mockReports)
  printHTMLDocument(html)
}

/**
 * Generates a clean, beautifully formatted shareable text summary for clipboard sharing.
 */
export function generateShareableSummaryText(report: {
  score: number
  feedback: string
  role?: string | null
  company?: string | null
  experience_level?: string | null
  interview_type?: string | null
  question?: string | null
  dimensions?: Record<string, number | undefined> | {
    technical_accuracy?: number
    communication_clarity?: number
    problem_solving?: number
    experience_depth?: number
    situational_awareness?: number
  } | null
}): string {
  const rating = getScoreRating(report.score)
  const roleName = report.role || 'Interview Practice'
  const companyName = report.company ? ` @ ${report.company}` : ''
  const trackName = report.interview_type === 'hr' ? 'HR / Behavioral Track' : 'Technical Track'

  let summary = `🎯 Interview Assessment Summary — RP-AI Assistant\n`
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  summary += `📌 Role: ${roleName}${companyName}\n`
  if (report.experience_level) {
    summary += `🎓 Level: ${report.experience_level.toUpperCase()}\n`
  }
  summary += `🏷️ Track: ${trackName}\n`
  summary += `📊 Diagnostic Score: ${report.score}/10 (${rating.label})\n`

  if (report.dimensions) {
    summary += `\n📈 Competency Dimensions:\n`
    Object.entries(report.dimensions).forEach(([key, val]) => {
      if (typeof val === 'number') {
        const formattedKey = key
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        summary += ` • ${formattedKey}: ${val}/10\n`
      }
    })
  }

  if (report.question) {
    summary += `\n❓ Question Drill:\n"${report.question.slice(0, 140)}${report.question.length > 140 ? '...' : ''}"\n`
  }

  // Extract key summary lines from markdown feedback
  const feedbackLines = report.feedback
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .slice(0, 3)

  if (feedbackLines.length > 0) {
    summary += `\n💡 Key Feedback Highlights:\n`
    feedbackLines.forEach((line) => {
      const cleanLine = line.replace(/^\*+\s*/, '').replace(/\*\*/g, '')
      summary += ` • ${cleanLine}\n`
    })
  }

  summary += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  summary += `⚡ Practiced with RP-AI Interview Assistant`

  return summary
}

/**
 * Copies the formatted report summary to the system clipboard.
 */
export async function copyShareableSummary(report: {
  score: number
  feedback: string
  role?: string | null
  company?: string | null
  experience_level?: string | null
  interview_type?: string | null
  question?: string | null
  dimensions?: Record<string, number | undefined> | {
    technical_accuracy?: number
    communication_clarity?: number
    problem_solving?: number
    experience_depth?: number
    situational_awareness?: number
  } | null
}): Promise<boolean> {
  const text = generateShareableSummaryText(report)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {
    console.warn('Navigator clipboard failed, falling back to textarea execCommand:', e)
  }

  // Fallback for older browsers / iframe security contexts
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err)
    return false
  }
}
