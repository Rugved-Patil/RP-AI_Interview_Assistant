/**
 * Thin wrapper around the situational-practice backend endpoints
 * (backend/app/api/routes/sessions.py, grading.py).
 *
 * Hardcoded to localhost:8000 rather than read from a Vite env var - this
 * project is local-only by design (scope doc Section 2/8: no public
 * deployment), so there's currently only ever one real value this could
 * be. Worth promoting to VITE_API_BASE_URL later if that assumption ever
 * changes, but not before it's actually needed - not a decision to
 * pre-engineer for.
 */

export const API_BASE_URL = 'http://localhost:8000'

/**
 * Longest answer the backend accepts. Mirrors MAX_ANSWER_LENGTH in
 * backend/app/schemas/session.py - keep the two in sync. Used as the
 * textarea's maxLength so the user is stopped at the limit instead of
 * getting a 422 back after clicking Submit.
 */
export const MAX_ANSWER_LENGTH = 5000

export interface StartSessionRequest {
  role: string
  company?: string
  location?: string
  question?: string
}

export interface StartSessionResponse {
  session_id: string
  question: string
}

export interface GradeResponse {
  session_id: string
  score: number
  feedback: string
}
export interface SaveReportResponse {
  id: number
  session_id: string
  saved: boolean
}

export interface ReportSummary {
  id: number
  session_id: string
  question: string
  answer: string
  score: number
  feedback: string
  role: string | null
  company: string | null
  location: string | null
  created_at: string
}

export interface PresetIn {
  role: string
  company?: string
  location?: string
}

export interface PresetSummary {
  id: number
  role: string
  company: string | null
  location: string | null
  created_at: string
}

export interface DeletePresetResponse {
  id: number
  deleted: boolean
}

export function createPreset(body: PresetIn): Promise<PresetSummary> {
  return fetch(`${API_BASE_URL}/presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<PresetSummary>)
}

export function listPresets(): Promise<PresetSummary[]> {
  return fetch(`${API_BASE_URL}/presets`).then(parseOrThrow<PresetSummary[]>)
}

export function getPreset(id: number): Promise<PresetSummary> {
  return fetch(`${API_BASE_URL}/presets/${id}`).then(parseOrThrow<PresetSummary>)
}

export function updatePreset(id: number, body: PresetIn): Promise<PresetSummary> {
  return fetch(`${API_BASE_URL}/presets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<PresetSummary>)
}

export function deletePreset(id: number): Promise<DeletePresetResponse> {
  return fetch(`${API_BASE_URL}/presets/${id}`, { method: 'DELETE' }).then(
    parseOrThrow<DeletePresetResponse>,
  )
}

export function saveReport(sessionId: string): Promise<SaveReportResponse> {
  return fetch(`${API_BASE_URL}/sessions/${sessionId}/save`, { method: 'POST' }).then(
    parseOrThrow<SaveReportResponse>,
  )
}

export function listReports(): Promise<ReportSummary[]> {
  return fetch(`${API_BASE_URL}/reports`).then(parseOrThrow<ReportSummary[]>)
}

export interface DeleteReportResponse {
  id: number
  deleted: boolean
}

export function deleteReport(id: number): Promise<DeleteReportResponse> {
  return fetch(`${API_BASE_URL}/reports/${id}`, { method: 'DELETE' }).then(
    parseOrThrow<DeleteReportResponse>,
  )
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Request failed (${response.status}): ${body}`)
  }
  return response.json() as Promise<T>
}

export function startSituationalSession(body: StartSessionRequest): Promise<StartSessionResponse> {
  return fetch(`${API_BASE_URL}/sessions/situational`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<StartSessionResponse>)
}

export function startBehavioralSession(body: StartSessionRequest): Promise<StartSessionResponse> {
  return fetch(`${API_BASE_URL}/sessions/behavioral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<StartSessionResponse>)
}

export async function submitAnswer(sessionId: string, answer: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to submit answer (${response.status}): ${body}`)
  }
}

export function gradeSession(sessionId: string): Promise<GradeResponse> {
  return fetch(`${API_BASE_URL}/sessions/${sessionId}/grade`, { method: 'POST' }).then(
    parseOrThrow<GradeResponse>,
  )
}

export interface StartInterviewRequest {
  interview_type: 'hr' | 'technical'
  experience_level: 'junior' | 'mid' | 'senior'
  role: string
  company?: string
  location?: string
}

export interface StartInterviewResponse {
  session_id: string
  first_question: string
}

export interface InterviewAnswerResponse {
  session_id: string
  interviewer_message: string | null
  interview_ended: boolean
  turn_number: number
}

export interface EndInterviewResponse {
  session_id: string
  status: string
}

export interface InterviewDimensions {
  technical_correctness: number
  depth_of_knowledge: number
  problem_solving: number
  communication: number
  practical_readiness: number
}

export interface InterviewGradeResponse {
  session_id: string
  score: number
  feedback: string
  dimensions?: InterviewDimensions | null
}

export function startInterview(body: StartInterviewRequest): Promise<StartInterviewResponse> {
  return fetch(`${API_BASE_URL}/interviews/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<StartInterviewResponse>)
}

