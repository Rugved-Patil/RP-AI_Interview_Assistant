import { useState } from 'react'
import { PracticeCard } from './components/PracticeCard'
import { SavedReports } from './components/SavedReports'
import './App.css'

function App() {
  // Bumped every time a report is saved. Passed as SavedReports' `key`
  // (not a normal prop) - changing a key tells React "this is a new
  // component instance," so React unmounts the old SavedReports and mounts
  // a fresh one, which naturally starts back at its initial 'loading'
  // state and re-runs its effect. That's why the effect inside
  // SavedReports no longer needs to reset itself to 'loading' manually.
  const [reportsVersion, setReportsVersion] = useState(0)

  return (
    <div className="page">
      <header className="page__header">
        <span className="page__title">RP-AI Interview Assistant</span>
      </header>
      <main className="page__main">
        <PracticeCard onReportSaved={() => setReportsVersion((v) => v + 1)} />
        <SavedReports key={reportsVersion} />
      </main>
    </div>
  )
}

export default App