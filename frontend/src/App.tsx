import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { MockInterviewPage } from './pages/MockInterviewPage'
import { SavedReportsPage } from './pages/SavedReportsPage'
import { SituationalPracticePage } from './pages/SituationalPracticePage'
import './App.css'

/**
 * Persistent shell around every route: header (with the app title and the
 * saved-reports link) stays put, `<Outlet />` swaps in whichever page
 * matches the current URL.
 */
function Layout() {
  return (
    <div className="page">
      <header className="page__header">
        <Link to="/" className="page__title">
          RP-AI Interview Assistant
        </Link>
        <Link to="/reports" className="page__reports-link">
          Saved reports
        </Link>
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
          <Route path="reports" element={<SavedReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App