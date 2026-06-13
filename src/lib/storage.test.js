import { describe, it, expect, beforeEach } from 'vitest'
import { loadEntries, saveEntry, updateEntry, clearEntries } from './storage.js'
import { STORAGE_KEY } from './constants.js'

/** Minimal in-memory localStorage so the pure storage logic can be tested in a node env. */
function installMemoryStorage() {
  const map = new Map()
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  }
  return map
}

describe('storage', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('returns an empty array when nothing is stored', () => {
    expect(loadEntries()).toEqual([])
  })

  it('saves an entry with a generated id and timestamp, newest first', () => {
    const a = saveEntry({ mood: 3, text: 'first' })
    saveEntry({ mood: 5, text: 'second' })
    expect(a.id).toBeTruthy()
    expect(typeof a.ts).toBe('number')
    const all = loadEntries()
    expect(all).toHaveLength(2)
    expect(all[0].text).toBe('second') // unshifted — newest first
    expect(all[1].text).toBe('first')
  })

  it('defaults analysis to null on save', () => {
    expect(saveEntry({ mood: 2, text: 'x' }).analysis).toBeNull()
  })

  it('updates an existing entry in place', () => {
    const e = saveEntry({ mood: 1, text: 'sad' })
    const updated = updateEntry(e.id, { risk: 'none', analysis: { reflection: 'ok' } })
    expect(updated.risk).toBe('none')
    expect(loadEntries()[0].analysis.reflection).toBe('ok')
  })

  it('returns null when updating a missing id', () => {
    expect(updateEntry('does-not-exist', { risk: 'none' })).toBeNull()
  })

  it('clears all entries', () => {
    saveEntry({ mood: 3, text: 'a' })
    clearEntries()
    expect(loadEntries()).toEqual([])
  })

  it('recovers gracefully from corrupt stored JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadEntries()).toEqual([])
  })

  it('ignores a stored value that is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    expect(loadEntries()).toEqual([])
  })
})
