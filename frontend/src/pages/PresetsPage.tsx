import { useNavigate } from 'react-router-dom'
import { InterviewPresets } from '../components/InterviewPresets'

export function PresetsPage() {
  const navigate = useNavigate()

  return (
    <div className="page-section">
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
      <InterviewPresets />
    </div>
  )
}