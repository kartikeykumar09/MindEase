import ReadAloud from './ReadAloud.jsx'

/**
 * @typedef {import('../lib/storage.js').Analysis} Analysis
 */

/**
 * Shown when triage risk is "none". Displays the empathetic reflection, detected trigger tags,
 * 1-2 coping techniques, and one encouragement line.
 * @param {{ analysis: Analysis|null, onReset: () => void }} props
 * @returns {JSX.Element|null}
 */
export default function SupportCard({ analysis, onReset }) {
  if (!analysis) return null
  const { reflection, triggers, coping, encouragement } = analysis

  const spoken = [
    reflection,
    triggers.length ? `Possible triggers: ${triggers.join(', ')}.` : '',
    ...coping.map((c) => `${c.title}: ${c.how}`),
    encouragement,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="card" aria-labelledby="support-title">
      <div className="card-head">
        <h2 id="support-title">A moment of reflection</h2>
        <ReadAloud text={spoken} />
      </div>

      {reflection && <p>{reflection}</p>}

      {triggers.length > 0 && (
        <>
          <h3>What might be weighing on you</h3>
          <ul className="tags" aria-label="Detected stress triggers">
            {triggers.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}

      {coping.length > 0 && (
        <>
          <h3>Something you could try</h3>
          <ul className="coping">
            {coping.map((c, i) => (
              <li key={i}>
                <strong>{c.title}.</strong> {c.how}
              </li>
            ))}
          </ul>
        </>
      )}

      {encouragement && <p className="encouragement">{encouragement}</p>}

      <button className="btn-secondary" onClick={onReset}>
        New check-in
      </button>
    </section>
  )
}
