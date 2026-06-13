import { useEffect, useRef, useState } from 'react'
import CheckIn from './components/CheckIn.jsx'
import SafetyCard from './components/SafetyCard.jsx'
import SupportCard from './components/SupportCard.jsx'
import Dashboard from './components/Dashboard.jsx'
import HistoryList from './components/HistoryList.jsx'
import Footer from './components/Footer.jsx'
import ProviderToggle from './components/ProviderToggle.jsx'
import {
  loadEntries,
  saveEntry,
  updateEntry,
  deleteEntry,
  clearEntries,
  loadExam,
  saveExam,
} from './lib/storage.js'
import { triage, analyze, PROVIDERS } from './lib/model.js'
import { aggregateTriggers, moodSeries, describeMoodTrend } from './lib/triggers.js'
import { geminiConfigured } from './lib/providers/gemini.js'

const PROVIDER_KEY = 'mindease.provider'

/**
 * Turn a stored exam profile into the compact shape the support prompt wants, computing days-until
 * from today. Returns null when no exam name is set.
 * @param {{name?: string, date?: string}|null} exam
 * @returns {{name: string, daysUntil: number|null}|null}
 */
function examForPrompt(exam) {
  if (!exam?.name) return null
  let daysUntil = null
  if (exam.date) {
    const ms = new Date(exam.date).getTime() - Date.now()
    if (!Number.isNaN(ms)) daysUntil = Math.max(0, Math.ceil(ms / 86_400_000))
  }
  return { name: exam.name, daysUntil }
}

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
  const [exam, setExam] = useState(() => loadExam())
  const [lastMood, setLastMood] = useState(0)
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
   * Build the personalisation context for the support prompt from the student's history: their
   * most-frequent past triggers, recent mood trend, the exam they're preparing for, and — on a
   * follow-up turn — the previous reflection. Computed from already-stored data (no extra AI call).
   * @param {string} [priorReflection]
   * @returns {import('./lib/model.js').SupportContext}
   */
  function buildContext(priorReflection) {
    const ctx = {
      recurringTriggers: aggregateTriggers(entries)
        .slice(0, 3)
        .map((t) => t.tag),
      moodTrend: describeMoodTrend(moodSeries(entries)),
      exam: examForPrompt(exam),
    }
    if (priorReflection) ctx.priorReflection = priorReflection
    return ctx
  }

  /** Friendly, recoverable message when the model can't be reached. The entry is still saved. */
  function modelUnreachableMessage() {
    return provider === PROVIDERS.GEMINI
      ? "Couldn't reach Gemini just now. Check your connection and try again — your entry was saved."
      : "Couldn't reach the local model. Make sure Ollama is running (ollama serve) and try again. Your entry was saved."
  }

  /**
   * Save the entry, run safety triage FIRST, then (only if safe) generate personalised support.
   * @param {number} mood
   * @param {string} text
   */
  async function handleReflect(mood, text) {
    setBusy(true)
    setError('')
    setResult(null)
    const context = buildContext() // from history BEFORE this entry is added
    const saved = saveEntry({ mood, text })
    setLastMood(mood)

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
      const analysis = await analyze(mood, text, provider, context)
      updateEntry(saved.id, { risk: 'none', analysis })
      setEntries(loadEntries())
      if (!analysis) {
        // The model returned something we couldn't parse into support. Don't show a blank
        // card — surface a gentle, recoverable message instead.
        setError("Couldn't read the response just now. Please tap Reflect to try again.")
        return
      }
      setResult({ kind: 'support', thread: [analysis] })
    } catch {
      // Model unreachable or errored. The entry is still saved.
      setError(modelUnreachableMessage())
      setEntries(loadEntries())
    } finally {
      setBusy(false)
    }
  }

  /**
   * Companion follow-up turn. Runs safety triage FIRST (same gate as a check-in), then continues
   * the conversation with the prior reflection as context. Follow-ups are ephemeral — they refine
   * the same check-in rather than creating new mood entries.
   * @param {string} text
   */
  async function handleFollowUp(text) {
    setBusy(true)
    setError('')
    try {
      // Safety still comes first, even mid-conversation.
      const { risk } = await triage(text, provider)
      if (risk === 'crisis' || risk === 'elevated') {
        setResult({ kind: 'safety' })
        return
      }
      const prior = result?.thread?.[result.thread.length - 1]?.reflection
      const analysis = await analyze(lastMood || 3, text, provider, buildContext(prior))
      if (!analysis) {
        setError("Couldn't read the response just now. Please try again.")
        return
      }
      setResult((r) => ({ kind: 'support', thread: [...(r?.thread || []), analysis] }))
    } catch {
      setError(modelUnreachableMessage())
    } finally {
      setBusy(false)
    }
  }

  /** Return to a fresh check-in. */
  function reset() {
    setResult(null)
    setError('')
  }

  /** Persist the optional exam profile (used to ground support in the student's exam + timeline). */
  function handleExamChange(next) {
    setExam(next)
    saveExam(next)
  }

  /**
   * Privacy control — permanently remove a single stored entry.
   * @param {string} id
   */
  function handleDelete(id) {
    deleteEntry(id)
    setEntries(loadEntries())
  }

  /** Privacy control — wipe every stored entry from this browser. */
  function handleClearAll() {
    clearEntries()
    setEntries(loadEntries())
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
            {!result && (
              <CheckIn
                onReflect={handleReflect}
                busy={busy}
                exam={exam}
                onExamChange={handleExamChange}
              />
            )}

            {/* The async outcome lands here; aria-live announces it and we focus it on appear. */}
            <div ref={resultRef} tabIndex={-1} aria-live="polite" className="result-region">
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {result?.kind === 'safety' && <SafetyCard onReset={reset} />}
              {result?.kind === 'support' &&
                result.thread.map((analysis, i) => {
                  const isLast = i === result.thread.length - 1
                  return (
                    <SupportCard
                      key={i}
                      analysis={analysis}
                      titleId={`support-title-${i}`}
                      heading={i === 0 ? 'A moment of reflection' : 'A follow-up thought'}
                      onFollowUp={isLast ? handleFollowUp : undefined}
                      onReset={isLast ? reset : undefined}
                      busy={busy}
                    />
                  )
                })}
            </div>
          </>
        )}

        {tab === 'history' && (
          <HistoryList entries={entries} onDelete={handleDelete} onClearAll={handleClearAll} />
        )}
        {tab === 'dashboard' && <Dashboard entries={entries} />}
      </main>

      <Footer />
    </div>
  )
}
