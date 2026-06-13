/**
 * Local model calls (Ollama) plus the pure parsing/validation helpers around them.
 *
 * Two passes per entry:
 *   1. triage()  — safety classification, runs FIRST.
 *   2. analyze() — warm support, only when triage risk is "none".
 *
 * Parsing is split out from the network calls so it can be unit-tested without a model.
 * Local models often wrap JSON in prose or code fences, so we extract defensively and,
 * for the safety pass, fail to the SAFER side.
 */
import { MODEL_TAG, OLLAMA_URL } from './constants.js'
import { TRIAGE_SYSTEM_PROMPT, ANALYSIS_SYSTEM_PROMPT } from './prompts.js'

const VALID_RISKS = ['none', 'elevated', 'crisis']

/**
 * Pull the first balanced JSON object out of arbitrary model text. Handles code fences,
 * leading/trailing prose, and nested braces.
 * @param {string} text
 * @returns {object|null} Parsed object, or null if none found / invalid.
 */
export function extractJson(text) {
  if (typeof text !== 'string') return null
  // Strip ```json ... ``` fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const haystack = fenced ? fenced[1] : text

  const start = haystack.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < haystack.length; i++) {
    const ch = haystack[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const slice = haystack.slice(start, i + 1)
        try {
          return JSON.parse(slice)
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/**
 * Validate + normalise a triage response. FAIL-SAFE: any unparseable or malformed response
 * is treated as "elevated" — never "none" — so the safety path is never skipped by accident.
 * @param {string} text Raw model output.
 * @returns {{risk: 'none'|'elevated'|'crisis', reason: string}}
 */
export function parseTriage(text) {
  const obj = extractJson(text)
  if (!obj || typeof obj.risk !== 'string' || !VALID_RISKS.includes(obj.risk)) {
    return { risk: 'elevated', reason: 'Could not assess safely — erring toward care.' }
  }
  return {
    risk: obj.risk,
    reason: typeof obj.reason === 'string' ? obj.reason : '',
  }
}

/**
 * Validate + normalise an analysis response into a safe, render-ready shape.
 * @param {string} text Raw model output.
 * @returns {{reflection: string, triggers: string[], coping: {title: string, how: string}[], encouragement: string}|null}
 *   null if nothing usable could be parsed.
 */
export function parseAnalysis(text) {
  const obj = extractJson(text)
  if (!obj) return null
  return {
    reflection: typeof obj.reflection === 'string' ? obj.reflection : '',
    triggers: Array.isArray(obj.triggers)
      ? obj.triggers.filter((t) => typeof t === 'string').map((t) => t.toLowerCase().trim()).slice(0, 4)
      : [],
    coping: Array.isArray(obj.coping)
      ? obj.coping
          .filter((c) => c && typeof c.title === 'string' && typeof c.how === 'string')
          .slice(0, 2)
      : [],
    encouragement: typeof obj.encouragement === 'string' ? obj.encouragement : '',
  }
}

/**
 * Low-level call to the local Ollama chat endpoint with JSON-mode formatting.
 * @param {string} system System prompt.
 * @param {string} user   User content.
 * @returns {Promise<string>} The raw assistant message content.
 * @throws if the model is unreachable or returns a non-OK status.
 */
async function chat(system, user) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_TAG,
      format: 'json',
      stream: false,
      options: { temperature: 0.4 },
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

/**
 * PASS 1 — classify crisis risk. Always run this first.
 * @param {string} text Journal entry.
 * @returns {Promise<{risk: 'none'|'elevated'|'crisis', reason: string}>}
 */
export async function triage(text) {
  const raw = await chat(TRIAGE_SYSTEM_PROMPT, text)
  return parseTriage(raw)
}

/**
 * PASS 2 — generate warm support. Only call when triage risk is "none".
 * @param {number} mood Mood rating 1-5.
 * @param {string} text Journal entry.
 * @returns {Promise<ReturnType<typeof parseAnalysis>>}
 */
export async function analyze(mood, text) {
  const raw = await chat(ANALYSIS_SYSTEM_PROMPT, `Mood (1-5): ${mood}\n\nJournal entry:\n${text}`)
  return parseAnalysis(raw)
}
