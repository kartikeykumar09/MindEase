import { describe, it, expect } from 'vitest'
import { extractJson, parseTriage, parseAnalysis } from './model.js'

describe('extractJson', () => {
  it('parses clean JSON', () => {
    expect(extractJson('{"risk":"none"}')).toEqual({ risk: 'none' })
  })

  it('extracts JSON wrapped in prose', () => {
    const text = 'Sure! Here is the result:\n{"risk":"crisis","reason":"x"}\nHope that helps.'
    expect(extractJson(text)).toEqual({ risk: 'crisis', reason: 'x' })
  })

  it('strips ```json code fences', () => {
    const text = '```json\n{"a":1}\n```'
    expect(extractJson(text)).toEqual({ a: 1 })
  })

  it('handles nested objects and braces inside strings', () => {
    const text = '{"reason":"he said {hi}","nested":{"k":2}}'
    expect(extractJson(text)).toEqual({ reason: 'he said {hi}', nested: { k: 2 } })
  })

  it('returns null for garbage', () => {
    expect(extractJson('no json here')).toBeNull()
    expect(extractJson('{ broken')).toBeNull()
    expect(extractJson(null)).toBeNull()
  })
})

describe('parseTriage — fail-safe', () => {
  it('passes through a valid "none"', () => {
    expect(parseTriage('{"risk":"none","reason":"exam worry"}')).toEqual({
      risk: 'none',
      reason: 'exam worry',
    })
  })

  it('passes through crisis', () => {
    expect(parseTriage('{"risk":"crisis","reason":"self-harm"}').risk).toBe('crisis')
  })

  it('treats unparseable output as elevated, never none', () => {
    expect(parseTriage('the model rambled').risk).toBe('elevated')
  })

  it('treats an invalid risk value as elevated', () => {
    expect(parseTriage('{"risk":"fine"}').risk).toBe('elevated')
  })

  it('never returns none when risk field is missing', () => {
    expect(parseTriage('{"reason":"x"}').risk).toBe('elevated')
  })
})

describe('parseAnalysis', () => {
  it('normalises a full response', () => {
    const raw = JSON.stringify({
      reflection: 'You sound tired.',
      triggers: ['Sleep', 'TIME PRESSURE'],
      coping: [{ title: 'Breathe', how: 'Inhale 4, exhale 6.' }],
      encouragement: 'You are doing your best.',
    })
    const out = parseAnalysis(raw)
    expect(out.reflection).toBe('You sound tired.')
    expect(out.triggers).toEqual(['sleep', 'time pressure'])
    expect(out.coping).toHaveLength(1)
  })

  it('caps triggers at 4 and coping at 2', () => {
    const raw = JSON.stringify({
      triggers: ['a', 'b', 'c', 'd', 'e'],
      coping: [
        { title: '1', how: 'x' },
        { title: '2', how: 'y' },
        { title: '3', how: 'z' },
      ],
    })
    const out = parseAnalysis(raw)
    expect(out.triggers).toHaveLength(4)
    expect(out.coping).toHaveLength(2)
  })

  it('drops malformed coping items', () => {
    const raw = JSON.stringify({ coping: [{ title: 'ok', how: 'fine' }, { title: 'no how' }] })
    expect(parseAnalysis(raw).coping).toHaveLength(1)
  })

  it('returns null when nothing parseable', () => {
    expect(parseAnalysis('garbage')).toBeNull()
  })
})
