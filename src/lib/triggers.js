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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const avg = (nums) => nums.reduce((s, n) => s + n, 0) / nums.length

/**
 * A short natural-language summary of the recent mood trend, fed into the support prompt so advice
 * can adapt to where the student has been. Returns '' when there isn't enough data.
 * @param {{ts: number, mood: number}[]} series  Chronological mood series (see moodSeries).
 * @returns {string} e.g. 'low and dipping', 'good', 'mixed and improving', or ''.
 */
export function describeMoodTrend(series) {
  if (!Array.isArray(series) || series.length < 2) return ''
  const recent = series.slice(-3)
  const recentAvg = avg(recent.map((p) => p.mood))
  const level = recentAvg <= 2.2 ? 'low' : recentAvg >= 3.8 ? 'good' : 'mixed'

  let direction = ''
  const prev = series.slice(-6, -3)
  if (prev.length) {
    const delta = recentAvg - avg(prev.map((p) => p.mood))
    if (delta >= 0.5) direction = 'improving'
    else if (delta <= -0.5) direction = 'dipping'
  }
  return direction ? `${level} and ${direction}` : level
}

/**
 * Cheap, fully on-device narrative insights for the dashboard — no AI call. Surfaces emotional
 * patterns standard counters miss: a recurring theme, the toughest weekday, and the recent trend.
 * @param {import('./storage.js').Entry[]} entries
 * @returns {string[]} Up to three short human-readable sentences (possibly empty).
 */
export function patternInsights(entries) {
  const insights = []

  const triggers = aggregateTriggers(entries)
  if (triggers[0] && triggers[0].count >= 2) {
    insights.push(
      `Your most recurring theme is “${triggers[0].tag}” (mentioned ${triggers[0].count} times).`,
    )
  }

  // Toughest weekday — only meaningful with at least two distinct weekdays logged.
  const byDay = new Map()
  for (const e of entries) {
    if (typeof e?.mood !== 'number' || e.mood < 1 || e.mood > 5) continue
    const day = new Date(e.ts).getDay()
    const arr = byDay.get(day) || []
    arr.push(e.mood)
    byDay.set(day, arr)
  }
  if (byDay.size >= 2) {
    let worst = null
    for (const [day, moods] of byDay) {
      const m = avg(moods)
      if (!worst || m < worst.m) worst = { day, m }
    }
    if (worst && worst.m <= 2.8) {
      insights.push(`Your mood tends to dip on ${WEEKDAYS[worst.day]}s.`)
    }
  }

  const trend = describeMoodTrend(moodSeries(entries))
  if (trend) insights.push(`Lately your mood has been ${trend}.`)

  return insights
}
