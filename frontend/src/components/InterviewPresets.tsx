import { useEffect, useState } from 'react'
import {
  createPreset,
  deletePreset,
  listPresets,
  updatePreset,
} from '../api/practiceApi'
import type { PresetIn, PresetSummary } from '../api/practiceApi'
import { getActivePresetId, setActivePresetId } from '../activePreset'
import { PresetsIcon } from './Icons'
import { useTranslation } from '../i18n/LanguageContext'
import './InterviewPresets.css'

type PresetsState =
  | { name: 'loading' }
  | { name: 'loaded'; presets: PresetSummary[] }
  | { name: 'error'; message: string }

export function InterviewPresets() {
  const { t } = useTranslation()
  const [state, setState] = useState<PresetsState>({ name: 'loading' })
  // Mirrors localStorage in component state so selecting a preset re-renders
  // immediately - activePreset.ts itself has no way to notify React of a
  // change, it's a plain storage read/write.
  const [activeId, setActiveId] = useState<number | null>(() => getActivePresetId())

  useEffect(() => {
    let cancelled = false
    listPresets()
      .then((presets) => {
        if (!cancelled) setState({ name: 'loaded', presets })
      })
      .catch((err) => {
        if (!cancelled) setState({ name: 'error', message: toMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleCreated(preset: PresetSummary) {
    setState((prev) => (prev.name === 'loaded' ? { name: 'loaded', presets: [preset, ...prev.presets] } : prev))
  }

  function handleUpdated(preset: PresetSummary) {
    setState((prev) =>
      prev.name === 'loaded'
        ? { name: 'loaded', presets: prev.presets.map((p) => (p.id === preset.id ? preset : p)) }
        : prev,
    )
  }

  function handleDeleted(id: number) {
    setState((prev) =>
      prev.name === 'loaded' ? { name: 'loaded', presets: prev.presets.filter((p) => p.id !== id) } : prev,
    )
    // Deleting the active preset clears the pointer too - otherwise the
    // practice page would keep pointing at an id that no longer resolves
    // to anything.
    if (activeId === id) {
      setActivePresetId(null)
      setActiveId(null)
    }
  }

  function handleSelect(id: number) {
    setActivePresetId(id)
    setActiveId(id)
  }

  return (
    <section className="interview-presets">
      <header className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--rule)', paddingBottom: '1rem' }}>
        <div className="page-title-row">
          <div className="page-title-icon page-title-icon--presets">
            <PresetsIcon width={24} height={24} />
          </div>
          <div>
            <h1 className="page-title">{t('preset.eyebrow', undefined, 'Interview Presets')}</h1>
            <p className="page-subtitle">
              {t(
                'preset.presets_lede',
                undefined,
                "Save the role, company, and location you're practicing for. Whichever preset is marked Active is used to build your practice questions, until you change it here.",
              )}
            </p>
          </div>
        </div>
      </header>

      <NewPresetForm onCreated={handleCreated} />

      {state.name === 'loading' && <p className="interview-presets__meta">{t('preset.loading', undefined, 'Loading…')}</p>}
      {state.name === 'error' && <p className="interview-presets__meta">{state.message}</p>}
      {state.name === 'loaded' && state.presets.length === 0 && (
        <p className="interview-presets__meta">{t('preset.no_presets_saved', undefined, 'No presets saved yet — add one above.')}</p>
      )}

      {state.name === 'loaded' && state.presets.length > 0 && (
        <ul className="interview-presets__list">
          {state.presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              isActive={preset.id === activeId}
              onSelect={handleSelect}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function NewPresetForm({ onCreated }: { onCreated: (preset: PresetSummary) => void }) {
  const { t } = useTranslation()
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = role.trim().length > 0 && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const body: PresetIn = {
        role: role.trim(),
        company: company.trim() || undefined,
        location: location.trim() || undefined,
      }
      const preset = await createPreset(body)
      onCreated(preset)
      setRole('')
      setCompany('')
      setLocation('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this preset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="preset-form">
      <p className="preset-form__label">{t('preset.new_preset', undefined, 'New preset')}</p>
      <div className="preset-form__fields">
        <input
          className="preset-form__input"
          type="text"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder={t('preset.role_label', undefined, 'Role')}
        />
        <input
          className="preset-form__input"
          type="text"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder={`${t('preset.company_label', undefined, 'Company')} ${t('preset.optional', undefined, '(optional)')}`}
        />
        <input
          className="preset-form__input"
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder={`${t('preset.location_label', undefined, 'Location')} ${t('preset.optional', undefined, '(optional)')}`}
        />
      </div>
      <button className="preset-form__button" onClick={handleSubmit} disabled={!canSubmit}>
        {submitting ? t('preset.saving', undefined, 'Saving…') : t('preset.save_preset', undefined, 'Save preset')}
      </button>
      {error && <p className="preset-row__error">{error}</p>}
    </div>
  )
}

function PresetRow({
  preset,
  isActive,
  onSelect,
  onUpdated,
  onDeleted,
}: {
  preset: PresetSummary
  isActive: boolean
  onSelect: (id: number) => void
  onUpdated: (preset: PresetSummary) => void
  onDeleted: (id: number) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(preset.role)
  const [company, setCompany] = useState(preset.company ?? '')
  const [location, setLocation] = useState(preset.location ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const canSave = role.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setRowError(null)
    try {
      const updated = await updatePreset(preset.id, {
        role: role.trim(),
        company: company.trim() || undefined,
        location: location.trim() || undefined,
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setRole(preset.role)
    setCompany(preset.company ?? '')
    setLocation(preset.location ?? '')
    setRowError(null)
    setEditing(false)
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      await deletePreset(preset.id)
      onDeleted(preset.id)
      // On success this row unmounts (parent drops it from state), so
      // there's nothing left here to reset.
    } catch (err) {
      setIsDeleting(false)
      setConfirmingDelete(false)
      setRowError(err instanceof Error ? err.message : 'Could not delete this preset.')
    }
  }

  if (editing) {
    return (
      <li className="preset-row preset-row--editing">
        <div className="preset-form__fields">
          <input
            className="preset-form__input"
            type="text"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder={t('preset.role_label', undefined, 'Role')}
          />
          <input
            className="preset-form__input"
            type="text"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder={`${t('preset.company_label', undefined, 'Company')} ${t('preset.optional', undefined, '(optional)')}`}
          />
          <input
            className="preset-form__input"
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={`${t('preset.location_label', undefined, 'Location')} ${t('preset.optional', undefined, '(optional)')}`}
          />
        </div>
        <div className="preset-row__actions">
          <button className="preset-row__save" onClick={handleSave} disabled={!canSave}>
            {saving ? t('preset.saving', undefined, 'Saving…') : t('preset.save_changes', undefined, 'Save changes')}
          </button>
          <button className="preset-row__cancel" onClick={handleCancelEdit} disabled={saving}>
            {t('preset.cancel', undefined, 'Cancel')}
          </button>
        </div>
        {rowError && <p className="preset-row__error">{rowError}</p>}
      </li>
    )
  }

  return (
    <li className={isActive ? 'preset-row preset-row--active' : 'preset-row'}>
      <div className="preset-row__summary">
        <div className="preset-row__text">
          <span className="preset-row__role">{preset.role}</span>
          {(preset.company || preset.location) && (
            <span className="preset-row__meta">{[preset.company, preset.location].filter(Boolean).join(' · ')}</span>
          )}
        </div>
        {isActive && <span className="preset-row__badge">{t('preset.active_badge', undefined, 'Active')}</span>}
      </div>

      <div className="preset-row__actions">
        {!isActive && (
          <button className="preset-row__select" onClick={() => onSelect(preset.id)}>
            {t('preset.use_this', undefined, 'Use this')}
          </button>
        )}
        <button className="preset-row__edit" onClick={() => setEditing(true)}>
          {t('preset.edit', undefined, 'Edit')}
        </button>
        {!confirmingDelete ? (
          <button className="preset-row__delete" onClick={() => setConfirmingDelete(true)}>
            {t('preset.delete', undefined, 'Delete')}
          </button>
        ) : (
          <span className="preset-row__confirm-group">
            <button
              className="preset-row__delete preset-row__delete--confirm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t('preset.deleting', undefined, 'Deleting…') : t('preset.confirm_delete', undefined, 'Confirm delete')}
            </button>
            <button className="preset-row__cancel" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
              {t('preset.cancel', undefined, 'Cancel')}
            </button>
          </span>
        )}
      </div>
      {rowError && <p className="preset-row__error">{rowError}</p>}
    </li>
  )
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Could not load saved presets.'
}