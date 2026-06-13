/**
 * Gemini provider — OPTIONAL, cloud-based. Journal text is sent to Google's servers via a local
 * dev-server proxy (`/api/gemini`) that injects the API key server-side. This is NOT on-device;
 * the UI labels it clearly and Ollama remains the private default.
 */

const PROXY_URL = '/api/gemini'

/**
 * Call Gemini through the local proxy in JSON mode.
 * @param {string} system System prompt.
 * @param {string} user   User content.
 * @param {number} temperature Sampling temperature.
 * @param {number} maxTokens   Cap on generated tokens (Gemini `maxOutputTokens`).
 * @returns {Promise<string>} Raw assistant message content.
 * @throws if the proxy/Gemini errors or no key is configured.
 */
export async function geminiChat(system, user, temperature, maxTokens) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user, temperature, maxTokens }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Gemini proxy responded ${res.status}`)
  return data?.content ?? ''
}

/**
 * Ask the proxy whether a Gemini key is configured, so the UI can enable/disable the toggle.
 * @returns {Promise<boolean>}
 */
export async function geminiConfigured() {
  try {
    const res = await fetch(PROXY_URL, { method: 'GET' })
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data?.configured)
  } catch {
    return false
  }
}
