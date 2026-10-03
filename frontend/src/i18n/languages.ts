/**
 * Language definitions and speech configuration for RP-AI Interview Assistant.
 */

export type LanguageId =
  | 'en'
  | 'hi'
  | 'mr'
  | 'de'
  | 'es'
  | 'fr'
  | 'ja'
  | 'gu'
  | 'ta'
  | 'te'
  | 'bn'
  | 'kn'

export interface LanguageConfig {
  id: LanguageId
  label: string
  nativeName: string
  speechCode: string // BCP-47 tag for Web Speech API (STT & TTS)
  speechPrefix: string // prefix to match voices e.g. 'hi', 'mr', 'de'
  flag: string
  region: string
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    id: 'en',
    label: 'English',
    nativeName: 'English',
    speechCode: 'en-US',
    speechPrefix: 'en',
    flag: '🇺🇸',
    region: 'Global / US',
  },
  {
    id: 'hi',
    label: 'Hindi',
    nativeName: 'हिन्दी',
    speechCode: 'hi-IN',
    speechPrefix: 'hi',
    flag: '🇮🇳',
    region: 'India',
  },
  {
    id: 'mr',
    label: 'Marathi',
    nativeName: 'मराठी',
    speechCode: 'mr-IN',
    speechPrefix: 'mr',
    flag: '🇮🇳',
    region: 'Maharashtra, India',
  },
  {
    id: 'de',
    label: 'German',
    nativeName: 'Deutsch',
    speechCode: 'de-DE',
    speechPrefix: 'de',
    flag: '🇩🇪',
    region: 'Germany / DACH',
  },
  {
    id: 'es',
    label: 'Spanish',
    nativeName: 'Español',
    speechCode: 'es-ES',
    speechPrefix: 'es',
    flag: '🇪🇸',
    region: 'Spain / Latin America',
  },
  {
    id: 'fr',
    label: 'French',
    nativeName: 'Français',
    speechCode: 'fr-FR',
    speechPrefix: 'fr',
    flag: '🇫🇷',
    region: 'France / Francophone',
  },
  {
    id: 'ja',
    label: 'Japanese',
    nativeName: '日本語',
    speechCode: 'ja-JP',
    speechPrefix: 'ja',
    flag: '🇯🇵',
    region: 'Japan',
  },
  {
    id: 'gu',
    label: 'Gujarati',
    nativeName: 'ગુજરાતી',
    speechCode: 'gu-IN',
    speechPrefix: 'gu',
    flag: '🇮🇳',
    region: 'Gujarat, India',
  },
  {
    id: 'ta',
    label: 'Tamil',
    nativeName: 'தமிழ்',
    speechCode: 'ta-IN',
    speechPrefix: 'ta',
    flag: '🇮🇳',
    region: 'Tamil Nadu, India',
  },
  {
    id: 'te',
    label: 'Telugu',
    nativeName: 'తెలుగు',
    speechCode: 'te-IN',
    speechPrefix: 'te',
    flag: '🇮🇳',
    region: 'Andhra & Telangana, India',
  },
  {
    id: 'bn',
    label: 'Bengali',
    nativeName: 'বাংলা',
    speechCode: 'bn-IN',
    speechPrefix: 'bn',
    flag: '🇮🇳',
    region: 'Bengal / India',
  },
  {
    id: 'kn',
    label: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    speechCode: 'kn-IN',
    speechPrefix: 'kn',
    flag: '🇮🇳',
    region: 'Karnataka, India',
  },
]

export const DEFAULT_LANGUAGE: LanguageId = 'en'

export function getLanguageConfig(id: string): LanguageConfig {
  const found = SUPPORTED_LANGUAGES.find((l) => l.id === id)
  return found || SUPPORTED_LANGUAGES[0]
}
