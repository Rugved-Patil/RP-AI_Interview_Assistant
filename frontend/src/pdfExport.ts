import type { ReportSummary, SavedInterviewReportSummary } from './api/practiceApi'

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
    .replace(/^###\s+(.*?)$/gm, '<h4 class="pdf-section-subtitle">$1</h4>')
    .replace(/^##\s+(.*?)$/gm, '<h3 class="pdf-section-title">$1</h3>')
    .replace(/^#\s+(.*?)$/gm, '<h2 class="pdf-section-title">$1</h2>')

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

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
        trimmed.startsWith('<li')
      ) {
        return trimmed
      }
      return `<p class="pdf-text-paragraph">${trimmed.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

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
  <title>RP-AI Interview Assistant - All Saved Reports</title>
  <style>
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
      font-size: 11pt;
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
      margin-bottom: 20px;
    }

    .pdf-header-eyebrow {
      font-family: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #3a4d3f;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .pdf-header-title {
      font-family: Georgia, Cambria, "Times New Roman", Times, serif;
      font-size: 20pt;
      font-weight: 700;
      color: #1a1714;
      margin: 0 0 6px 0;
      letter-spacing: -0.01em;
    }

    .pdf-header-meta {
      font-size: 9.5pt;
      color: #635b50;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* KPI Summary Cards */
    .pdf-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }

    .pdf-kpi-card {
      background: #f7f4ee;
      border: 1px solid #d8d0c3;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
    }

    .pdf-kpi-val {
      font-family: Georgia, serif;
      font-size: 16pt;
      font-weight: 700;
      color: #3a4d3f;
    }

    .pdf-kpi-label {
      font-family: ui-monospace, monospace;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6e6456;
      margin-top: 2px;
    }

    /* Section Headings */
    .pdf-division-title {
      font-family: Georgia, serif;
      font-size: 14pt;
      font-weight: 700;
      color: #1a1714;
      border-bottom: 1px solid #d8d0c3;
      padding-bottom: 6px;
      margin: 24px 0 14px 0;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .pdf-division-count {
      font-family: ui-monospace, monospace;
      font-size: 8.5pt;
      color: #6e6456;
      font-weight: normal;
    }

    /* Report Card */
    .pdf-report-card {
      background: #ffffff;
      border: 1px solid #d8d0c3;
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .pdf-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px dashed #e0d9cd;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .pdf-card-title-block {
      flex: 1;
    }

    .pdf-card-badge-row {
      display: flex;
      gap: 6px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }

    .pdf-pill {
      font-family: ui-monospace, monospace;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      background: #e9e3d6;
      color: #38322a;
    }

    .pdf-pill--olive {
      background: #3a4d3f;
      color: #ffffff;
    }

    .pdf-pill--red {
      background: #8c3b2d;
      color: #ffffff;
    }

    .pdf-card-role {
      font-family: Georgia, serif;
      font-size: 13pt;
      font-weight: 700;
      color: #1a1714;
      margin: 2px 0 2px 0;
    }

    .pdf-card-context {
      font-size: 8.5pt;
      color: #6e6456;
    }

    .pdf-card-score-box {
      text-align: right;
      flex-shrink: 0;
      margin-left: 12px;
    }

    .pdf-score-number {
      font-family: Georgia, serif;
      font-size: 18pt;
      font-weight: 700;
      color: #3a4d3f;
      line-height: 1;
    }

    .pdf-score-denom {
      font-size: 10pt;
      color: #8c8273;
    }

    .pdf-score-caption {
      font-family: ui-monospace, monospace;
      font-size: 7pt;
      text-transform: uppercase;
      color: #8c8273;
    }

    /* Subsections */
    .pdf-section-title {
      font-family: Georgia, serif;
      font-size: 11pt;
      font-weight: 700;
      color: #2b2721;
      margin: 12px 0 4px 0;
    }

    .pdf-section-subtitle {
      font-family: Georgia, serif;
      font-size: 10pt;
      font-weight: 700;
      color: #3a4d3f;
      margin: 10px 0 3px 0;
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
      margin-bottom: 3px;
      line-height: 1.45;
      color: #2b2721;
    }

    /* Question / Answer Boxes */
    .pdf-qa-box {
      background: #fbf9f5;
      border: 1px solid #e5dfd4;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
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
      margin-top: 12px;
      border-top: 1px solid #ede7db;
      padding-top: 10px;
    }

    .pdf-turn-box {
      margin-bottom: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 9pt;
      line-height: 1.45;
    }

    .pdf-turn--interviewer {
      background: #f2efe9;
      border-left: 3px solid #3a4d3f;
    }

    .pdf-turn--candidate {
      background: #fcfbfa;
      border-left: 3px solid #8c3b2d;
    }

    .pdf-turn-speaker {
      font-family: ui-monospace, monospace;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 2px;
      color: #4a4339;
    }

    /* Footer */
    .pdf-footer {
      border-top: 1px solid #d8d0c3;
      padding-top: 8px;
      margin-top: 30px;
      font-family: ui-monospace, monospace;
      font-size: 7.5pt;
      color: #8c8273;
      display: flex;
      justify-content: space-between;
    }

    .pdf-page-break {
      page-break-before: always;
      break-before: always;
    }
  </style>
</head>
<body>
  <div class="pdf-container">
    <!-- Header -->
    <header class="pdf-header">
      <div class="pdf-header-eyebrow">RP-AI Interview Assistant · Comprehensive Candidate Dossier</div>
      <h1 class="pdf-header-title">Historical Interview &amp; Practice Assessment Report</h1>
      <div class="pdf-header-meta">
        <span>Generated: ${escapeHtml(exportDate)}</span>
        <span>Confidential Evaluation Record</span>
      </div>
    </header>

    <!-- KPI Summary -->
    <div class="pdf-kpi-grid">
      <div class="pdf-kpi-card">
        <div class="pdf-kpi-val">${totalReports}</div>
        <div class="pdf-kpi-label">Total Saved Reports</div>
      </div>
      <div class="pdf-kpi-card">
        <div class="pdf-kpi-val">${mockReports.length}</div>
        <div class="pdf-kpi-label">Full Mock Interviews</div>
      </div>
      <div class="pdf-kpi-card">
        <div class="pdf-kpi-val">${singleReports.length}</div>
        <div class="pdf-kpi-label">Single Practice Drills</div>
      </div>
      <div class="pdf-kpi-card">
        <div class="pdf-kpi-val">${avgScore} <span style="font-size: 10pt; color: #8c8273;">/10</span></div>
        <div class="pdf-kpi-label">Overall Average Score</div>
      </div>
    </div>

    <!-- Section 1: Full Mock Interviews -->
    <div class="pdf-division-title">
      <span>I. Full Multi-Turn Mock Interviews</span>
      <span class="pdf-division-count">${mockReports.length} Session${mockReports.length === 1 ? '' : 's'}</span>
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

              return `
              <div class="pdf-report-card">
                <div class="pdf-card-header">
                  <div class="pdf-card-title-block">
                    <div class="pdf-card-badge-row">
                      <span class="pdf-pill pdf-pill--olive">Mock #${idx + 1}</span>
                      <span class="pdf-pill ${isHr ? 'pdf-pill--red' : ''}">${isHr ? 'HR & Behavioral Track' : 'Technical Track'}</span>
                      <span class="pdf-pill">${escapeHtml(m.experience_level)} Level</span>
                    </div>
                    <h3 class="pdf-card-role">${escapeHtml(m.role)}</h3>
                    <div class="pdf-card-context">${context ? escapeHtml(context) + ' — ' : ''}${escapeHtml(dateStr)} (Session: ${escapeHtml(m.session_id)})</div>
                  </div>
                  <div class="pdf-card-score-box">
                    <div class="pdf-score-number">${m.score}<span class="pdf-score-denom">/10</span></div>
                    <div class="pdf-score-caption">Holistic Score</div>
                  </div>
                </div>

                <div class="pdf-feedback-block">
                  <div class="pdf-section-title">Diagnostic Assessment &amp; Feedback</div>
                  ${formattedFeedback}
                </div>

                ${
                  m.transcript && m.transcript.length > 0
                    ? `
                    <div class="pdf-transcript-wrap">
                      <div class="pdf-section-title">Interview Conversation Transcript (${m.transcript.length} turns)</div>
                      ${m.transcript
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
    <div class="pdf-division-title ${mockReports.length > 2 ? 'pdf-page-break' : ''}">
      <span>II. Single-Question Practice Drills</span>
      <span class="pdf-division-count">${singleReports.length} Drill${singleReports.length === 1 ? '' : 's'}</span>
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
              <div class="pdf-report-card">
                <div class="pdf-card-header">
                  <div class="pdf-card-title-block">
                    <div class="pdf-card-badge-row">
                      <span class="pdf-pill">Drill #${idx + 1}</span>
                      <span class="pdf-pill">Single Question</span>
                    </div>
                    <h3 class="pdf-card-role">${escapeHtml(r.role || 'General Practice')}</h3>
                    <div class="pdf-card-context">${context ? escapeHtml(context) + ' — ' : ''}${escapeHtml(dateStr)} (Session: ${escapeHtml(r.session_id)})</div>
                  </div>
                  <div class="pdf-card-score-box">
                    <div class="pdf-score-number">${r.score}<span class="pdf-score-denom">/10</span></div>
                    <div class="pdf-score-caption">Diagnostic Score</div>
                  </div>
                </div>

                <div class="pdf-qa-box">
                  <div class="pdf-qa-label">Question Asked:</div>
                  <div class="pdf-qa-text">${escapeHtml(r.question)}</div>
                </div>

                <div class="pdf-qa-box">
                  <div class="pdf-qa-label">Candidate Answer:</div>
                  <div class="pdf-qa-text">${escapeHtml(r.answer)}</div>
                </div>

                <div class="pdf-feedback-block">
                  <div class="pdf-section-title">Diagnostic Feedback</div>
                  ${formattedFeedback}
                </div>
              </div>
            `
            })
            .join('')
    }

    <!-- Footer -->
    <footer class="pdf-footer">
      <span>RP-AI Interview Assistant · Evidence-Based Assessment Dossier</span>
      <span>Offline SQLite Data Export</span>
    </footer>
  </div>
</body>
</html>`
}

export function exportAllReportsToPDF(
  singleReports: ReportSummary[],
  mockReports: SavedInterviewReportSummary[],
): void {
  const htmlContent = generateReportsPrintHTML(singleReports, mockReports)

  // Use an invisible iframe to trigger the browser's native Print to PDF
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

  // Wait for images and fonts in iframe to render before opening print dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Print dialog failed:', e)
    } finally {
      // Clean up iframe after user completes/cancels print dialog
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 2000)
    }
  }, 400)
}
