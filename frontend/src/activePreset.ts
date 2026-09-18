/**
 * The "currently active" interview preset is a browser-local convenience,
 * not something worth persisting server-side. The preset LIST itself is
 * saved to SQLite (backend/app/db/models.py's InterviewPreset) because
 * that's real data worth keeping; which one is "selected right now" is
 * cheaper and more natural to keep here, so it survives page navigation
 * and reloads without needing a "default" flag on the database row that
 * would have to be unset/reset every time selection changes.
 */

const STORAGE_KEY = 'rp-ai:active-preset-id'

export function getActivePresetId(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function setActivePresetId(id: number | null): void {
  if (id === null) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, String(id))
  }
}