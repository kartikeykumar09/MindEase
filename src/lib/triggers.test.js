import { describe, it, expect } from 'vitest'
import { aggregateTriggers, moodSeries, describeMoodTrend, patternInsights } from './triggers.js'

const entries = [
  { id: '1', ts: 300, mood: 2, analysis: { triggers: ['sleep', 'comparison'] } },
  { id: '2', ts: 100, mood: 4, analysis: { triggers: ['sleep'] } },
  { id: '3', ts: 200, mood: 3, analysis: { triggers: ['Sleep', 'time pressure'] } },
  { id: '4', ts: 250, mood: 5, analysis: null },
]

describe('aggregateTriggers', () => {
  it('counts case-insensitively, most frequent first', () => {
    expect(aggregateTriggers(entries)).toEqual([
      { tag: 'sleep', count: 3 },
      { tag: 'comparison', count: 1 },
      { tag: 'time pressure', count: 1 },
    ])
  })

  it('ignores entries without analysis', () => {
    expect(aggregateTriggers([{ id: 'x', ts: 1, mood: 3, analysis: null }])).toEqual([])
  })

  it('handles empty input', () => {
    expect(aggregateTriggers([])).toEqual([])
  })
})

describe('moodSeries', () => {
  it('returns chronological mood points (oldest first)', () => {
    expect(moodSeries(entries)).toEqual([
      { ts: 100, mood: 4 },
      { ts: 200, mood: 3 },
      { ts: 250, mood: 5 },
      { ts: 300, mood: 2 },
    ])
  })

  it('filters out invalid moods', () => {
    const bad = [{ ts: 1, mood: 9 }, { ts: 2, mood: 3 }, { ts: 3 }]
    expect(moodSeries(bad)).toEqual([{ ts: 2, mood: 3 }])
  })
})

const series = (moods) => moods.map((mood, i) => ({ ts: i + 1, mood }))

describe('describeMoodTrend', () => {
  it('returns empty when there is not enough data', () => {
    expect(describeMoodTrend([])).toBe('')
    expect(describeMoodTrend([{ ts: 1, mood: 3 }])).toBe('')
  })

  it('labels a recent low / good / mixed level', () => {
    expect(describeMoodTrend(series([2, 2, 2]))).toBe('low')
    expect(describeMoodTrend(series([5, 5, 4]))).toBe('good')
    expect(describeMoodTrend(series([3, 3, 3]))).toBe('mixed')
  })

  it('detects improvement and dipping versus the prior window', () => {
    expect(describeMoodTrend(series([1, 1, 1, 4, 4, 4]))).toBe('good and improving')
    expect(describeMoodTrend(series([5, 5, 5, 2, 2, 2]))).toBe('low and dipping')
  })
})

describe('patternInsights', () => {
  it('returns nothing for no data', () => {
    expect(patternInsights([])).toEqual([])
  })

  it('surfaces a recurring theme, a tough weekday, and the recent trend', () => {
    const day = 86_400_000
    const e = [
      { id: 'a', ts: 0, mood: 1, analysis: { triggers: ['sleep'] } },
      { id: 'b', ts: day * 3, mood: 5, analysis: { triggers: ['sleep'] } },
    ]
    const out = patternInsights(e)
    expect(out.some((s) => /most recurring theme/i.test(s) && /sleep/.test(s))).toBe(true)
    expect(out.some((s) => /dip on \w+day/i.test(s))).toBe(true)
    expect(out.some((s) => /lately your mood/i.test(s))).toBe(true)
  })
})
