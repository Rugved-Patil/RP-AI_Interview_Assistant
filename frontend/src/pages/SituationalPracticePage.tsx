import { Link } from 'react-router-dom'
import { PracticeCard } from '../components/PracticeCard'

export function SituationalPracticePage() {
  return (
    <div className="page-section">
      <Link to="/" className="page-back">
        ← All practice modes
      </Link>
      <PracticeCard />
    </div>
  )
}