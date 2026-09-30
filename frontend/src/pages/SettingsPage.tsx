import { useNavigate } from 'react-router-dom'
import { SettingsIcon } from '../components/Icons'
import './SettingsPage.css'

export function SettingsPage() {
  const navigate = useNavigate()

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
              Manage interview AI parameters, voice &amp; speech synthesis, and local storage.
            </p>
          </div>
        </div>
      </header>

      <div className="settings-grid">
        {/* Section 1: AI Model & Inference */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">AI Model &amp; Inference</h2>
            <span className="settings-tag">Configuration</span>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Active LLM Provider</label>
            <div className="settings-input-mock">
              <span>Google Gemini 2.5 Flash (Primary) / Groq LLaMA (Fallback)</span>
              <span className="settings-status-badge">Active</span>
            </div>
            <p className="settings-hint">Configured via backend environment variables (.env).</p>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">RAG Question Bank Grounding</label>
            <div className="settings-toggle-mock">
              <span className="settings-toggle-label">Ground prompts with curated exemplar questions</span>
              <span className="settings-toggle-switch settings-toggle-switch--on">ON</span>
            </div>
            <p className="settings-hint">
              Uses sublinear TF-IDF + BM25 local vector retrieval for technical depth.
            </p>
          </div>
        </section>

        {/* Section 2: Voice & Audio Settings */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">Speech &amp; Audio Input/Output</h2>
            <span className="settings-tag">Coming Soon</span>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Voice Synthesis Engine</label>
            <div className="settings-input-mock settings-input-mock--disabled">
              <span>Browser SpeechSynthesis API (Default Voice)</span>
            </div>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Speech Recognition (Dictation)</label>
            <div className="settings-input-mock settings-input-mock--disabled">
              <span>Web Speech API (en-US continuous transcription)</span>
            </div>
          </div>
        </section>

        {/* Section 3: Data & Storage */}
        <section className="settings-section">
          <div className="settings-section__header">
            <h2 className="settings-section__title">Storage &amp; Data Management</h2>
            <span className="settings-tag">Local SQLite</span>
          </div>

          <div className="settings-storage-card">
            <div className="storage-info-row">
              <span className="storage-info-label">Persistence Mode:</span>
              <span className="storage-info-val">100% Offline Local SQLite (interview_reports.db)</span>
            </div>
            <div className="storage-info-row">
              <span className="storage-info-label">Analytics Grounding:</span>
              <span className="storage-info-val">Explicitly Saved Single Drills &amp; Full Mocks</span>
            </div>
          </div>

          <div className="settings-actions-row">
            <button type="button" className="settings-btn settings-btn--secondary" disabled>
              Export All Reports (JSON)
            </button>
            <button type="button" className="settings-btn settings-btn--ghost" disabled>
              Clear Cached Sessions
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
