import { TELE_MANAS } from '../lib/constants.js'

/**
 * Shown when safety triage returns "elevated" or "crisis". Deliberately offers NO coping
 * advice — only a caring message, the hardcoded helpline, and a nudge toward a trusted person.
 * @param {{ onReset: () => void }} props
 * @returns {JSX.Element}
 */
export default function SafetyCard({ onReset }) {
  return (
    <section className="card safety" role="alert" aria-labelledby="safety-title">
      <h2 id="safety-title">You don't have to carry this alone</h2>
      <p>
        It sounds like things feel really heavy right now. You matter, and talking to someone can
        help more than anything an app can offer. Please reach out — right now if you can.
      </p>

      <a className="helpline" href={`tel:${TELE_MANAS.primary}`}>
        📞 Call {TELE_MANAS.name} {TELE_MANAS.primary}
      </a>
      <p className="muted">
        {TELE_MANAS.note}. You can also call {TELE_MANAS.alternate}.
      </p>

      <p>
        If you can, reach out to a trusted person too — a parent, a friend, a teacher, anyone who
        can sit with you. You deserve support from a real human, not just a screen.
      </p>

      <button className="btn-secondary" onClick={onReset}>
        Back to check-in
      </button>
    </section>
  )
}
