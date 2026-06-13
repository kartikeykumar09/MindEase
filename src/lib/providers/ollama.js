/**
 * Ollama provider — fully on-device. Talks directly to a local Ollama instance from the browser.
 * Nothing leaves the machine.
 */
import { MODEL_TAG, OLLAMA_URL } from '../constants.js'

/**
 * Call the local Ollama chat endpoint in JSON mode.
 * @param {string} system System prompt.
 * @param {string} user   User content.
 * @param {number} temperature Sampling temperature.
 * @param {number} maxTokens   Cap on generated tokens (Ollama `num_predict`).
 * @returns {Promise<string>} Raw assistant message content.
 * @throws if Ollama is unreachable or returns a non-OK status.
 */
export async function ollamaChat(system, user, temperature, maxTokens) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_TAG,
      format: 'json',
      stream: false,
      keep_alive: '2m', // unload promptly after use to free memory
      options: { temperature, num_predict: maxTokens },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`)
  const data = await res.json()
  return data?.message?.content ?? ''
}
