import { useNavigate } from 'react-router-dom'
import { PracticeCard } from '../components/PracticeCard'

export function SituationalPracticePage() {
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
      <PracticeCard />
    </div>
  )
}