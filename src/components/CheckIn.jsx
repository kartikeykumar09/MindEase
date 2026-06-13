import { useState } from 'react'

const MOODS = [
  { value: 1, emoji: '😣', label: 'Awful' },
  { value: 2, emoji: '😔', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

/**
 * The check-in screen: a 1-5 mood selector, a free-text journal box, and a Reflect button.
 * @param {{ onReflect: (mood: number, text: string) => void, busy: boolean }} props
 * @returns {JSX.Element}
 */
export default function CheckIn({ onReflect, busy }) {
  const [mood, setMood] = useState(0)
  const [text, setText] = useState('')

  const canSubmit = mood > 0 && text.trim().length > 0 && !busy

  /** @param {React.FormEvent} e */
  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    onReflect(mood, text.trim())
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-labelledby="checkin-title">
      <h2 id="checkin-title">How are you feeling right now?</h2>

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
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
        onChange={(e) => setText(e.target.value)}
        placeholder="Today I felt…"
      />

      <div style={{ marginTop: '1rem' }}>
        <button className="btn-primary" type="submit" disabled={!canSubmit}>
          {busy ? 'Reflecting…' : 'Reflect'}
        </button>
      </div>
    </form>
  )
}
