import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearDataStore,
  downloadDataCSV,
  exportDataJSON,
  getSettingsConfig,
  importDataBackup,
  type ImportDataRequest,
  type SettingsConfigResponse,
  type VerifyConnectionsResponse,
  verifyEngineConnections,
} from '../api/practiceApi'
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
import './SettingsPage.css'

export function SettingsPage() {
  const navigate = useNavigate()

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
    setFormSpeech(DEFAULT_SPEECH_SETTINGS)
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
        const text = "Welcome to your AI interview assistant. Let's practice and elevate your skills."
        const utterance = new SpeechSynthesisUtterance(text)

        if (savedSpeech.voiceURI) {
          const matched = availableVoices.find(
            (v) =>
              v.voiceURI === savedSpeech.voiceURI ||
              v.name === savedSpeech.voiceURI ||
              `${v.name} (${v.lang})` === savedSpeech.voiceURI,
          )
          if (matched) utterance.voice = matched
        }
        utterance.rate = savedSpeech.rate
        utterance.pitch = savedSpeech.pitch
        utterance.lang = savedSpeech.dictationLang || 'en-US'

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

  const handleVerifyEngines = async () => {
    try {
      setVerifying(true)
      setVerifyResult(null)
      const res = await verifyEngineConnections()
      setVerifyResult(res)
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

  // Filter ONLY natural & enhanced voices (commenting out standard voices code for now per user request)
  const naturalVoices = availableVoices.filter((v) => isNaturalVoice(v))
  const displayVoices =
    naturalVoices.length > 0
      ? naturalVoices
      : availableVoices.filter((v) => v.lang.startsWith('en')).slice(0, 5)

  /* Standard browser voices commented out for now per request:
  const standardVoices = availableVoices.filter((v) => !isNaturalVoice(v))
  */

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
        ← Back
      </button>

      <header className="settings-header">
        <div className="settings-title-row">
          <span className="settings-title-icon" aria-hidden="true">
            <SettingsIcon width={28} height={28} />
          </span>
          <div>
            <h1 className="settings-title">Application Settings</h1>
            <p className="settings-subtitle">
              Personalize theme palettes, speech synthesis &amp; dictation, engine connectivity, and local data persistence.
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
        {/* Section 1: Theme & Visual Style (8 Themes: 4 on line 1, 4 on line 2) */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">
              <PaletteIcon width={18} height={18} />
              Theme &amp; Visual Style
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

        {/* Section 2: Speech & Voice Settings */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">
              <SpeakerIcon width={18} height={18} />
              Speech &amp; Audio Input/Output
            </h2>
            <span className="settings-tag">
              {hasUnsavedSpeech ? 'Unsaved Changes' : 'Saved'}
            </span>
          </div>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label htmlFor="voice-select" className="settings-label">
                Natural Voice Synthesis
              </label>
              <select
                id="voice-select"
                className="settings-select"
                value={formSpeech.voiceURI}
                onChange={(e) => setFormSpeech((prev) => ({ ...prev, voiceURI: e.target.value }))}
              >
                <option value="">Default Recommended Natural Voice</option>
                {displayVoices.map((voice) => (
                  <option key={voice.voiceURI || voice.name} value={voice.voiceURI || voice.name}>
                    ✨ {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <p className="settings-hint">Filtered strictly to high-fidelity natural &amp; neural voices for realistic interview simulation.</p>
            </div>

            <div className="settings-form-group">
              <label htmlFor="dictation-select" className="settings-label">
                <span>
                  <MicIcon width={14} height={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Dictation Language
                </span>
              </label>
              <select
                id="dictation-select"
                className="settings-select"
                value={formSpeech.dictationLang}
                onChange={(e) => setFormSpeech((prev) => ({ ...prev, dictationLang: e.target.value }))}
              >
                <option value="en-US">English (United States)</option>
                <option value="en-GB">English (United Kingdom)</option>
                <option value="en-IN">English (India)</option>
                <option value="en-AU">English (Australia)</option>
                <option value="en-CA">English (Canada)</option>
              </select>
              <p className="settings-hint">Microphone speech recognition language model.</p>
            </div>
          </div>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label htmlFor="speed-range" className="settings-label">
                Speaking Rate
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
                <span>0.5x Slow</span>
                <span>1.0x Normal</span>
                <span>1.75x Fast</span>
              </div>
            </div>

            <div className="settings-form-group">
              <label htmlFor="pitch-range" className="settings-label">
                Voice Pitch
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
                <span>Deeper</span>
                <span>Standard</span>
                <span>Higher</span>
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
              Save Audio Settings
            </button>

            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleTestVoice}
            >
              <SpeakerIcon width={16} height={16} />
              {isTestingVoice ? 'Stop Speaking' : 'Test Active Voice'}
            </button>

            <button
              type="button"
              className="settings-btn settings-btn--ghost"
              onClick={handleResetSpeech}
            >
              <RefreshIcon width={16} height={16} />
              Reset Audio Form
            </button>
          </div>
          {hasUnsavedSpeech && (
            <p className="settings-hint" style={{ marginTop: '0.75rem', fontStyle: 'italic' }}>
              * You have unsaved voice modifications. Click &quot;Save Audio Settings&quot; to apply them across your mock interviews and audio tests.
            </p>
          )}
        </section>

        {/* Section 3: AI Assessment & Interview Engine */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">
              AI Assessment &amp; Interview Engine
            </h2>
            <span className="settings-tag settings-tag--active">Operational</span>
          </div>

          <div className="engine-status-grid">
            <div className="engine-card">
              <div className="engine-card__header">
                <span className="engine-card__name">Diagnostic Evaluator Engine</span>
                <span
                  className={`engine-card__badge ${
                    serverConfig?.evaluator_configured
                      ? 'engine-card__badge--ok'
                      : 'engine-card__badge--missing'
                  }`}
                >
                  {serverConfig?.evaluator_configured ? 'Configured' : 'Missing Key'}
                </span>
              </div>
              <div className="engine-card__key">
                API Key: {serverConfig?.evaluator_key_preview || 'Not Configured'}
              </div>
              <p className="engine-card__desc">
                Powers evidence-based scoring across 5 diagnostic dimensions with strict candidate level calibration.
              </p>
            </div>

            <div className="engine-card">
              <div className="engine-card__header">
                <span className="engine-card__name">Interviewer Dialogue Engine</span>
                <span
                  className={`engine-card__badge ${
                    serverConfig?.interviewer_configured
                      ? 'engine-card__badge--ok'
                      : 'engine-card__badge--missing'
                  }`}
                >
                  {serverConfig?.interviewer_configured ? 'Configured' : 'Missing Key'}
                </span>
              </div>
              <div className="engine-card__key">
                API Key: {serverConfig?.interviewer_key_preview || 'Not Configured'}
              </div>
              <p className="engine-card__desc">
                Powers realistic multi-turn conversational follow-ups and adaptive interviewer questions.
              </p>
            </div>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Question Bank &amp; Local RAG Grounding</label>
            <div className="engine-card">
              <div className="engine-card__header">
                <span className="engine-card__name">Local Vector Hybrid Index</span>
                <span className="engine-card__badge engine-card__badge--ok">Active</span>
              </div>
              <p className="engine-card__desc">
                {serverConfig ? `${serverConfig.rag_questions_count} curated exemplar questions` : 'Curated question bank'}{' '}
                indexed locally via TF-IDF + BM25 cosine retrieval for grounded technical depth.
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
              {verifying ? 'Verifying Connections…' : 'Verify Engine Connections'}
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
            <h2 className="settings-section__title">Storage &amp; Data Management</h2>
            <span className="settings-tag">Offline SQLite</span>
          </div>

          <div className="settings-storage-card">
            <div className="storage-metrics-grid">
              <div>
                <div className="storage-metric__val">
                  {loadingConfig ? '—' : serverConfig?.total_mock_reports ?? 0}
                </div>
                <div className="storage-metric__label">Mock Interviews</div>
              </div>
              <div>
                <div className="storage-metric__val">
                  {loadingConfig ? '—' : serverConfig?.total_single_reports ?? 0}
                </div>
                <div className="storage-metric__label">Single Drills</div>
              </div>
              <div>
                <div className="storage-metric__val">
                  {loadingConfig ? '—' : serverConfig?.total_presets ?? 0}
                </div>
                <div className="storage-metric__label">Saved Presets</div>
              </div>
            </div>

            <div className="storage-info-row">
              <span className="storage-info-label">Database File:</span>
              <span className="storage-info-val">backend/interview_reports.db (100% Offline SQLite)</span>
            </div>
            <div className="storage-info-row">
              <span className="storage-info-label">Analytics Grounding:</span>
              <span className="storage-info-val">Explicitly Saved Single Drills &amp; Mock Sessions</span>
            </div>
          </div>

          <div className="settings-actions-row">
            <button
              type="button"
              className="settings-btn settings-btn--primary"
              onClick={handleExportJSON}
            >
              <DownloadIcon width={16} height={16} />
              Export Full Backup (JSON)
            </button>

            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleExportCSV}
            >
              <DownloadIcon width={16} height={16} />
              Export Reports (CSV)
            </button>

            <label className="settings-btn settings-btn--ghost" style={{ cursor: 'pointer' }}>
              <UploadIcon width={16} height={16} />
              Import Backup (JSON)
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
              Clear Data &amp; Cache
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
              Clear Application Data
            </h3>
            <p className="settings-modal__desc">
              Select which records to permanently remove from your offline database. This action cannot be undone unless you have a JSON backup.
            </p>

            <div className="settings-modal__checkboxes">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={clearOptions.mock}
                  onChange={(e) => setClearOptions((prev) => ({ ...prev, mock: e.target.checked }))}
                />
                Saved Mock Interviews ({serverConfig?.total_mock_reports ?? 0})
              </label>

              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={clearOptions.single}
                  onChange={(e) => setClearOptions((prev) => ({ ...prev, single: e.target.checked }))}
                />
                Saved Single Practice Drills ({serverConfig?.total_single_reports ?? 0})
              </label>

              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={clearOptions.presets}
                  onChange={(e) => setClearOptions((prev) => ({ ...prev, presets: e.target.checked }))}
                />
                Target Role &amp; Company Presets ({serverConfig?.total_presets ?? 0})
              </label>
            </div>

            <div className="settings-modal__actions">
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn settings-btn--danger"
                onClick={handleConfirmClear}
                disabled={clearing || (!clearOptions.mock && !clearOptions.single && !clearOptions.presets)}
              >
                {clearing ? 'Clearing…' : 'Confirm & Clear Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
