import { Link } from 'react-router-dom'
import { SavedReports } from '../components/SavedReports'

export function SavedReportsPage() {
  return (
    <div className="page-section">
      <Link to="/" className="page-back">
        ← All practice modes
      </Link>
      <SavedReports />
    </div>
  )
}