import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './gemini.js'
import { _resetRateLimit } from './gemini-core.js'

/** Build a fake Vercel-style req (body pre-parsed object) with a same-origin header by default. */
function makeReq({ method = 'POST', body, headers } = {}) {
  return {
    method,
    body,
    headers: { host: 'app.test', origin: 'https://app.test', ...headers },
  }
}

/** Build a fake res capturing status + json. */
function makeRes() {
  const res = {
    statusCode: 0,
    payload: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(obj) {
      this.payload = obj
      return this
    },
  }
  return res
}

const OLD_ENV = { ...process.env }

beforeEach(() => {
  _resetRateLimit()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.restoreAllMocks()
})

describe('api/gemini handler', () => {
  it('GET reports configured + model from env', async () => {
    process.env.GEMINI_API_KEY = 'k'
    process.env.GEMINI_MODEL = 'gemini-x'
    const res = makeRes()
    await handler(makeReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ configured: true, model: 'gemini-x' })
  })

  it('rejects a non-POST/GET method with 405', async () => {
    const res = makeRes()
    await handler(makeReq({ method: 'DELETE' }), res)
    expect(res.statusCode).toBe(405)
  })

  it('blocks a cross-origin POST with 403 before doing any work', async () => {
    process.env.GEMINI_API_KEY = 'k'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = makeRes()
    await handler(
      makeReq({ headers: { origin: 'https://evil.test' }, body: { mode: 'triage', user: 'x' } }),
      res,
    )
    expect(res.statusCode).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 when no key is configured', async () => {
    delete process.env.GEMINI_API_KEY
    const res = makeRes()
    await handler(makeReq({ body: { mode: 'triage', user: 'hi' } }), res)
    expect(res.statusCode).toBe(400)
    expect(res.payload.error).toMatch(/GEMINI_API_KEY/)
  })

  it('returns 400 for an unknown mode (no prompt injection path)', async () => {
    process.env.GEMINI_API_KEY = 'k'
    const res = makeRes()
    await handler(makeReq({ body: { mode: 'jailbreak', user: 'hi' } }), res)
    expect(res.statusCode).toBe(400)
    expect(res.payload).toEqual({ error: 'Invalid request' })
  })

  it('returns content on a successful upstream call', async () => {
    process.env.GEMINI_API_KEY = 'k'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"risk":"none"}' }] } }] }),
      }),
    )
    const res = makeRes()
    await handler(makeReq({ body: { mode: 'triage', user: 'tired' } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ content: '{"risk":"none"}' })
  })

  it('maps an upstream failure to 502 with a generic error (no detail leak)', async () => {
    process.env.GEMINI_API_KEY = 'k'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'secret detail' }),
    )
    const res = makeRes()
    await handler(makeReq({ body: { mode: 'analyze', user: 'hi' } }), res)
    expect(res.statusCode).toBe(502)
    expect(res.payload).toEqual({ error: 'AI service error' })
    expect(JSON.stringify(res.payload)).not.toContain('secret detail')
  })

  it('handles a malformed body as an invalid request, not a crash', async () => {
    process.env.GEMINI_API_KEY = 'k'
    const res = makeRes()
    // body present but not the expected shape → resolveRequest rejects.
    await handler(makeReq({ body: { totally: 'wrong' } }), res)
    expect(res.statusCode).toBe(400)
    expect(res.payload).toEqual({ error: 'Invalid request' })
  })

  it('throttles a burst from one IP with 429', async () => {
    process.env.GEMINI_API_KEY = 'k'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
      }),
    )
    let got429 = false
    for (let i = 0; i < 35; i++) {
      const res = makeRes()
      await handler(makeReq({ body: { mode: 'triage', user: 'x' } }), res)
      if (res.statusCode === 429) got429 = true
    }
    expect(got429).toBe(true)
  })
})
