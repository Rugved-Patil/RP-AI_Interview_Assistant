import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router-dom'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { BehavioralPracticePage } from './pages/BehavioralPracticePage'
import { HomePage } from './pages/HomePage'
import { MockInterviewPage } from './pages/MockInterviewPage'
import { PresetsPage } from './pages/PresetsPage'
import { QuestionBankPage } from './pages/QuestionBankPage'
import { SavedReportsPage } from './pages/SavedReportsPage'
import { SituationalPracticePage } from './pages/SituationalPracticePage'
import { RightNavbar } from './components/RightNavbar'
import './App.css'

/**
 * Persistent shell around every route: header with the app title stays put,
 * RightNavbar handles global navigation on the right side, and `<Outlet />`
 * swaps in whichever page matches the current URL.
 */
function Layout() {
  return (
    <div className="page page--with-sidebar">
      <header className="page__header">
        <Link
          to="/"
          className="page__title"
          onClick={() => {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel()
            }
          }}
        >
          RP-AI Interview Assistant
        </Link>
      </header>
      <main className="page__main">
        <Outlet />
      </main>
      <RightNavbar />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="practice" element={<SituationalPracticePage />} />
          <Route path="practice/behavioral" element={<BehavioralPracticePage />} />
          <Route path="mock-interview" element={<MockInterviewPage />} />
          <Route path="questions" element={<QuestionBankPage />} />
          <Route path="presets" element={<PresetsPage />} />
          <Route path="reports" element={<SavedReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App