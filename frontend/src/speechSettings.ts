/**
 * Global Speech & Dictation Settings Manager
 * Persists voice synthesis preferences (voice URI, speed rate, pitch) and dictation language
 * in localStorage and broadcasts changes across components.
 */

export interface SpeechSettings {
  voiceURI: string
  rate: number // 0.5 to 2.0 (default 1.0)
  pitch: number // 0.5 to 1.5 (default 1.0)
  dictationLang: string // e.g. 'en-US', 'en-GB', 'en-IN'
}

const STORAGE_KEY = 'rp_ai_speech_settings'
const SPEECH_SETTINGS_EVENT = 'rp_ai_speech_settings_changed'

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  dictationLang: 'en-US',
}

export function getSpeechSettings(): SpeechSettings {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SPEECH_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : DEFAULT_SPEECH_SETTINGS.voiceURI,
      rate: typeof parsed.rate === 'number' && parsed.rate >= 0.5 && parsed.rate <= 2.0 ? parsed.rate : 1.0,
      pitch: typeof parsed.pitch === 'number' && parsed.pitch >= 0.5 && parsed.pitch <= 1.5 ? parsed.pitch : 1.0,
      dictationLang: typeof parsed.dictationLang === 'string' ? parsed.dictationLang : 'en-US',
    }
  } catch {
    return DEFAULT_SPEECH_SETTINGS
  }
}

export function saveSpeechSettings(settings: Partial<SpeechSettings>): SpeechSettings {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_SETTINGS
  const current = getSpeechSettings()
  const updated: SpeechSettings = {
    ...current,
    ...settings,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent(SPEECH_SETTINGS_EVENT, { detail: updated }))
  } catch (err) {
    console.error('Failed to save speech settings:', err)
  }
  return updated
}

export function subscribeSpeechSettings(callback: (settings: SpeechSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const custom = e as CustomEvent<SpeechSettings>
    callback(custom.detail || getSpeechSettings())
  }
  window.addEventListener(SPEECH_SETTINGS_EVENT, handler)
  return () => window.removeEventListener(SPEECH_SETTINGS_EVENT, handler)
}
