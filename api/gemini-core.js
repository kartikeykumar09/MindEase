/**
 * Shared Gemini relay logic, used by BOTH the Vercel serverless function (api/gemini.js) and the
 * local Vite dev-server proxy (vite.config.js). Keeping it in one place means the request shape,
 * the security guards, and the response parsing can never drift between dev and prod.
 *
 * SECURITY MODEL — this relay is internet-reachable on a public Vercel deploy, so it is hardened
 * against being used as a free, open LLM billed to the deployer:
 *   - The system prompt is NEVER taken from the client. The client sends only a `mode`
 *     ('triage' | 'analyze') and the user text; the server picks the fixed prompt + token budget.
 *   - The user text is length-capped (MAX_USER_CHARS) and the token budget is fixed per mode.
 *   - Requests must be same-origin (Origin/Referer host must match Host).
 *   - A best-effort per-IP rate limit throttles bursts.
 *   - Upstream error detail is returned for SERVER-SIDE logging only, never forwarded to the client.
 *
 * This module is Node-side only — it is never imported by browser code, so the API key it handles
 * stays server-side.
 */
import { TRIAGE_SYSTEM_PROMPT, ANALYSIS_SYSTEM_PROMPT } from '../src/lib/prompts.js'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Max characters of user text accepted per request — bounds cost and stops huge payloads. */
export const MAX_USER_CHARS = 4000

/**
 * The fixed, server-owned call configs. The client picks a mode; it can never supply the prompt
 * or inflate the token budget. Token budgets mirror src/lib/model.js.
 */
const MODES = {
  triage: { system: TRIAGE_SYSTEM_PROMPT, temperature: 0, maxTokens: 80 },
  analyze: { system: ANALYSIS_SYSTEM_PROMPT, temperature: 0.4, maxTokens: 512 },
}

/**
 * Read Gemini settings from the environment. Defaults the model to gemini-2.5-flash.
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {{ key: string, model: string }}
 */
export function geminiSettings(env = process.env) {
  return {
    key: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || 'gemini-2.5-flash',
  }
}

/**
 * Resolve a client request body into a safe, server-owned call spec. Ignores any client-supplied
 * system prompt, temperature, or token budget.
 * @param {{ mode?: string, user?: string }} body
 * @returns {{ system: string, user: string, temperature: number, maxTokens: number } | { error: string }}
 */
export function resolveRequest(body) {
  const cfg = MODES[body?.mode]
  if (!cfg) return { error: 'Invalid request' }
  const user = String(body?.user ?? '').slice(0, MAX_USER_CHARS)
  return { system: cfg.system, user, temperature: cfg.temperature, maxTokens: cfg.maxTokens }
}

/**
 * Build the Gemini `generateContent` request body in JSON mode. `maxTokens` is hard-clamped as a
 * defence-in-depth backstop even though the server already fixes it per mode.
 * @param {{ system?: string, user?: string, temperature?: number, maxTokens?: number }} params
 * @returns {object}
 */
export function buildGeminiBody({ system, user, temperature, maxTokens }) {
  return {
    systemInstruction: { parts: [{ text: system || '' }] },
    contents: [{ role: 'user', parts: [{ text: user || '' }] }],
    generationConfig: {
      temperature: typeof temperature === 'number' ? temperature : 0.4,
      maxOutputTokens: Math.min(typeof maxTokens === 'number' ? maxTokens : 512, 1024),
      responseMimeType: 'application/json',
      // Disable "thinking" — otherwise reasoning tokens consume the output budget and truncate the
      // JSON. These are structured classification/extraction tasks, not open-ended reasoning.
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
}

/**
 * Call Gemini through Google's API and normalise the result into a small, render-ready shape.
 * Never throws on an upstream error — returns `{ ok: false, ... }` so callers can map it to a
 * response. The upstream error `detail` is returned for SERVER-SIDE logging only; callers must
 * not forward it to the browser.
 * @param {{ system?: string, user?: string, temperature?: number, maxTokens?: number }} params
 * @param {{ key: string, model: string }} settings
 * @returns {Promise<{ ok: true, content: string } | { ok: false, status: number, error: string, detail?: string }>}
 */
export async function callGemini(params, { key, model }) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiBody(params)),
  })
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return { ok: false, status: 502, error: 'AI service error', detail }
  }
  const data = await upstream.json()
  const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  return { ok: true, content }
}

/**
 * Same-origin guard. A browser sends an `Origin` header on cross-origin and same-origin POSTs;
 * we require its host (or the Referer host) to match the request Host so the relay can't be driven
 * cross-site or by a bare script.
 * @param {{ headers: Record<string, string|string[]|undefined> }} req
 * @returns {boolean}
 */
export function isSameOrigin(req) {
  const host = req.headers.host
  if (!host) return false
  const src = req.headers.origin || req.headers.referer
  if (!src) return false
  try {
    return new URL(String(src)).host === host
  } catch {
    return false
  }
}

/** @param {{ headers: Record<string, any>, socket?: { remoteAddress?: string } }} req */
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return String(fwd).split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

const hits = new Map()

/**
 * Best-effort in-memory per-IP rate limit. (On serverless this resets per cold start — a soft
 * guard, not a hard quota — but it still blunts bursts from a single source.)
 * @param {string} ip
 * @param {{ max?: number, windowMs?: number }} [opts]
 * @returns {boolean} true if the caller is OVER the limit and should be rejected.
 */
export function rateLimited(ip, { max = 30, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > max
}

/** Test helper — clears the rate-limit window. */
export function _resetRateLimit() {
  hits.clear()
}
