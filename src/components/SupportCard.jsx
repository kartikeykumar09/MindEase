import { useState } from 'react'
import ReadAloud from './ReadAloud.jsx'

/**
 * @typedef {import('../lib/storage.js').Analysis} Analysis
 */

/**
 * Shown when triage risk is "none". Displays the empathetic reflection, detected trigger tags,
 * 1-2 coping techniques, and one encouragement line. Optionally renders a companion follow-up box
 * so the student can say more and get another (still triage-gated) supportive turn.
 * @param {{
 *   analysis: Analysis|null,
 *   onReset?: () => void,
 *   onFollowUp?: (text: string) => void,
 *   busy?: boolean,
 *   titleId?: string,
 *   heading?: string,
 * }} props
 * @returns {JSX.Element|null}
 */
export default function SupportCard({
  analysis,
  onReset,
  onFollowUp,
  busy = false,
  titleId = 'support-title',
  heading = 'A moment of reflection',
}) {
  const [followText, setFollowText] = useState('')
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

  /** @param {React.FormEvent} e */
  function submitFollowUp(e) {
    e.preventDefault()
    const t = followText.trim()
    if (!t || busy) return
    onFollowUp(t)
    setFollowText('')
  }

  return (
    <section className="card" aria-labelledby={titleId}>
      <div className="card-head">
        <h2 id={titleId}>{heading}</h2>
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
            {coping.map((c) => (
              <li key={`${c.title}|${c.how}`}>
                <strong>{c.title}.</strong> {c.how}
              </li>
            ))}
          </ul>
        </>
      )}

      {encouragement && <p className="encouragement">{encouragement}</p>}

      {onFollowUp && (
        <form className="followup" onSubmit={submitFollowUp}>
          <label htmlFor={`followup-${titleId}`}>Want to say more?</label>
          <textarea
            id={`followup-${titleId}`}
            className="followup-input"
            value={followText}
            onChange={(e) => setFollowText(e.target.value)}
            placeholder="Tell me a little more…"
            rows={2}
            maxLength={2000}
          />
          <button className="btn-secondary" type="submit" disabled={busy || !followText.trim()}>
            {busy ? 'Thinking…' : 'Continue talking'}
          </button>
        </form>
      )}

      {onReset && (
        <button className="btn-secondary" onClick={onReset}>
          New check-in
        </button>
      )}
    </section>
  )
}
