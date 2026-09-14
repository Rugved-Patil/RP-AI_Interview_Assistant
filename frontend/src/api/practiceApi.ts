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

export interface StartSessionResponse {
  session_id: string
  question: string
}

export interface GradeResponse {
  session_id: string
  score: number
  feedback: string
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Request failed (${response.status}): ${body}`)
  }
  return response.json() as Promise<T>
}

export function startSituationalSession(): Promise<StartSessionResponse> {
  return fetch(`${API_BASE_URL}/sessions/situational`, { method: 'POST' }).then(
    parseOrThrow<StartSessionResponse>,
  )
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