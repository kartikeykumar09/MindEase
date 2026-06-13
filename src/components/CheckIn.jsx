import { useState } from 'react'

const MOODS = [
  { value: 1, emoji: '😣', label: 'Awful' },
  { value: 2, emoji: '😔', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

/** Soft cap on journal length — keeps small local models fast and bounds cloud cost. */
const MAX_JOURNAL = 2000

/**
 * The check-in screen: a 1-5 mood selector, a free-text journal box, an optional exam-context
 * field (so support can be grounded in which exam and how soon), and a Reflect button.
 * @param {{
 *   onReflect: (mood: number, text: string) => void,
 *   busy: boolean,
 *   exam?: { name?: string, date?: string }|null,
 *   onExamChange?: (exam: { name: string, date: string }) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function CheckIn({ onReflect, busy, exam = null, onExamChange }) {
  const [mood, setMood] = useState(0)
  const [text, setText] = useState('')

  const canSubmit = mood > 0 && text.trim().length > 0 && !busy

  /** @param {React.FormEvent} e */
  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    onReflect(mood, text.trim())
  }

  /** @param {{name?: string, date?: string}} patch */
  function updateExam(patch) {
    if (onExamChange) onExamChange({ name: exam?.name || '', date: exam?.date || '', ...patch })
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-labelledby="checkin-title">
      <h2 id="checkin-title">How are you feeling right now?</h2>

      <fieldset className="mood-fieldset">
        <legend className="sr-only">Select your mood from 1 (awful) to 5 (great)</legend>
        <div className="mood-row" role="group" aria-label="Mood rating">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m.value}
              aria-pressed={mood === m.value}
              aria-label={`${m.label} (${m.value} of 5)`}
              onClick={() => setMood(m.value)}
            >
              <span aria-hidden="true">{m.emoji}</span>
              <span className="mood-label">{m.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label htmlFor="journal">What&apos;s on your mind?</label>
      <p className="muted" id="journal-hint">
        Write freely — this stays only in your browser.
      </p>
      <textarea
        id="journal"
        aria-describedby="journal-hint"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_JOURNAL))}
        placeholder="Today I felt…"
        maxLength={MAX_JOURNAL}
      />

      {onExamChange && (
        <details className="exam-context">
          <summary>Exam context (optional)</summary>
          <p className="muted">
            Tell MindEase which exam you&apos;re preparing for, so reflections can speak to your
            situation. Stored only on this device.
          </p>
          <div className="exam-fields">
            <span className="field">
              <label htmlFor="exam-name">Exam</label>
              <input
                id="exam-name"
                type="text"
                value={exam?.name || ''}
                onChange={(e) => updateExam({ name: e.target.value })}
                placeholder="e.g. NEET, JEE, CAT"
              />
            </span>
            <span className="field">
              <label htmlFor="exam-date">Date</label>
              <input
                id="exam-date"
                type="date"
                value={exam?.date || ''}
                onChange={(e) => updateExam({ date: e.target.value })}
              />
            </span>
          </div>
        </details>
      )}

      <div className="checkin-actions">
        <button
          className="btn-primary"
          type="submit"
          disabled={!canSubmit}
          aria-describedby={canSubmit ? undefined : 'reflect-hint'}
        >
          {busy ? 'Reflecting…' : 'Reflect'}
        </button>
        {!canSubmit && !busy && (
          <p className="muted" id="reflect-hint">
            Pick a mood and write a few words to enable Reflect.
          </p>
        )}
      </div>
    </form>
  )
}
