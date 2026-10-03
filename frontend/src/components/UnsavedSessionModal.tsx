import { WarningIcon } from './Icons'
import { useTranslation } from '../i18n/LanguageContext'
import './UnsavedSessionModal.css'

interface UnsavedSessionModalProps {
  isOpen: boolean
  isSaving: boolean
  sessionTitle?: string
  onSaveAndProceed: () => Promise<void> | void
  onDiscardAndProceed: () => void
  onCancel: () => void
}

export function UnsavedSessionModal({
  isOpen,
  isSaving,
  sessionTitle = 'Interview / Practice Session',
  onSaveAndProceed,
  onDiscardAndProceed,
  onCancel,
}: UnsavedSessionModalProps) {
  const { t } = useTranslation()
  if (!isOpen) return null

  return (
    <div className="unsaved-modal__backdrop" role="dialog" aria-modal="true">
      <div className="unsaved-modal__dialog">
        <div className="unsaved-modal__header">
          <span className="unsaved-modal__icon" aria-hidden="true">
            <WarningIcon width={22} height={22} />
          </span>
          <h3 className="unsaved-modal__title">
            {t('modal.unsaved_title', { sessionTitle }, `Unsaved ${sessionTitle}`)}
          </h3>
        </div>

        <div className="unsaved-modal__body">
          <p className="unsaved-modal__lead">
            {t('modal.unsaved_lead', undefined, 'You have completed and evaluated this session, but it has not been saved yet.')}
          </p>
          <div className="unsaved-modal__warning-box">
            <p>
              <strong>{t('modal.impact_label', undefined, 'Impact on Analytics:')}</strong>{' '}
              {t(
                'modal.impact_desc',
                undefined,
                "If you exit without saving, this session's score, feedback, and transcript will be permanently lost and will not count toward your Progress & Analytics trajectory or weak-spot discovery.",
              )}
            </p>
          </div>
        </div>

        <div className="unsaved-modal__actions">
          <button
            type="button"
            className="unsaved-modal__btn unsaved-modal__btn--primary"
            onClick={onSaveAndProceed}
            disabled={isSaving}
          >
            {isSaving ? t('modal.saving_continue', undefined, 'Saving & Continuing…') : t('modal.save_continue', undefined, '✓ Save Report & Continue')}
          </button>
          <button
            type="button"
            className="unsaved-modal__btn unsaved-modal__btn--danger"
            onClick={onDiscardAndProceed}
            disabled={isSaving}
          >
            {t('modal.discard', undefined, 'Discard Without Saving')}
          </button>
          <button
            type="button"
            className="unsaved-modal__btn unsaved-modal__btn--ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            {t('modal.cancel_stay', undefined, 'Cancel (Stay Here)')}
          </button>
        </div>
      </div>
    </div>
  )
}
