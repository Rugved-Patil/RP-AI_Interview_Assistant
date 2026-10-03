import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearDataStore,
  downloadDataCSV,
  exportDataJSON,
  getSettingsConfig,
  importDataBackup,
  listInterviewReports,
  listReports,
  type ImportDataRequest,
  type SettingsConfigResponse,
  type VerifyConnectionsResponse,
  verifyEngineConnections,
} from '../api/practiceApi'
import { exportAllReportsToPDF } from '../pdfExport'
import {
  CheckIcon,
  DownloadIcon,
  MicIcon,
  PaletteIcon,
  RefreshIcon,
  SettingsIcon,
  SpeakerIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from '../components/Icons'
import { isNaturalVoice } from '../hooks/useSpeechSynthesis'
import {
  DEFAULT_SPEECH_SETTINGS,
  getSpeechSettings,
  saveSpeechSettings,
  type SpeechSettings,
} from '../speechSettings'
import { applyTheme, getActiveTheme, THEME_OPTIONS, type ThemeId } from '../themeManager'
import { useTranslation } from '../i18n/LanguageContext'
import { type LanguageId, SUPPORTED_LANGUAGES } from '../i18n/languages'
import './SettingsPage.css'

const SAMPLE_GREETINGS: Record<LanguageId, string> = {
  en: "Welcome to your AI interview assistant. Let's practice and elevate your skills.",
  hi: 'नमस्ते! एआई साक्षात्कार सहायक में आपका स्वागत है। चलिए अभ्यास शुरू करते हैं।',
  mr: 'नमस्कार! एआय मुलाखत सहाय्यकामध्ये आपले स्वागत आहे. चला सराव सुरू करूया.',
  de: 'Willkommen bei Ihrem KI-Interview-Assistenten. Lassen Sie uns üben.',
  es: 'Bienvenido a su asistente de entrevistas de IA. Practiquemos juntos.',
  fr: "Bienvenue dans votre assistant d'entretien IA. Entraînons-nous ensemble.",
  ja: 'AI面接アシスタントへようこそ。一緒に練習を始めましょう。',
  gu: 'નમસ્તે! એઆઈ ઇન્ટરવ્યુ સહાયકમાં આપનું સ્વાગત છે. ચાલો પ્રેક્ટિસ કરીએ.',
  ta: 'வணக்கம்! AI நேர்காணல் உதவியாளருக்கு வரவேற்கிறோம். பயிற்சி செய்வோம்.',
  te: 'నమస్కారం! AI ఇంటర్వ్యూ అసిస్టెంట్‌కి స్వాగతం. సాధన చేద్దాం.',
  bn: 'নমস্কার! এআই ইন্টারভিউ অ্যাসিস্ট্যান্টে আপনাকে স্বাগতম। চলুন অনুশীলন শুরু করি।',
  kn: 'ನಮಸ್ಕಾರ! AI ಸಂದರ್ಶನ ಸಹಾಯಕಕ್ಕೆ ಸ್ವಾಗತ. ಅಭ್ಯಾಸ ಪ್ರಾರಂಭಿಸೋಣ.',
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { language, languageConfig, setLanguage, t } = useTranslation()

  // Theme state
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getActiveTheme())

  // Speech settings state (Separating local form state from committed saved state)
  const [savedSpeech, setSavedSpeech] = useState<SpeechSettings>(() => getSpeechSettings())
  const [formSpeech, setFormSpeech] = useState<SpeechSettings>(() => getSpeechSettings())
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isTestingVoice, setIsTestingVoice] = useState(false)
  const testVoiceTimerRef = useRef<number | null>(null)

  // Backend config & engine state
  const [serverConfig, setServerConfig] = useState<SettingsConfigResponse | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyConnectionsResponse | null>(null)

  // Toast / Feedback message
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Clear modal state
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearOptions, setClearOptions] = useState({
    single: true,
    mock: true,
    presets: false,
  })
  const [clearing, setClearing] = useState(false)

  // File import ref
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load backend configuration
  const loadConfig = useCallback(async () => {
    try {
      const data = await getSettingsConfig()
      setServerConfig(data)
    } catch (err) {
      console.error('Failed to load settings config:', err)
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getSettingsConfig()
      .then((data) => {
        if (active) {
          setServerConfig(data)
          setLoadingConfig(false)
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Failed to load settings config:', err)
          setLoadingConfig(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  // Load available speech voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    function updateVoiceList() {
      const list = window.speechSynthesis.getVoices()
      if (list && list.length > 0) {
        setAvailableVoices(list)
      }
    }

    updateVoiceList()
    window.speechSynthesis.onvoiceschanged = updateVoiceList

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  // Check if form has unsaved speech changes
  const hasUnsavedSpeech = useMemo(() => {
    return (
      formSpeech.voiceURI !== savedSpeech.voiceURI ||
      formSpeech.rate !== savedSpeech.rate ||
      formSpeech.pitch !== savedSpeech.pitch ||
      formSpeech.dictationLang !== savedSpeech.dictationLang
    )
  }, [formSpeech, savedSpeech])

  const handleLanguageSelect = (langId: LanguageId) => {
    if (isTestingVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsTestingVoice(false)
    }
    setLanguage(langId)
    const updated = getSpeechSettings()
    setSavedSpeech(updated)
    setFormSpeech(updated)
    const target = SUPPORTED_LANGUAGES.find((l) => l.id === langId)
    showToast(`Switched interface & voice language to ${target?.nativeName || langId} (${target?.label}).`)
  }

  const handleThemeChange = (themeId: ThemeId) => {
    setSelectedTheme(themeId)
    applyTheme(themeId)
    const matched = THEME_OPTIONS.find((t) => t.id === themeId)
    showToast(`Applied ${matched?.name || themeId} theme.`)
  }

  const handleSaveAudioSettings = () => {
    if (isTestingVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsTestingVoice(false)
    }
    const updated = saveSpeechSettings(formSpeech)
    setSavedSpeech(updated)
    setFormSpeech(updated)
    showToast('Audio settings saved successfully! Active across all mock interviews and drills.')
  }

  const handleResetSpeech = () => {
    if (isTestingVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsTestingVoice(false)
    }
    setFormSpeech({
      ...DEFAULT_SPEECH_SETTINGS,
      dictationLang: languageConfig.speechCode,
    })
  }

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Speech synthesis is not supported in this browser.', 'error')
      return
    }

    if (testVoiceTimerRef.current !== null) {
      clearTimeout(testVoiceTimerRef.current)
      testVoiceTimerRef.current = null
    }

    if (isTestingVoice) {
      window.speechSynthesis.cancel()
      setIsTestingVoice(false)
      return
    }

    window.speechSynthesis.cancel()

    // Safety tick before speak using currently committed saved speech settings
    testVoiceTimerRef.current = window.setTimeout(() => {
      try {
        const text = SAMPLE_GREETINGS[language] || SAMPLE_GREETINGS.en
        const utterance = new SpeechSynthesisUtterance(text)

        if (savedSpeech.voiceURI) {
          const matched = availableVoices.find(
            (v) =>
              v.voiceURI === savedSpeech.voiceURI ||
              v.name === savedSpeech.voiceURI ||
              `${v.name} (${v.lang})` === savedSpeech.voiceURI,
          )
          if (matched) utterance.voice = matched
        } else {
          // Find natural voice matching active language
          const prefix = languageConfig.speechPrefix.toLowerCase()
          const matched =
            availableVoices.find((v) => v.lang.toLowerCase().startsWith(prefix) && isNaturalVoice(v)) ||
            availableVoices.find((v) => v.lang.toLowerCase().startsWith(prefix))
          if (matched) utterance.voice = matched
        }

        utterance.rate = savedSpeech.rate
        utterance.pitch = savedSpeech.pitch
        utterance.lang = savedSpeech.dictationLang || languageConfig.speechCode

        utterance.onstart = () => setIsTestingVoice(true)
        utterance.onend = () => setIsTestingVoice(false)
        utterance.onerror = (e) => {
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.warn('Voice test utterance error:', e)
          }
          setIsTestingVoice(false)
        }

        window.speechSynthesis.resume()
        window.speechSynthesis.speak(utterance)
      } catch (err) {
        console.error('Failed to speak sample text:', err)
        setIsTestingVoice(false)
      }
    }, 40)
  }

  const [exportingPDF, setExportingPDF] = useState(false)

  const handleVerifyEngines = async () => {
    try {
      setVerifying(true)
      setVerifyResult(null)
      const res = await verifyEngineConnections()
      setVerifyResult(res)
      await loadConfig()
      if (res.all_ok) {
        showToast('All engine connections verified successfully.')
      } else {
        showToast('One or more engines reported connection errors.', 'error')
      }
    } catch (err) {
      showToast(`Connection verification failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setVerifying(false)
    }
  }

  const handleExportPDF = async () => {
    try {
      setExportingPDF(true)
      const [singleReports, mockReports] = await Promise.all([
        listReports(),
        listInterviewReports(),
      ])

      if (singleReports.length === 0 && mockReports.length === 0) {
        showToast('No saved interview reports found to export.', 'error')
        return
      }

      exportAllReportsToPDF(singleReports, mockReports)
      showToast('Formatted PDF report dossier generated. Print/Save dialog opened.')
    } catch (err) {
      showToast(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setExportingPDF(false)
    }
  }

  const handleExportJSON = async () => {
    try {
      const data = await exportDataJSON()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `rp_interview_assistant_backup_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Exported complete data backup as JSON.')
    } catch (err) {
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleExportCSV = async () => {
    try {
      const csv = await downloadDataCSV()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `rp_interview_reports_${dateStr}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Exported interview reports as CSV.')
    } catch (err) {
      showToast(`CSV export failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content) as ImportDataRequest
        const res = await importDataBackup(parsed)
        showToast(res.message)
        loadConfig()
      } catch (err) {
        showToast(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON file'}`, 'error')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmClear = async () => {
    try {
      setClearing(true)
      const res = await clearDataStore({
        clear_single_reports: clearOptions.single,
        clear_mock_reports: clearOptions.mock,
        clear_presets: clearOptions.presets,
        clear_all: clearOptions.single && clearOptions.mock && clearOptions.presets,
      })
      showToast(res.message)
      setShowClearModal(false)
      loadConfig()
    } catch (err) {
      showToast(`Clear failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setClearing(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  // Filter voices prioritizing active language and natural/neural qualities
  const activePrefix = languageConfig.speechPrefix.toLowerCase()
  const matchingLangVoices = availableVoices.filter((v) =>
    v.lang.toLowerCase().startsWith(activePrefix),
  )
  const matchingNatural = matchingLangVoices.filter((v) => isNaturalVoice(v))

  const displayVoices =
    matchingNatural.length > 0
      ? matchingNatural
      : matchingLangVoices.length > 0
        ? matchingLangVoices
        : availableVoices.filter((v) => isNaturalVoice(v))

  return (
    <div className="settings-page">
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
        {t('nav.back', undefined, '← Back')}
      </button>

      <header className="settings-header">
        <div className="settings-title-row">
          <span className="settings-title-icon" aria-hidden="true">
            <SettingsIcon width={28} height={28} />
          </span>
          <div>
            <h1 className="settings-title">{t('settings.title', undefined, 'Application Settings')}</h1>
            <p className="settings-subtitle">
              {t('settings.subtitle', undefined, 'Personalize your language, natural voice synthesis, visual themes, and local offline data.')}
            </p>
          </div>
        </div>
      </header>

      {toast && (
        <div className={`settings-toast settings-toast--${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="settings-grid">
        {/* Section 1: Theme & Visual Style (8 Themes) */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">
              <PaletteIcon width={18} height={18} />
              {t('settings.theme_section_title', undefined, 'Theme & Visual Style')}
            </h2>
            <span className="settings-tag settings-tag--active">
              {THEME_OPTIONS.find((t) => t.id === selectedTheme)?.name}
            </span>
          </div>

          <div className="theme-options-grid">
            {THEME_OPTIONS.map((theme) => {
              const isSelected = theme.id === selectedTheme
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-card ${isSelected ? 'theme-card--selected' : ''}`}
                  onClick={() => handleThemeChange(theme.id)}
                >
                  <div className="theme-card__swatches" aria-hidden="true">
                    <span className="theme-swatch" style={{ backgroundColor: theme.previewColors.bg }} />
                    <span className="theme-swatch" style={{ backgroundColor: theme.previewColors.card }} />
                    <span className="theme-swatch" style={{ backgroundColor: theme.previewColors.primary }} />
                    <span className="theme-swatch" style={{ backgroundColor: theme.previewColors.accent }} />
                  </div>
                  <span className="theme-card__name">
                    {theme.name}
                    {isSelected && <CheckIcon width={14} height={14} style={{ color: 'var(--olive-deep)' }} />}
                  </span>
                  <span className="theme-card__desc">{theme.description}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Section 2: Unified Multilingual & Voice Localization */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">
              <SpeakerIcon width={18} height={18} />
              {t('settings.lang_section_title', undefined, 'Unified Language & Speech Localization')}
            </h2>
            <span className="settings-tag settings-tag--active">
              {languageConfig.flag} {languageConfig.nativeName} ({languageConfig.label})
            </span>
          </div>

          <p className="settings-hint" style={{ marginBottom: '1rem' }}>
            {t('settings.lang_section_desc', undefined, 'Selecting a language seamlessly synchronizes the website UI, AI voice synthesis (TTS), and microphone speech-to-text dictation (STT).')}
          </p>

          <div className="language-options-grid">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.id === language
              return (
                <button
                  key={lang.id}
                  type="button"
                  className={`language-card ${isSelected ? 'language-card--selected' : ''}`}
                  onClick={() => handleLanguageSelect(lang.id)}
                >
                  <div className="language-card__top">
                    <span className="language-card__flag">{lang.flag}</span>
                    {isSelected ? (
                      <CheckIcon width={14} height={14} style={{ color: 'var(--olive-deep)' }} />
                    ) : (
                      <span className="language-card__code">{lang.speechCode}</span>
                    )}
                  </div>
                  <span className="language-card__native">{lang.nativeName}</span>
                  <span className="language-card__label">
                    {lang.label} · <span style={{ opacity: 0.8 }}>{lang.region}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="settings-form-row" style={{ marginTop: '1.25rem' }}>
            <div className="settings-form-group">
              <label htmlFor="voice-select" className="settings-label">
                {t('settings.voice_label', undefined, 'Natural Voice Synthesis')}
              </label>
              <select
                id="voice-select"
                className="settings-select"
                value={formSpeech.voiceURI}
                onChange={(e) => setFormSpeech((prev) => ({ ...prev, voiceURI: e.target.value }))}
              >
                <option value="">{t('settings.voice_default', undefined, 'Default High-Quality Natural Voice')} ({languageConfig.nativeName})</option>
                {displayVoices.map((voice) => (
                  <option key={voice.voiceURI || voice.name} value={voice.voiceURI || voice.name}>
                    ✨ {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <p className="settings-hint">
                {t('settings.voice_hint', { language: languageConfig.label }, `Prioritizes high-fidelity natural & neural voices for ${languageConfig.label}.`)}
              </p>
            </div>

            <div className="settings-form-group">
              <label htmlFor="dictation-select" className="settings-label">
                <span>
                  <MicIcon width={14} height={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {t('settings.dictation_label', undefined, 'Microphone Dictation Language (STT)')}
                </span>
              </label>
              <input
                id="dictation-select"
                type="text"
                className="settings-input"
                value={`${languageConfig.speechCode} (${languageConfig.nativeName} - ${languageConfig.label})`}
                disabled
                readOnly
              />
              <p className="settings-hint">
                {t('settings.dictation_hint', undefined, 'Synchronized with active language selection for native browser STT.')}
              </p>
            </div>
          </div>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label htmlFor="speed-range" className="settings-label">
                {t('settings.rate_label', undefined, 'Speaking Rate')}
                <span className="settings-label-val">{formSpeech.rate.toFixed(2)}x</span>
              </label>
              <div className="settings-range-wrapper">
                <input
                  id="speed-range"
                  type="range"
                  className="settings-range"
                  min="0.5"
                  max="1.75"
                  step="0.05"
                  value={formSpeech.rate}
                  onChange={(e) => setFormSpeech((prev) => ({ ...prev, rate: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="settings-range-labels">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>1.75x</span>
              </div>
            </div>

            <div className="settings-form-group">
              <label htmlFor="pitch-range" className="settings-label">
                {t('settings.pitch_label', undefined, 'Voice Pitch')}
                <span className="settings-label-val">{formSpeech.pitch.toFixed(2)}</span>
              </label>
              <div className="settings-range-wrapper">
                <input
                  id="pitch-range"
                  type="range"
                  className="settings-range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={formSpeech.pitch}
                  onChange={(e) => setFormSpeech((prev) => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="settings-range-labels">
                <span>0.6</span>
                <span>1.0</span>
                <span>1.4</span>
              </div>
            </div>
          </div>

          <div className="settings-actions-row">
            <button
              type="button"
              className="settings-btn settings-btn--primary"
              onClick={handleSaveAudioSettings}
              disabled={!hasUnsavedSpeech}
            >
              <CheckIcon width={16} height={16} />
              {t('settings.save_audio_btn', undefined, 'Save Audio Settings')}
            </button>

            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleTestVoice}
            >
              <SpeakerIcon width={16} height={16} />
              {isTestingVoice ? t('settings.stop_voice_btn', undefined, 'Stop Speaking') : t('settings.test_voice_btn', undefined, 'Test Active Voice')}
            </button>

            <button
              type="button"
              className="settings-btn settings-btn--ghost"
              onClick={handleResetSpeech}
            >
              <RefreshIcon width={16} height={16} />
              {t('settings.reset_audio_btn', undefined, 'Reset Audio Form')}
            </button>
          </div>
          {hasUnsavedSpeech && (
            <p className="settings-hint" style={{ marginTop: '0.75rem', fontStyle: 'italic' }}>
              {t('settings.unsaved_audio_hint', undefined, '* You have unsaved voice modifications. Click "Save Audio Settings" to apply them across your mock interviews and audio tests.')}
            </p>
          )}
        </section>

        {/* Section 3: AI Assessment & Interview Engine */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">
              {t('settings.engine_section_title', undefined, 'AI Assessment & Interview Engine')}
            </h2>
            <span className="settings-tag settings-tag--active">
              {t('settings.status_operational', undefined, 'Operational')}
            </span>
          </div>

          <div className="engine-status-grid">
            <div className="engine-card">
              <div className="engine-card__header">
                <span className="engine-card__name">{t('settings.evaluator_engine_name', undefined, 'Diagnostic Evaluator Engine')}</span>
                <span
                  className={`engine-card__badge ${
                    serverConfig?.evaluator_configured
                      ? 'engine-card__badge--ok'
                      : 'engine-card__badge--missing'
                  }`}
                >
                  {serverConfig?.evaluator_configured ? t('settings.status_configured', undefined, 'Configured') : t('settings.status_missing', undefined, 'Missing Key')}
                </span>
              </div>
              <div className="engine-card__key">
                API Key: {serverConfig?.evaluator_key_preview || 'Not Configured'}
              </div>
              <p className="engine-card__desc">
                {t('settings.evaluator_engine_desc', undefined, 'Powers evidence-based scoring across 5 diagnostic dimensions with strict candidate level calibration.')}
              </p>
            </div>

            <div className="engine-card">
              <div className="engine-card__header">
                <span className="engine-card__name">{t('settings.interviewer_engine_name', undefined, 'Interviewer Dialogue Engine')}</span>
                <span
                  className={`engine-card__badge ${
                    serverConfig?.interviewer_configured
                      ? 'engine-card__badge--ok'
                      : 'engine-card__badge--missing'
                  }`}
                >
                  {serverConfig?.interviewer_configured ? t('settings.status_configured', undefined, 'Configured') : t('settings.status_missing', undefined, 'Missing Key')}
                </span>
              </div>
              <div className="engine-card__key">
                API Key: {serverConfig?.interviewer_key_preview || 'Not Configured'}
              </div>
              <p className="engine-card__desc">
                {t('settings.interviewer_engine_desc', undefined, 'Powers realistic multi-turn conversational follow-ups and adaptive interviewer questions.')}
              </p>
            </div>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">{t('qb.title', undefined, 'Question Bank')}</label>
            <div className="engine-card">
              <div className="engine-card__header">
                <span className="engine-card__name">{t('settings.qb_grounding_name', undefined, 'Local Vector Hybrid Index')}</span>
                <span className="engine-card__badge engine-card__badge--ok">{t('settings.status_active', undefined, 'Active')}</span>
              </div>
              <p className="engine-card__desc">
                {t('settings.qb_grounding_desc', { count: serverConfig ? String(serverConfig.rag_questions_count) : '50+' }, `${serverConfig ? `${serverConfig.rag_questions_count} curated exemplar questions` : 'Curated question bank'} indexed locally for grounded role depth, realistic question patterns, and diagnostic scoring.`)}
              </p>
            </div>
          </div>

          <div className="settings-actions-row">
            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleVerifyEngines}
              disabled={verifying}
            >
              <RefreshIcon width={16} height={16} />
              {verifying ? t('settings.verifying_btn', undefined, 'Verifying Connections…') : t('settings.verify_btn', undefined, 'Verify Engine Connections')}
            </button>
          </div>

          {verifyResult && (
            <div className="verify-result-box">
              <div className="verify-item">
                <span className="verify-item__name">{verifyResult.evaluator.provider}</span>
                <span
                  className={`verify-item__status ${
                    verifyResult.evaluator.ok ? 'verify-item__status--ok' : 'verify-item__status--err'
                  }`}
                >
                  {verifyResult.evaluator.ok ? (
                    <>
                      <CheckIcon width={14} height={14} /> Connected ({verifyResult.evaluator.latency_ms}ms)
                    </>
                  ) : (
                    verifyResult.evaluator.message
                  )}
                </span>
              </div>
              <div className="verify-item">
                <span className="verify-item__name">{verifyResult.interviewer.provider}</span>
                <span
                  className={`verify-item__status ${
                    verifyResult.interviewer.ok ? 'verify-item__status--ok' : 'verify-item__status--err'
                  }`}
                >
                  {verifyResult.interviewer.ok ? (
                    <>
                      <CheckIcon width={14} height={14} /> Connected ({verifyResult.interviewer.latency_ms}ms)
                    </>
                  ) : (
                    verifyResult.interviewer.message
                  )}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Section 4: Data & Storage */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">{t('settings.storage_section_title', undefined, 'Storage & Data Management')}</h2>
            <span className="settings-tag">{t('settings.storage_tag', undefined, 'Offline SQLite')}</span>
          </div>

          <div className="settings-storage-card">
            <div className="storage-metrics-grid">
              <div>
                <div className="storage-metric__val">
                  {loadingConfig ? '—' : serverConfig?.total_mock_reports ?? 0}
                </div>
                <div className="storage-metric__label">{t('settings.storage_metric_mocks', undefined, 'Mock Interviews')}</div>
              </div>
              <div>
                <div className="storage-metric__val">
                  {loadingConfig ? '—' : serverConfig?.total_single_reports ?? 0}
                </div>
                <div className="storage-metric__label">{t('settings.storage_metric_singles', undefined, 'Single Drills')}</div>
              </div>
              <div>
                <div className="storage-metric__val">
                  {loadingConfig ? '—' : serverConfig?.total_presets ?? 0}
                </div>
                <div className="storage-metric__label">{t('settings.storage_metric_presets', undefined, 'Saved Presets')}</div>
              </div>
            </div>

            <div className="storage-info-row">
              <span className="storage-info-label">{t('settings.db_file_label', undefined, 'Database File:')}</span>
              <span className="storage-info-val">{t('settings.db_file_val', undefined, 'backend/interview_reports.db (100% Offline SQLite)')}</span>
            </div>
            <div className="storage-info-row">
              <span className="storage-info-label">{t('settings.analytics_grounding_label', undefined, 'Analytics Grounding:')}</span>
              <span className="storage-info-val">{t('settings.analytics_grounding_val', undefined, 'Explicitly Saved Single Drills & Mock Sessions')}</span>
            </div>
          </div>

          <div className="settings-actions-row">
            <button
              type="button"
              className="settings-btn settings-btn--primary"
              onClick={handleExportPDF}
              disabled={exportingPDF}
            >
              <DownloadIcon width={16} height={16} />
              {exportingPDF ? 'Preparing PDF…' : t('settings.export_pdf_btn', undefined, 'Export All Reports (PDF)')}
            </button>

            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleExportJSON}
            >
              <DownloadIcon width={16} height={16} />
              {t('settings.export_json_btn', undefined, 'Export Backup (JSON)')}
            </button>

            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleExportCSV}
            >
              <DownloadIcon width={16} height={16} />
              {t('settings.export_csv_btn', undefined, 'Export Reports (CSV)')}
            </button>

            <label className="settings-btn settings-btn--ghost" style={{ cursor: 'pointer' }}>
              <UploadIcon width={16} height={16} />
              {t('settings.import_json_btn', undefined, 'Import Backup (JSON)')}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </label>

            <button
              type="button"
              className="settings-btn settings-btn--danger"
              onClick={() => setShowClearModal(true)}
            >
              <TrashIcon width={16} height={16} />
              {t('settings.clear_data_btn', undefined, 'Clear Data & Cache')}
            </button>
          </div>
        </section>
      </div>

      {/* Clear Data Confirmation Modal */}
      {showClearModal && (
        <div className="settings-modal-backdrop" onClick={() => setShowClearModal(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="settings-modal__title">
              <WarningIcon width={22} height={22} />
              {t('settings.clear_modal_title', undefined, 'Clear Application Data')}
            </h3>
            <p className="settings-modal__desc">
              {t('settings.clear_modal_desc', undefined, 'Select which records to permanently remove from your offline database. This action cannot be undone unless you have a JSON backup.')}
            </p>

            <div className="settings-modal__checkboxes">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={clearOptions.mock}
                  onChange={(e) => setClearOptions((prev) => ({ ...prev, mock: e.target.checked }))}
                />
                {t('settings.storage_metric_mocks', undefined, 'Saved Mock Interviews')} ({serverConfig?.total_mock_reports ?? 0})
              </label>

              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={clearOptions.single}
                  onChange={(e) => setClearOptions((prev) => ({ ...prev, single: e.target.checked }))}
                />
                {t('settings.storage_metric_singles', undefined, 'Saved Single Practice Drills')} ({serverConfig?.total_single_reports ?? 0})
              </label>

              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={clearOptions.presets}
                  onChange={(e) => setClearOptions((prev) => ({ ...prev, presets: e.target.checked }))}
                />
                {t('settings.storage_metric_presets', undefined, 'Target Role & Company Presets')} ({serverConfig?.total_presets ?? 0})
              </label>
            </div>

            <div className="settings-modal__actions">
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
              >
                {t('settings.clear_modal_cancel', undefined, 'Cancel')}
              </button>
              <button
                type="button"
                className="settings-btn settings-btn--danger"
                onClick={handleConfirmClear}
                disabled={clearing || (!clearOptions.mock && !clearOptions.single && !clearOptions.presets)}
              >
                {clearing ? t('settings.clear_modal_clearing', undefined, 'Clearing…') : t('settings.clear_modal_confirm', undefined, 'Confirm & Clear Selected')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
