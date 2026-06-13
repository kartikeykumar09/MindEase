/**
 * localStorage persistence for journal entries. This is the ONLY place entries are stored —
 * there is no backend. Everything stays in the user's browser.
 */
import { STORAGE_KEY } from './constants.js'

/**
 * @typedef {Object} Analysis
 * @property {string} reflection
 * @property {string[]} triggers
 * @property {{title: string, how: string}[]} coping
 * @property {string} encouragement
 */

/**
 * @typedef {Object} Entry
 * @property {string} id        Unique id.
 * @property {number} ts        Epoch ms when saved.
 * @property {number} mood      Mood rating 1-5.
 * @property {string} text      Journal text.
 * @property {('none'|'elevated'|'crisis')} [risk]  Safety triage result.
 * @property {Analysis|null} [analysis]             Support analysis (only when risk is none).
 */

/**
 * Read all stored entries, newest first.
 * @returns {Entry[]}
 */
export function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Persist an entry, returning the saved record (with id + timestamp filled in).
 * @param {{mood: number, text: string, risk?: string, analysis?: Analysis|null}} partial
 * @returns {Entry}
 */
export function saveEntry(partial) {
  const entry = {
    id: makeId(),
    ts: Date.now(),
    analysis: null,
    ...partial,
  }
  const entries = loadEntries()
  entries.unshift(entry)
  persist(entries)
  return entry
}

/**
 * Update an existing entry in place (e.g. attach triage/analysis after the model responds).
 * @param {string} id
 * @param {Partial<Entry>} patch
 * @returns {Entry|null} The updated entry, or null if not found.
 */
export function updateEntry(id, patch) {
  const entries = loadEntries()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return null
  entries[idx] = { ...entries[idx], ...patch }
  persist(entries)
  return entries[idx]
}

/** Remove every stored entry. */
export function clearEntries() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * @param {Entry[]} entries
 */
function persist(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* storage full or unavailable — fail quietly, the in-memory state still works */
  }
}

/** @returns {string} A reasonably unique id without external deps. */
function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
