/**
 * Helpers for turning stored entries into dashboard data: recurring trigger counts and
 * a mood-over-time series. Pure functions, easy to unit-test.
 */

/**
 * Count how often each trigger tag appears across entries, most frequent first.
 * @param {import('./storage.js').Entry[]} entries
 * @returns {{tag: string, count: number}[]}
 */
export function aggregateTriggers(entries) {
  const counts = new Map()
  for (const entry of entries) {
    const tags = entry?.analysis?.triggers
    if (!Array.isArray(tags)) continue
    for (const raw of tags) {
      if (typeof raw !== 'string') continue
      const tag = raw.toLowerCase().trim()
      if (!tag) continue
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Build a chronological mood series (oldest → newest) for charting.
 * @param {import('./storage.js').Entry[]} entries
 * @returns {{ts: number, mood: number}[]}
 */
export function moodSeries(entries) {
  return entries
    .filter((e) => typeof e?.mood === 'number' && e.mood >= 1 && e.mood <= 5)
    .map((e) => ({ ts: e.ts, mood: e.mood }))
    .sort((a, b) => a.ts - b.ts)
}
