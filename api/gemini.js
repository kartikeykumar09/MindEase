/**
 * Vercel serverless function for the optional Gemini provider (production deploys).
 *
 * Mirrors the local Vite dev-server proxy in vite.config.js — both delegate to the shared
 * api/gemini-core.js so the request/response handling and security guards can never drift. The API
 * key is read SERVER-SIDE from the `GEMINI_API_KEY` environment variable (set in the Vercel project
 * settings); it is never exposed to the browser.
 *
 *   GET  /api/gemini  -> { configured: boolean, model: string }
 *   POST /api/gemini  -> { content: string }   (body: { mode: 'triage'|'analyze', user: string })
 *
 * The relay is hardened (see api/gemini-core.js): the system prompt + token budget are server-owned,
 * user text is length-capped, requests must be same-origin, and a per-IP rate limit throttles bursts.
 *
 * @param {import('http').IncomingMessage & {method: string, body?: any}} req
 * @param {import('http').ServerResponse & {status: Function, json: Function}} res
 */
import {
  geminiSettings,
  resolveRequest,
  callGemini,
  isSameOrigin,
  rateLimited,
  clientIp,
} from './gemini-core.js'

export default async function handler(req, res) {
  const { key, model } = geminiSettings()

  if (req.method === 'GET') {
    return res.status(200).json({ configured: Boolean(key), model })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  // Security guards before any work: same-origin only, then a per-IP burst limit.
  if (!isSameOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many requests — please slow down.' })
  }
  if (!key) {
    return res
      .status(400)
      .json({ error: 'GEMINI_API_KEY is not set in the deployment environment' })
  }

  try {
    const body = await readBody(req)
    const spec = resolveRequest(body)
    if ('error' in spec) {
      return res.status(400).json({ error: spec.error })
    }
    const result = await callGemini(spec, { key, model })
    if (!result.ok) {
      // Log upstream detail server-side only; return a generic message to the browser.
      console.error('[gemini] upstream error:', result.error, result.detail)
      return res.status(result.status).json({ error: result.error })
    }
    return res.status(200).json({ content: result.content })
  } catch (err) {
    console.error('[gemini] handler error:', err)
    return res.status(500).json({ error: 'Internal error' })
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
