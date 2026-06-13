/**
 * Vercel serverless function for the optional Gemini provider (production deploys).
 *
 * Mirrors the local Vite dev-server proxy in vite.config.js, but runs as a deployed function so
 * the toggle works on Vercel too. The API key is read SERVER-SIDE from the `GEMINI_API_KEY`
 * environment variable (set in the Vercel project settings) — it is never exposed to the browser.
 *
 *   GET  /api/gemini  -> { configured: boolean, model: string }
 *   POST /api/gemini  -> { content: string }   (body: { system, user, temperature, maxTokens })
 *
 * @param {import('http').IncomingMessage & {method: string, body?: any}} req
 * @param {import('http').ServerResponse & {status: Function, json: Function}} res
 */
export default async function handler(req, res) {
  const KEY = process.env.GEMINI_API_KEY || ''
  const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  if (req.method === 'GET') {
    return res.status(200).json({ configured: Boolean(KEY), model: MODEL })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!KEY) {
    return res.status(400).json({ error: 'GEMINI_API_KEY is not set in the deployment environment' })
  }

  try {
    const body = await readBody(req)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: body.system || '' }] },
        contents: [{ role: 'user', parts: [{ text: body.user || '' }] }],
        generationConfig: {
          temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
          maxOutputTokens: typeof body.maxTokens === 'number' ? body.maxTokens : 512,
          responseMimeType: 'application/json',
        },
      }),
    })
    if (!upstream.ok) {
      const detail = await upstream.text()
      return res.status(502).json({ error: `Gemini responded ${upstream.status}`, detail })
    }
    const data = await upstream.json()
    const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
    return res.status(200).json({ content })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) })
  }
}

/**
 * Resolve the JSON request body whether Vercel pre-parsed it (object/string) or left it as a stream.
 * @param {any} req
 * @returns {Promise<Record<string, any>>}
 */
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
