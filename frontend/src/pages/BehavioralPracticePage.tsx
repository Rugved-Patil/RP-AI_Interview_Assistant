import { Link } from 'react-router-dom'
import { BehavioralPracticeCard } from '../components/BehavioralPracticeCard'

export function BehavioralPracticePage() {
  return (
    <div className="page-section">
      <Link to="/" className="page-back">
        ← All practice modes
      </Link>
      <BehavioralPracticeCard />
    </div>
  )
}
