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