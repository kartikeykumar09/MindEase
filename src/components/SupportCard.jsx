import ReadAloud from './ReadAloud.jsx'

/**
 * Shown when triage risk is "none". Displays the empathetic reflection, detected trigger tags,
 * 1-2 coping techniques, and one encouragement line.
 * @param {{ analysis: import('../lib/model.js').parseAnalysis extends (...args: any) => infer R ? R : any, onReset: () => void }} props
 * @returns {JSX.Element}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h2 id="support-title" style={{ margin: 0 }}>
          A moment of reflection
        </h2>
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

      {encouragement && <p style={{ fontStyle: 'italic' }}>{encouragement}</p>}

      <button className="btn-secondary" onClick={onReset}>
        New check-in
      </button>
    </section>
  )
}
