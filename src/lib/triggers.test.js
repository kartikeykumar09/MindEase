import { describe, it, expect } from 'vitest'
import { aggregateTriggers, moodSeries } from './triggers.js'

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
