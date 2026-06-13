import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  resolveRequest,
  callGemini,
  isSameOrigin,
  rateLimited,
  clientIp,
} from './api/gemini-core.js'

/**
 * Dev-server proxy for the optional Gemini provider.
 *
 * The API key is read here, SERVER-SIDE, from `GEMINI_API_KEY` in `.env`. It is never exposed to
 * the browser bundle (only `VITE_`-prefixed vars are). The client posts { mode, user } to
 * `/api/gemini`; this proxy picks the fixed prompt + budget, injects the key, calls Gemini, and
 * returns { content }. The request handling + security guards are shared with the production Vercel
 * function via api/gemini-core.js. A GET reports whether a key is configured (UI toggle state).
 * @param {Record<string, string>} env Loaded environment variables.
 * @returns {import('vite').Plugin}
 */
function geminiProxy(env) {
  const KEY = env.GEMINI_API_KEY || ''
  const MODEL = env.GEMINI_MODEL || 'gemini-2.5-flash'
  return {
    name: 'mindease-gemini-proxy',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const send = (status, payload) => {
          res.statusCode = status
          res.end(JSON.stringify(payload))
        }

        if (req.method === 'GET') {
          return send(200, { configured: Boolean(KEY), model: MODEL })
        }
        if (req.method !== 'POST') {
          return send(405, { error: 'Method not allowed' })
        }
        if (!isSameOrigin(req)) {
          return send(403, { error: 'Forbidden' })
        }
        if (rateLimited(clientIp(req))) {
          return send(429, { error: 'Too many requests — please slow down.' })
        }
        if (!KEY) {
          return send(400, { error: 'GEMINI_API_KEY is not set in .env' })
        }

        try {
          const body = await readJson(req)
          const spec = resolveRequest(body)
          if ('error' in spec) {
            return send(400, { error: spec.error })
          }
          const result = await callGemini(spec, { key: KEY, model: MODEL })
          if (!result.ok) {
            // Log upstream detail server-side only; return a generic message to the browser.
            console.error('[gemini] upstream error:', result.error, result.detail)
            return send(result.status, { error: result.error })
          }
          return send(200, { content: result.content })
        } catch (err) {
          console.error('[gemini] proxy error:', err)
          return send(500, { error: 'Internal error' })
        }
      })
    },
  }
}

/** Read and JSON-parse a request body. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

// MindEase runs on-device by default; the proxy above only activates if you opt into Gemini.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), geminiProxy(env)],
    test: {
      globals: true,
      environment: 'node', // component tests opt into jsdom via a per-file pragma
      setupFiles: ['./src/test/setup.js'],
    },
  }
})
