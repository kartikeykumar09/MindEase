/**
 * Gemini provider — OPTIONAL, cloud-based. Journal text is sent to Google's servers via a local
 * dev-server proxy (`/api/gemini`) that injects the API key server-side. This is NOT on-device;
 * the UI labels it clearly and Ollama remains the private default.
 */

const PROXY_URL = '/api/gemini'

/**
 * Call Gemini through the local proxy in JSON mode. For security the relay is server-driven: we
 * send only the `mode` (the server picks the fixed prompt + token budget) and the user text. The
 * system prompt is never sent from the browser.
 * @param {{ mode: ('triage'|'analyze'), user: string }} req
 * @returns {Promise<string>} Raw assistant message content.
 * @throws if the proxy/Gemini errors or no key is configured.
 */
export async function geminiChat({ mode, user }) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, user }),
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
