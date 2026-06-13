import { useState } from 'react'
import ReadAloud from './ReadAloud.jsx'

const MOOD_EMOJI = { 1: '😣', 2: '😔', 3: '😐', 4: '🙂', 5: '😄' }

/**
 * A reverse-chronological list of past check-ins, with read-aloud per entry and privacy controls:
 * delete a single entry, or clear everything (with an inline confirm step).
 * Presentational — storage side effects live in App via the onDelete / onClearAll callbacks.
 * @param {{
 *   entries: import('../lib/storage.js').Entry[],
 *   onDelete: (id: string) => void,
 *   onClearAll: () => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function HistoryList({ entries, onDelete, onClearAll }) {
  const [confirmingClear, setConfirmingClear] = useState(false)

  if (!entries.length) {
    return (
      <section aria-labelledby="hist-title">
        <h2 id="hist-title">Your history</h2>
        <p className="muted">No entries yet. Your past check-ins will show up here.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="hist-title">
      <div className="card-head">
        <h2 id="hist-title">Your history</h2>
        {confirmingClear ? (
          <span className="confirm-clear" role="group" aria-label="Confirm clearing all entries">
            <span className="muted">Delete everything?</span>
            <button
              className="btn-danger"
              onClick={() => {
                onClearAll()
                setConfirmingClear(false)
              }}
            >
              Yes, clear all
            </button>
            <button className="btn-secondary" onClick={() => setConfirmingClear(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button className="btn-secondary" onClick={() => setConfirmingClear(true)}>
            Clear all
          </button>
        )}
      </div>

      <div className="card">
        {entries.map((e) => (
          <article className="entry" key={e.id}>
            <header className="card-head">
              <span>
                <span className="mood-emoji" aria-hidden="true">
                  {MOOD_EMOJI[e.mood] || ''}
                </span>{' '}
                <time dateTime={new Date(e.ts).toISOString()}>
                  {new Date(e.ts).toLocaleString()}
                </time>
              </span>
              <span className="entry-actions">
                <ReadAloud text={e.text} />
                <button
                  className="btn-secondary"
                  onClick={() => onDelete(e.id)}
                  aria-label={`Delete check-in from ${new Date(e.ts).toLocaleString()}`}
                >
                  🗑 Delete
                </button>
              </span>
            </header>
            <p>{e.text}</p>
            {e.analysis?.triggers?.length > 0 && (
              <ul className="tags" aria-label="Triggers for this entry">
                {e.analysis.triggers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
