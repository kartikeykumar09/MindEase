import { useEffect, useState } from 'react'
import CheckIn from './components/CheckIn.jsx'
import SafetyCard from './components/SafetyCard.jsx'
import SupportCard from './components/SupportCard.jsx'
import Dashboard from './components/Dashboard.jsx'
import HistoryList from './components/HistoryList.jsx'
import Footer from './components/Footer.jsx'
import { loadEntries, saveEntry, updateEntry } from './lib/storage.js'
import { triage, analyze } from './lib/model.js'

/**
 * Root component and flow state machine.
 *
 * Tabs: check-in / history / patterns. The check-in flow has sub-states:
 *   idle → (busy) → support | safety | error.
 * Safety triage ALWAYS runs before any support generation.
 * @returns {JSX.Element}
 */
export default function App() {
  const [tab, setTab] = useState('checkin')
  const [entries, setEntries] = useState(() => loadEntries())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { kind: 'support'|'safety', analysis? }
  const [error, setError] = useState('')

  // Keep the document title calm and static.
  useEffect(() => {
    document.title = 'MindEase — your private calm space'
  }, [])

  /**
   * Save the entry, run safety triage FIRST, then (only if safe) generate support.
   * @param {number} mood
   * @param {string} text
   */
  async function handleReflect(mood, text) {
    setBusy(true)
    setError('')
    setResult(null)
    const saved = saveEntry({ mood, text })

    try {
      // PASS 1 — safety triage. Always first.
      const { risk, reason } = await triage(text)

      if (risk === 'crisis' || risk === 'elevated') {
        updateEntry(saved.id, { risk, analysis: null })
        setEntries(loadEntries())
        setResult({ kind: 'safety' })
        return
      }

      // PASS 2 — support, only when risk is "none".
      const analysis = await analyze(mood, text)
      updateEntry(saved.id, { risk: 'none', analysis })
      setEntries(loadEntries())
      setResult({ kind: 'support', analysis })
    } catch (err) {
      // Ollama unreachable or errored. The entry is still saved.
      setError(
        "Couldn't reach the local model. Make sure Ollama is running (ollama serve) and try again. Your entry was saved.",
      )
      setEntries(loadEntries())
    } finally {
      setBusy(false)
    }
  }

  /** Return to a fresh check-in. */
  function reset() {
    setResult(null)
    setError('')
  }

  return (
    <div className="app">
      <header className="brand">
        <h1>MindEase</h1>
        <p>A private space to check in with yourself.</p>
      </header>

      <nav className="tabs" aria-label="Sections">
        <button aria-current={tab === 'checkin'} onClick={() => setTab('checkin')}>
          Check in
        </button>
        <button aria-current={tab === 'history'} onClick={() => setTab('history')}>
          History
        </button>
        <button aria-current={tab === 'dashboard'} onClick={() => setTab('dashboard')}>
          Patterns
        </button>
      </nav>

      <main>
        {tab === 'checkin' && (
          <>
            {!result && <CheckIn onReflect={handleReflect} busy={busy} />}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {result?.kind === 'safety' && <SafetyCard onReset={reset} />}
            {result?.kind === 'support' && <SupportCard analysis={result.analysis} onReset={reset} />}
          </>
        )}

        {tab === 'history' && <HistoryList entries={entries} />}
        {tab === 'dashboard' && <Dashboard entries={entries} />}
      </main>

      <Footer />
    </div>
  )
}
