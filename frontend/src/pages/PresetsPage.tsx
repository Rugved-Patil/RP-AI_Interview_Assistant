import { Link } from 'react-router-dom'
import { InterviewPresets } from '../components/InterviewPresets'

export function PresetsPage() {
  return (
    <div className="page-section">
      <Link to="/" className="page-back">
        ← All practice modes
      </Link>
      <InterviewPresets />
    </div>
  )
}