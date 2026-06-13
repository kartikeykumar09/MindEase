import { TELE_MANAS } from '../lib/constants.js'

/**
 * Always-visible disclaimer + helpline. Rendered on every screen.
 * @returns {JSX.Element}
 */
export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      MindEase supports everyday stress. It is not a substitute for professional care. In distress?{' '}
      <a href={`tel:${TELE_MANAS.primary}`}>
        Call {TELE_MANAS.name} {TELE_MANAS.primary}
      </a>{' '}
      (free, 24/7).
    </footer>
  )
}
