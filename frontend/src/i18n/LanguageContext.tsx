import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import {
  type LanguageConfig,
  type LanguageId,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguageConfig,
} from './languages'
import { TRANSLATIONS } from './locales'
import { saveSpeechSettings } from '../speechSettings'

interface LanguageContextType {
  language: LanguageId
  currentLanguage: LanguageId
  languageConfig: LanguageConfig
  setLanguage: (lang: LanguageId) => void
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
  formatDomain: (domain: string) => string
  formatDifficulty: (diff: string) => string
  formatCategory: (cat: string) => string
  supportedLanguages: LanguageConfig[]
}

const STORAGE_KEY = 'rp_ai_language'
const LANGUAGE_CHANGE_EVENT = 'rp_ai_language_changed'

const LanguageContext = createContext<LanguageContextType | null>(null)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageId>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageId
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.id === saved)) {
        return saved
      }
      // Check browser language preferences
      const navLang = navigator.language?.slice(0, 2) as LanguageId
      if (navLang && SUPPORTED_LANGUAGES.some((l) => l.id === navLang)) {
        return navLang
      }
    } catch {
      // Ignore
    }
    return DEFAULT_LANGUAGE
  })

  const languageConfig = useMemo(() => getLanguageConfig(language), [language])

  const setLanguage = useCallback((newLang: LanguageId) => {
    if (!SUPPORTED_LANGUAGES.some((l) => l.id === newLang)) return
    setLanguageState(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
      window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: newLang }))

      // Automatically synchronize speech settings with the new language speechCode
      const targetConfig = getLanguageConfig(newLang)

      // Reset voice URI so synthesizer picks the best native voice for this language
      saveSpeechSettings({
        dictationLang: targetConfig.speechCode,
        voiceURI: '',
      })
    } catch (err) {
      console.error('Failed to persist language:', err)
    }
  }, [])

  // Subscribe to external language change events
  useEffect(() => {
    const handleLangEvent = (e: Event) => {
      const custom = e as CustomEvent<LanguageId>
      if (custom.detail && custom.detail !== language) {
        setLanguageState(custom.detail)
      }
    }
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLangEvent)
    return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLangEvent)
  }, [language])

  // Translation helper function with parameter interpolation
  const t = useCallback(
    (key: string, params?: Record<string, string | number>, fallback?: string): string => {
      const currentDict = TRANSLATIONS[language] || TRANSLATIONS.en
      let str = currentDict[key] || TRANSLATIONS.en[key] || fallback || key

      if (params) {
        Object.entries(params).forEach(([paramKey, val]) => {
          str = str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val))
        })
      }

      return str
    },
    [language],
  )

  const formatDomain = useCallback(
    (domain: string): string => {
      if (!domain) return domain
      const norm = domain.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      const key = `domain.${norm}`
      return t(key, undefined, domain)
    },
    [t],
  )

  const formatDifficulty = useCallback(
    (diff: string): string => {
      if (!diff) return diff
      const key = `difficulty.${diff.toLowerCase()}`
      return t(key, undefined, diff.charAt(0).toUpperCase() + diff.slice(1).toLowerCase())
    },
    [t],
  )

  const formatCategory = useCallback(
    (cat: string): string => {
      if (!cat) return cat
      const key = `category.${cat.toLowerCase()}`
      return t(key, undefined, cat.toUpperCase())
    },
    [t],
  )

  const value = useMemo(
    () => ({
      language,
      currentLanguage: language,
      languageConfig,
      setLanguage,
      t,
      formatDomain,
      formatDifficulty,
      formatCategory,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, languageConfig, setLanguage, t, formatDomain, formatDifficulty, formatCategory],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    // Fallback if rendered outside provider
    const fallbackConfig = getLanguageConfig(DEFAULT_LANGUAGE)
    const fallbackT = (key: string, params?: Record<string, string | number>, fallback?: string) => {
      let str = TRANSLATIONS.en[key] || fallback || key
      if (params) {
        Object.entries(params).forEach(([paramKey, val]) => {
          str = str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val))
        })
      }
      return str
    }
    return {
      language: DEFAULT_LANGUAGE,
      currentLanguage: DEFAULT_LANGUAGE,
      languageConfig: fallbackConfig,
      setLanguage: () => {},
      t: fallbackT,
      formatDomain: (domain: string) => {
        if (!domain) return domain
        const norm = domain.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        return fallbackT(`domain.${norm}`, undefined, domain)
      },
      formatDifficulty: (diff: string) => {
        if (!diff) return diff
        return fallbackT(`difficulty.${diff.toLowerCase()}`, undefined, diff)
      },
      formatCategory: (cat: string) => {
        if (!cat) return cat
        return fallbackT(`category.${cat.toLowerCase()}`, undefined, cat)
      },
      supportedLanguages: SUPPORTED_LANGUAGES,
    }
  }
  return ctx
}