export function submitInterviewAnswer(
  sessionId: string,
  answer: string,
): Promise<InterviewAnswerResponse> {
  return fetch(`${API_BASE_URL}/interviews/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  }).then(parseOrThrow<InterviewAnswerResponse>)
}

export function endInterview(sessionId: string): Promise<EndInterviewResponse> {
  return fetch(`${API_BASE_URL}/interviews/${sessionId}/end`, {
    method: 'POST',
  }).then(parseOrThrow<EndInterviewResponse>)
}

export function gradeInterview(sessionId: string): Promise<InterviewGradeResponse> {
  return fetch(`${API_BASE_URL}/interviews/${sessionId}/grade`, {
    method: 'POST',
  }).then(parseOrThrow<InterviewGradeResponse>)
}

export interface SaveInterviewReportResponse {
  id: number
  session_id: string
  saved: boolean
}

export interface DeleteInterviewReportResponse {
  id: number
  deleted: boolean
}

export interface TurnSummary {
  role: 'interviewer' | 'candidate'
  content: string
}

export interface SavedInterviewReportSummary {
  id: number
  session_id: string
  interview_type: 'hr' | 'technical'
  experience_level: 'junior' | 'mid' | 'senior'
  role: string
  company: string | null
  location: string | null
  score: number
  feedback: string
  transcript: TurnSummary[]
  created_at: string
  dimensions?: InterviewDimensions | null
}

export function saveInterviewReport(sessionId: string): Promise<SaveInterviewReportResponse> {
  return fetch(`${API_BASE_URL}/interviews/${sessionId}/save`, {
    method: 'POST',
  }).then(parseOrThrow<SaveInterviewReportResponse>)
}

export function listInterviewReports(): Promise<SavedInterviewReportSummary[]> {
  return fetch(`${API_BASE_URL}/interviews/reports`).then(
    parseOrThrow<SavedInterviewReportSummary[]>,
  )
}

export function deleteInterviewReport(reportId: number): Promise<DeleteInterviewReportResponse> {
  return fetch(`${API_BASE_URL}/interviews/reports/${reportId}`, {
    method: 'DELETE',
  }).then(parseOrThrow<DeleteInterviewReportResponse>)
}

// --- Question Bank & Local RAG (Phase 3) -------------------------------------

export interface QuestionDoc {
  id: string
  question: string
  category: 'technical' | 'behavioral'
  domain: string
  tags: string[]
  difficulty: 'junior' | 'mid' | 'senior' | 'lead'
  company_archetypes?: string[]
  evaluation_criteria?: string | null
}

export interface RetrievedQuestion {
  id: string
  question: string
  category: string
  domain: string
  tags: string[]
  difficulty: string
  score: number
  matched_tags: string[]
  evaluation_criteria?: string | null
}

export interface QuestionListResponse {
  total: number
  items: QuestionDoc[]
}

export interface DomainStatItem {
  domain: string
  count: number
  categories: string[]
}

export interface QuestionBankStats {
  total_questions: number
  domains: DomainStatItem[]
  tags: string[]
  difficulties: string[]
  categories: string[]
}

export interface RAGSearchRequest {
  query: string
  category?: 'technical' | 'behavioral'
  domain?: string
  difficulty?: 'junior' | 'mid' | 'senior' | 'lead'
  role?: string
  company?: string
  top_k?: number
}

export interface RAGSearchResponse {
  query: string
  total_found: number
  retrieved_questions: RetrievedQuestion[]
  grounding_snippet?: string | null
}

export interface QuestionFilters {
  category?: 'technical' | 'behavioral'
  domain?: string
  difficulty?: 'junior' | 'mid' | 'senior' | 'lead'
  tag?: string
  search?: string
  limit?: number
  offset?: number
}

export function listQuestionBank(filters?: QuestionFilters): Promise<QuestionListResponse> {
  const params = new URLSearchParams()
  if (filters?.category) params.append('category', filters.category)
  if (filters?.domain) params.append('domain', filters.domain)
  if (filters?.difficulty) params.append('difficulty', filters.difficulty)
  if (filters?.tag) params.append('tag', filters.tag)
  if (filters?.search) params.append('search', filters.search)
  if (filters?.limit) params.append('limit', String(filters.limit))
  if (filters?.offset) params.append('offset', String(filters.offset))

  const queryString = params.toString() ? `?${params.toString()}` : ''
  return fetch(`${API_BASE_URL}/questions${queryString}`).then(parseOrThrow<QuestionListResponse>)
}

export function getQuestionBankStats(): Promise<QuestionBankStats> {
  return fetch(`${API_BASE_URL}/questions/domains`).then(parseOrThrow<QuestionBankStats>)
}

export function searchRAG(body: RAGSearchRequest): Promise<RAGSearchResponse> {
  return fetch(`${API_BASE_URL}/questions/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<RAGSearchResponse>)
}

