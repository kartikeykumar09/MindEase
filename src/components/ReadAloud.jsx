import { useState } from 'react'

/**
 * A small button that reads the given text aloud using the browser's SpeechSynthesis API.
 * Renders nothing if speech synthesis isn't available.
 * @param {{ text: string }} props
 * @returns {JSX.Element|null}
 */
export default function ReadAloud({ text }) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  if (!supported || !text) return null

  /** Toggle speaking on/off. */
  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.95
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
    setSpeaking(true)
  }

  return (
    <button className="btn-secondary" onClick={toggle} aria-pressed={speaking}>
      {speaking ? '⏹ Stop' : '🔊 Read aloud'}
    </button>
  )
}
