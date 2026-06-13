import { PROVIDERS } from '../lib/model.js'

/**
 * Toggle between the on-device (Ollama) provider and the optional cloud (Gemini) provider.
 * Gemini is disabled unless a key is configured server-side.
 * @param {{ provider: string, onChange: (p: string) => void, geminiAvailable: boolean }} props
 * @returns {JSX.Element}
 */
export default function ProviderToggle({ provider, onChange, geminiAvailable }) {
  return (
    <div className="provider" role="group" aria-label="AI provider">
      <span className="provider-label">AI engine:</span>
      <div className="segmented">
        <button
          aria-pressed={provider === PROVIDERS.OLLAMA}
          onClick={() => onChange(PROVIDERS.OLLAMA)}
        >
          🔒 Local · private
        </button>
        <button
          aria-pressed={provider === PROVIDERS.GEMINI}
          onClick={() => onChange(PROVIDERS.GEMINI)}
          disabled={!geminiAvailable}
          title={
            geminiAvailable ? 'Uses Google Gemini (cloud)' : 'Set GEMINI_API_KEY in .env to enable'
          }
        >
          ☁️ Gemini · cloud
        </button>
      </div>
    </div>
  )
}