export function getQuestionById(id: string): Promise<QuestionDoc> {
  return fetch(`${API_BASE_URL}/questions/${id}`).then(parseOrThrow<QuestionDoc>)
}

// --- Analytics & Progress Tracking (Phase 4) --------------------------------

export interface AnalyticsSummary {
  total_sessions: number
  total_single_drills: number
  total_mock_interviews: number
  average_score: number
  highest_score: number | null
  lowest_score: number | null
  recent_average: number | null
  score_trend: number
  single_average: number | null
  mock_average: number | null
  top_strength_domain: string | null
  focus_domain: string | null
}

export interface ScoreDataPoint {
  id: number
  session_id: string
  date: string
  session_type: 'single_technical' | 'single_behavioral' | 'mock_technical' | 'mock_hr'
  session_type_label: string
  role: string | null
  company: string | null
  score: number
  feedback_excerpt: string
  word_count: number
}

export interface DomainBreakdown {
  domain: string
  category: 'technical' | 'behavioral' | 'general'
  sessions_count: number
  average_score: number
  min_score: number
  max_score: number
  status: 'Strong' | 'Competent' | 'Needs Practice'
}

export interface ScoreDistribution {
  mastered: number
  proficient: number
  developing: number
  needs_work: number
}

export interface WeakSpotItem {
  domain: string
  topic: string
  average_score: number
  occurrences: number
  reasons: string[]
}

export interface CommunicationInsights {
  avg_word_count: number
  conciseness_status: 'Concise' | 'Balanced' | 'Verbose' | 'Not Enough Data'
  total_words_spoken_or_typed: number
  common_strength_keywords: string[]
  common_growth_keywords: string[]
}

export interface RecommendedDrill {
  question_id: string
  question: string
  domain: string
  category: string
  difficulty: string
  tags: string[]
  reason: string
}

export interface AnalyticsDashboardResponse {
  summary: AnalyticsSummary
  timeline: ScoreDataPoint[]
  domains: DomainBreakdown[]
  score_distribution: ScoreDistribution
  weak_spots: WeakSpotItem[]
  communication: CommunicationInsights
  recommended_drills: RecommendedDrill[]
}

export interface AnalyticsFilters {
  timeframe?: number
  session_type?: 'all' | 'mock' | 'single'
}

export function getAnalytics(filters?: AnalyticsFilters): Promise<AnalyticsDashboardResponse> {
  const params = new URLSearchParams()
  if (filters?.timeframe) params.append('timeframe', String(filters.timeframe))
  if (filters?.session_type && filters.session_type !== 'all') {
    params.append('session_type', filters.session_type)
  }

  const queryString = params.toString() ? `?${params.toString()}` : ''
  return fetch(`${API_BASE_URL}/analytics${queryString}`).then(
    parseOrThrow<AnalyticsDashboardResponse>,
  )
}

export function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return fetch(`${API_BASE_URL}/analytics/summary`).then(parseOrThrow<AnalyticsSummary>)
}

// --- Settings, Engine Diagnostics & Data Management (Phase 4/5) ------------

export interface SettingsConfigResponse {
  app_name: string
  evaluator_configured: boolean
  evaluator_key_preview: string | null
  interviewer_configured: boolean
  interviewer_key_preview: string | null
  rag_enabled: boolean
  rag_questions_count: number
  total_single_reports: number
  total_mock_reports: number
  total_presets: number
}

export interface ProviderVerificationResult {
  ok: boolean
  message: string
  provider: string
  latency_ms: number | null
}

export interface VerifyConnectionsResponse {
  evaluator: ProviderVerificationResult
  interviewer: ProviderVerificationResult
  all_ok: boolean
}

export interface ExportDataResponse {
  version: string
  exported_at: string
  saved_reports: Record<string, unknown>[]
  saved_interview_reports: Record<string, unknown>[]
  presets: Record<string, unknown>[]
}

export interface ImportDataRequest {
  saved_reports?: Record<string, unknown>[]
  saved_interview_reports?: Record<string, unknown>[]
  presets?: Record<string, unknown>[]
}

export interface ImportDataResponse {
  imported_single_reports: number
  imported_mock_reports: number
  imported_presets: number
  total_imported: number
  message: string
}

export interface ClearDataRequest {
  clear_single_reports?: boolean
  clear_mock_reports?: boolean
  clear_presets?: boolean
  clear_all?: boolean
}

