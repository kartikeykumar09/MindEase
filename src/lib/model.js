/**
 * Model orchestration plus the pure parsing/validation helpers around it.
 *
 * Two passes per entry:
 *   1. triage()  — safety classification, runs FIRST.
 *   2. analyze() — warm support, only when triage risk is "none".
 *
 * The actual model call is delegated to a provider (on-device Ollama by default, or optional
 * cloud Gemini). Parsing is split out from the network calls so it can be unit-tested without a
 * model. Models often wrap JSON in prose or code fences, so we extract defensively and, for the
 * safety pass, fail to the SAFER side.
 */
import { TRIAGE_SYSTEM_PROMPT, ANALYSIS_SYSTEM_PROMPT } from './prompts.js'
import { ollamaChat } from './providers/ollama.js'
import { geminiChat } from './providers/gemini.js'

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
    reflection: clean(obj.reflection),
    triggers: Array.isArray(obj.triggers)
      ? obj.triggers
          .filter((t) => typeof t === 'string')
          .map((t) => clean(t).toLowerCase())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    coping: Array.isArray(obj.coping)
      ? obj.coping
          .filter((c) => c && typeof c.title === 'string' && typeof c.how === 'string')
          .map((c) => ({ title: clean(c.title), how: clean(c.how) }))
          .filter((c) => c.title && c.how)
          .slice(0, 2)
      : [],
    encouragement: clean(obj.encouragement),
  }
}

/**
 * Tidy a model-produced string: trim, and strip a stray "<...>" placeholder wrapper that small
 * models sometimes copy from the prompt template (e.g. "<deep breathing>" -> "deep breathing").
 * @param {unknown} v
 * @returns {string}
 */
function clean(v) {
  if (typeof v !== 'string') return ''
  let s = v.trim()
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim()
  return s
}

/** Supported provider ids. */
export const PROVIDERS = { OLLAMA: 'ollama', GEMINI: 'gemini' }

/**
 * Dispatch a chat call to the chosen provider with JSON-mode formatting.
 * @param {('ollama'|'gemini')} provider
 * @param {string} system  System prompt.
 * @param {string} user    User content.
 * @param {number} temperature  Sampling temperature. Triage uses 0 for consistency.
 * @param {number} maxTokens    Cap on generated tokens — keeps each call short so a small local
 *   model can't run away and stall a low-powered machine.
 * @returns {Promise<string>} The raw assistant message content.
 * @throws if the model is unreachable or returns a non-OK status.
 */
function chat(provider, system, user, temperature, maxTokens) {
  const fn = provider === PROVIDERS.GEMINI ? geminiChat : ollamaChat
  return fn(system, user, temperature, maxTokens)
}

/**
 * PASS 1 — classify crisis risk. Always run this first.
 * @param {string} text Journal entry.
 * @param {('ollama'|'gemini')} [provider='ollama']
 * @returns {Promise<{risk: 'none'|'elevated'|'crisis', reason: string}>}
 */
export async function triage(text, provider = PROVIDERS.OLLAMA) {
  // temperature 0 — safety classification should be as consistent as possible.
  // 80 tokens is plenty for {risk, reason} and keeps this fast on small machines.
  const raw = await chat(provider, TRIAGE_SYSTEM_PROMPT, text, 0, 80)
  return parseTriage(raw)
}

/**
 * PASS 2 — generate warm support. Only call when triage risk is "none".
 * @param {number} mood Mood rating 1-5.
 * @param {string} text Journal entry.
 * @param {('ollama'|'gemini')} [provider='ollama']
 * @returns {Promise<ReturnType<typeof parseAnalysis>>}
 */
export async function analyze(mood, text, provider = PROVIDERS.OLLAMA) {
  // 512 tokens fits a full reflection + coping without truncating the closing JSON brace.
  const raw = await chat(
    provider,
    ANALYSIS_SYSTEM_PROMPT,
    `Mood (1-5): ${mood}\n\nJournal entry:\n${text}`,
    0.4,
    512,
  )
  return parseAnalysis(raw)
}
