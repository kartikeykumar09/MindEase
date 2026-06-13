import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractJson, parseTriage, parseAnalysis, triage, analyze, PROVIDERS } from './model.js'
import { OLLAMA_URL } from './constants.js'

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

  it('strips stray <placeholder> brackets a small model may copy', () => {
    const raw = JSON.stringify({
      reflection: '<you sound tired>',
      triggers: ['<sleep>'],
      coping: [{ title: '<deep breathing>', how: '<breathe slowly>' }],
      encouragement: '<keep going>',
    })
    const out = parseAnalysis(raw)
    expect(out.reflection).toBe('you sound tired')
    expect(out.triggers).toEqual(['sleep'])
    expect(out.coping[0]).toEqual({ title: 'deep breathing', how: 'breathe slowly' })
    expect(out.encouragement).toBe('keep going')
  })

  it('drops coping items missing a real how', () => {
    const raw = JSON.stringify({ coping: [{ title: 'only a title' }] })
    expect(parseAnalysis(raw).coping).toEqual([])
  })

  it('returns null when nothing parseable', () => {
    expect(parseAnalysis('garbage')).toBeNull()
  })
})

describe('triage / analyze — provider dispatch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triage() calls the local Ollama endpoint and parses its content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"risk":"none","reason":"exam worry"}' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await triage('just tired', PROVIDERS.OLLAMA)
    expect(out).toEqual({ risk: 'none', reason: 'exam worry' })
    expect(fetchMock).toHaveBeenCalledWith(OLLAMA_URL, expect.objectContaining({ method: 'POST' }))
  })

  it('triage() routes to the Gemini proxy when provider is gemini', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: '{"risk":"crisis","reason":"self-harm"}' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await triage('hopeless', PROVIDERS.GEMINI)
    expect(out.risk).toBe('crisis')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gemini',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('triage() fails SAFE to elevated when the model returns unparseable content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'I cannot help' } }),
      }),
    )
    const out = await triage('anything', PROVIDERS.OLLAMA)
    expect(out.risk).toBe('elevated') // never silently "none"
  })

  it('triage() propagates a transport error (App then shows an error, never support)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(triage('anything', PROVIDERS.OLLAMA)).rejects.toThrow()
  })

  it('analyze() parses a well-formed support response', async () => {
    const payload = JSON.stringify({
      reflection: 'You sound stretched.',
      triggers: ['sleep'],
      coping: [{ title: 'Breathe', how: 'Slow breaths.' }],
      encouragement: 'You can do this.',
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ message: { content: payload } }) }),
    )
    const out = await analyze(2, 'so much to do', PROVIDERS.OLLAMA)
    expect(out.reflection).toBe('You sound stretched.')
    expect(out.coping).toHaveLength(1)
  })
})
