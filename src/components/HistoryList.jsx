import ReadAloud from './ReadAloud.jsx'

const MOOD_EMOJI = { 1: '😣', 2: '😔', 3: '😐', 4: '🙂', 5: '😄' }

/**
 * A reverse-chronological list of past check-ins, with read-aloud per entry.
 * @param {{ entries: import('../lib/storage.js').Entry[] }} props
 * @returns {JSX.Element}
 */
export default function HistoryList({ entries }) {
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
      <h2 id="hist-title">Your history</h2>
      <div className="card">
        {entries.map((e) => (
          <article className="entry" key={e.id}>
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span>
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                  {MOOD_EMOJI[e.mood] || ''}
                </span>{' '}
                <time dateTime={new Date(e.ts).toISOString()}>
                  {new Date(e.ts).toLocaleString()}
                </time>
              </span>
              <ReadAloud text={e.text} />
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
