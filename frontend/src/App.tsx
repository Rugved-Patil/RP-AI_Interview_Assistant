import { PracticeCard } from './components/PracticeCard'
import './App.css'

function App() {
  return (
    <div className="page">
      <header className="page__header">
        <span className="page__title">RP-AI Interview Assistant</span>
      </header>
      <main className="page__main">
        <PracticeCard />
      </main>
    </div>
  )
}

export default App