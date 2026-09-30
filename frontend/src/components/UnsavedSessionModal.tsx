import { WarningIcon } from './Icons'
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
  if (!isOpen) return null

  return (
    <div className="unsaved-modal__backdrop" role="dialog" aria-modal="true">
      <div className="unsaved-modal__dialog">
        <div className="unsaved-modal__header">
          <span className="unsaved-modal__icon" aria-hidden="true">
            <WarningIcon width={22} height={22} />
          </span>
          <h3 className="unsaved-modal__title">Unsaved {sessionTitle}</h3>
        </div>

        <div className="unsaved-modal__body">
          <p className="unsaved-modal__lead">
            You have completed and evaluated this session, but it has not been saved yet.
          </p>
          <div className="unsaved-modal__warning-box">
            <p>
              <strong>Impact on Analytics:</strong> If you exit without saving, this session&apos;s score, feedback, and transcript will be permanently lost and <strong>will not count toward your Progress &amp; Analytics</strong> trajectory or weak-spot discovery.
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
            {isSaving ? 'Saving & Continuing…' : '✓ Save Report & Continue'}
          </button>
          <button
            type="button"
            className="unsaved-modal__btn unsaved-modal__btn--danger"
            onClick={onDiscardAndProceed}
            disabled={isSaving}
          >
            Discard Without Saving
          </button>
          <button
            type="button"
            className="unsaved-modal__btn unsaved-modal__btn--ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel (Stay Here)
          </button>
        </div>
      </div>
    </div>
  )
}
