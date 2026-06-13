import { useEffect, useRef, useState } from 'react'
import CheckIn from './components/CheckIn.jsx'
import SafetyCard from './components/SafetyCard.jsx'
import SupportCard from './components/SupportCard.jsx'
import Dashboard from './components/Dashboard.jsx'
import HistoryList from './components/HistoryList.jsx'
import Footer from './components/Footer.jsx'
import ProviderToggle from './components/ProviderToggle.jsx'
import { loadEntries, saveEntry, updateEntry } from './lib/storage.js'
import { triage, analyze, PROVIDERS } from './lib/model.js'
import { geminiConfigured } from './lib/providers/gemini.js'

const PROVIDER_KEY = 'mindease.provider'

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
  const [provider, setProvider] = useState(
    () => localStorage.getItem(PROVIDER_KEY) || PROVIDERS.OLLAMA,
  )
  const [geminiAvailable, setGeminiAvailable] = useState(false)
  const resultRef = useRef(null)

  // Keep the document title calm and static.
  useEffect(() => {
    document.title = 'MindEase — your private calm space'
  }, [])

  // Move keyboard/screen-reader focus to the result (or error) when it appears, so the
  // outcome of a check-in is announced and reachable without hunting for it.
  useEffect(() => {
    if ((result || error) && resultRef.current) resultRef.current.focus()
  }, [result, error])

  // Find out whether the optional Gemini provider is configured (key set server-side). If it
  // isn't, fall back to the on-device provider in case Gemini was previously selected.
  useEffect(() => {
    geminiConfigured().then((ok) => {
      setGeminiAvailable(ok)
      if (!ok) setProvider((p) => (p === PROVIDERS.GEMINI ? PROVIDERS.OLLAMA : p))
    })
  }, [])

  /** Persist + apply a provider choice. */
  function changeProvider(p) {
    setProvider(p)
    localStorage.setItem(PROVIDER_KEY, p)
    reset()
  }

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
      const { risk } = await triage(text, provider)

      if (risk === 'crisis' || risk === 'elevated') {
        updateEntry(saved.id, { risk, analysis: null })
        setEntries(loadEntries())
        setResult({ kind: 'safety' })
        return
      }

      // PASS 2 — support, only when risk is "none".
      const analysis = await analyze(mood, text, provider)
      updateEntry(saved.id, { risk: 'none', analysis })
      setEntries(loadEntries())
      if (!analysis) {
        // The model returned something we couldn't parse into support. Don't show a blank
        // card — surface a gentle, recoverable message instead.
        setError("Couldn't read the response just now. Please tap Reflect to try again.")
        return
      }
      setResult({ kind: 'support', analysis })
    } catch (err) {
      // Model unreachable or errored. The entry is still saved.
      setError(
        provider === PROVIDERS.GEMINI
          ? `Couldn't reach Gemini. Check your GEMINI_API_KEY and network. Your entry was saved. (${err?.message || 'error'})`
          : "Couldn't reach the local model. Make sure Ollama is running (ollama serve) and try again. Your entry was saved.",
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
      <a className="skip-link" href="#main">
        Skip to content
      </a>

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

      <ProviderToggle
        provider={provider}
        onChange={changeProvider}
        geminiAvailable={geminiAvailable}
      />

      {provider === PROVIDERS.OLLAMA ? (
        <p className="privacy-note on-device" role="note">
          <span aria-hidden="true">🔒 </span>Private &amp; on-device — your entries never leave this
          browser.
        </p>
      ) : (
        <p className="privacy-note cloud" role="note">
          <span aria-hidden="true">☁️ </span>Using Google Gemini (cloud): the text you write is sent
          to Google for this check-in. Switch back to <strong>Local · private</strong> to stay fully
          on-device.
        </p>
      )}

      <main id="main" tabIndex={-1}>
        {tab === 'checkin' && (
          <>
            {!result && <CheckIn onReflect={handleReflect} busy={busy} />}

            {/* The async outcome lands here; aria-live announces it and we focus it on appear. */}
            <div ref={resultRef} tabIndex={-1} aria-live="polite" className="result-region">
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {result?.kind === 'safety' && <SafetyCard onReset={reset} />}
              {result?.kind === 'support' && (
                <SupportCard analysis={result.analysis} onReset={reset} />
              )}
            </div>
          </>
        )}

        {tab === 'history' && <HistoryList entries={entries} />}
        {tab === 'dashboard' && <Dashboard entries={entries} />}
      </main>

      <Footer />
    </div>
  )
}