export interface ClearDataResponse {
  cleared_single_reports: number
  cleared_mock_reports: number
  cleared_presets: number
  message: string
}

export function getSettingsConfig(): Promise<SettingsConfigResponse> {
  return fetch(`${API_BASE_URL}/settings/config`).then(parseOrThrow<SettingsConfigResponse>)
}

export function verifyEngineConnections(): Promise<VerifyConnectionsResponse> {
  return fetch(`${API_BASE_URL}/settings/verify`, {
    method: 'POST',
  }).then(parseOrThrow<VerifyConnectionsResponse>)
}

export async function exportDataJSON(): Promise<ExportDataResponse> {
  return fetch(`${API_BASE_URL}/data/export?format=json`).then(parseOrThrow<ExportDataResponse>)
}

export async function downloadDataCSV(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/data/export?format=csv`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Export failed (${res.status}): ${body}`)
  }
  return res.text()
}

export function importDataBackup(body: ImportDataRequest): Promise<ImportDataResponse> {
  return fetch(`${API_BASE_URL}/data/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<ImportDataResponse>)
}

export function clearDataStore(body: ClearDataRequest): Promise<ClearDataResponse> {
  return fetch(`${API_BASE_URL}/data/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<ClearDataResponse>)
}

/* =========================================================================
   Live Coding Sandbox Types & Endpoints
   ========================================================================= */

export type SupportedLanguage = 'python' | 'javascript'

export interface SandboxTestCase {
  id: number
  input_data: string
  expected_output: string
  description?: string | null
  is_hidden?: boolean
}

export interface SandboxTestResult {
  test_case_id: number
  passed: boolean
  input_data: string
  expected_output: string
  actual_output?: string | null
  execution_time_ms: number
  error?: string | null
}

export interface SandboxExampleCase {
  input: string
  output: string
  explanation?: string | null
}

export interface CodingProblemSummary {
  id: string
  title: string
  domain: string
  difficulty: 'junior' | 'mid' | 'senior' | 'lead' | string
  tags: string[]
  description_snippet: string
  test_cases_count: number
}

export interface CodingProblem {
  id: string
  title: string
  domain: string
  difficulty: 'junior' | 'mid' | 'senior' | 'lead' | string
  tags: string[]
  description: string
  constraints: string[]
  examples: SandboxExampleCase[]
  starter_code: Record<string, string>
  test_cases: SandboxTestCase[]
  entry_function?: string | null
}

export interface RunCodeRequest {
  code: string
  language: SupportedLanguage
  test_cases: SandboxTestCase[]
  custom_input?: string | null
  entry_function?: string | null
}

export interface RunCodeResponse {
  success: boolean
  stdout: string
  stderr: string
  results: SandboxTestResult[]
  all_passed: boolean
  passed_count: number
  total_count: number
  total_execution_time_ms: number
  error?: string | null
}

export interface GradeCodeRequest {
  problem_id?: string | null
  problem_title: string
  code: string
  language: SupportedLanguage
  test_results: SandboxTestResult[]
  role?: string | null
  experience_level?: string | null
}

export interface GradeCodeResponse {
  score: number
  time_complexity: string
  space_complexity: string
  correctness_assessment: string
  code_quality_feedback: string
  edge_cases_feedback: string
  recommended_improvements: string[]
  detailed_markdown: string
}

export function listCodingProblems(domain?: string, difficulty?: string): Promise<CodingProblemSummary[]> {
  const params = new URLSearchParams()
  if (domain && domain !== 'all') params.set('domain', domain)
  if (difficulty && difficulty !== 'all') params.set('difficulty', difficulty)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return fetch(`${API_BASE_URL}/sandbox/problems${qs}`).then(parseOrThrow<CodingProblemSummary[]>)
}

export function getCodingProblem(id: string): Promise<CodingProblem> {
  return fetch(`${API_BASE_URL}/sandbox/problems/${encodeURIComponent(id)}`).then(parseOrThrow<CodingProblem>)
}

export function runCodeInSandbox(body: RunCodeRequest): Promise<RunCodeResponse> {
  return fetch(`${API_BASE_URL}/sandbox/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<RunCodeResponse>)
}

export function gradeCodingSubmission(body: GradeCodeRequest): Promise<GradeCodeResponse> {
  return fetch(`${API_BASE_URL}/sandbox/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<GradeCodeResponse>)
}

export interface SaveCodingReportRequest {

  problem_id: string
  problem_title: string
  domain: string
  code: string
  language: SupportedLanguage
  score: number
  time_complexity: string
  space_complexity: string
  feedback_markdown: string
  role?: string | null
  company?: string | null
}

export function saveCodingReport(body: SaveCodingReportRequest): Promise<SaveReportResponse> {
  return fetch(`${API_BASE_URL}/sandbox/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(parseOrThrow<SaveReportResponse>)
}