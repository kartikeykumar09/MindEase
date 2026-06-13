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

/**
 * Supported provider ids.
 * @type {{ OLLAMA: 'ollama', GEMINI: 'gemini' }}
 */
export const PROVIDERS = { OLLAMA: 'ollama', GEMINI: 'gemini' }

/** Max characters of journal text sent to the model — keeps small models fast + cloud cost bounded. */
export const MAX_JOURNAL_CHARS = 2000

/**
 * Dispatch a chat call to the chosen provider with JSON-mode formatting.
 *
 * For on-device Ollama we send the full system prompt directly. For the cloud Gemini relay we send
 * only the `mode`; the server owns the prompt + token budget (see api/gemini-core.js), so a public
 * deploy can't be driven with arbitrary prompts.
 * @param {('ollama'|'gemini')} provider
 * @param {{ mode: ('triage'|'analyze'), system: string, user: string, temperature: number, maxTokens: number }} spec
 * @returns {Promise<string>} The raw assistant message content.
 * @throws if the model is unreachable or returns a non-OK status.
 */
function chat(provider, { mode, system, user, temperature, maxTokens }) {
  return provider === PROVIDERS.GEMINI
    ? geminiChat({ mode, user })
    : ollamaChat({ system, user, temperature, maxTokens })
}

/**
 * @typedef {Object} SupportContext
 * @property {string[]} [recurringTriggers]  The student's most-frequent past triggers.
 * @property {string} [moodTrend]            A short natural-language mood-trend note.
 * @property {{name?: string, daysUntil?: number|null}} [exam]  Exam the student is preparing for.
 * @property {string} [priorReflection]      The previous reflection, when this is a follow-up turn.
 */

/**
 * Compose the analysis user message: the current mood + journal text, plus a compact, optional
 * "context" block so support can adapt to the student's history (recurring triggers, mood trend,
 * exam, and any earlier reflection in this conversation). Kept short to stay fast on small models.
 * @param {number} mood
 * @param {string} text
 * @param {SupportContext} [context={}]
 * @returns {string}
 */
export function buildAnalysisUser(mood, text, context = {}) {
  const journal = String(text || '').slice(0, MAX_JOURNAL_CHARS)
  let msg = `Mood (1-5): ${mood}\n\nJournal entry:\n${journal}`

  const notes = []
  if (Array.isArray(context.recurringTriggers) && context.recurringTriggers.length) {
    notes.push(
      `Recurring themes this student has mentioned before: ${context.recurringTriggers.join(', ')}.`,
    )
  }
  if (context.moodTrend) notes.push(`Recent mood trend: ${context.moodTrend}.`)
  if (context.exam?.name) {
    const when =
      typeof context.exam.daysUntil === 'number' && context.exam.daysUntil >= 0
        ? ` (in ${context.exam.daysUntil} day${context.exam.daysUntil === 1 ? '' : 's'})`
        : ''
    notes.push(`Preparing for: ${context.exam.name}${when}.`)
  }
  if (context.priorReflection) {
    notes.push(`Earlier in this conversation you reflected: "${context.priorReflection}"`)
  }
  if (notes.length) {
    msg += `\n\nContext (use gently to personalise — do not force-fit, never quote it back verbatim):\n- ${notes.join('\n- ')}`
  }
  return msg
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
  const raw = await chat(provider, {
    mode: 'triage',
    system: TRIAGE_SYSTEM_PROMPT,
    user: String(text || '').slice(0, MAX_JOURNAL_CHARS),
    temperature: 0,
    maxTokens: 80,
  })
  return parseTriage(raw)
}

/**
 * PASS 2 — generate warm, personalised support. Only call when triage risk is "none".
 * @param {number} mood Mood rating 1-5.
 * @param {string} text Journal entry.
 * @param {('ollama'|'gemini')} [provider='ollama']
 * @param {SupportContext} [context={}] Optional personalisation context.
 * @returns {Promise<ReturnType<typeof parseAnalysis>>}
 */
export async function analyze(mood, text, provider = PROVIDERS.OLLAMA, context = {}) {
  // 512 tokens fits a full reflection + coping without truncating the closing JSON brace.
  const raw = await chat(provider, {
    mode: 'analyze',
    system: ANALYSIS_SYSTEM_PROMPT,
    user: buildAnalysisUser(mood, text, context),
    temperature: 0.4,
    maxTokens: 512,
  })
  return parseAnalysis(raw)
}
