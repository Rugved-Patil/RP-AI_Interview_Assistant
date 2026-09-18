import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { MockInterviewPage } from './pages/MockInterviewPage'
import { PresetsPage } from './pages/PresetsPage'
import { SavedReportsPage } from './pages/SavedReportsPage'
import { SituationalPracticePage } from './pages/SituationalPracticePage'
import './App.css'

/**
 * Persistent shell around every route: header (with the app title and
 * nav links) stays put, `<Outlet />` swaps in whichever page matches the
 * current URL.
 */
function Layout() {
  return (
    <div className="page">
      <header className="page__header">
        <Link to="/" className="page__title">
          RP-AI Interview Assistant
        </Link>
        <nav className="page__nav">
          <Link to="/presets" className="page__nav-link">
            Interview presets
          </Link>
          <Link to="/reports" className="page__nav-link">
            Saved reports
          </Link>
        </nav>
      </header>
      <main className="page__main">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="practice" element={<SituationalPracticePage />} />
          <Route path="mock-interview" element={<MockInterviewPage />} />
          <Route path="presets" element={<PresetsPage />} />
          <Route path="reports" element={<SavedReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App