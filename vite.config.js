import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev-server proxy for the optional Gemini provider.
 *
 * The API key is read here, SERVER-SIDE, from `GEMINI_API_KEY` in `.env`. It is never exposed to
 * the browser bundle (only `VITE_`-prefixed vars are). The client posts {system, user, temperature,
 * maxTokens} to `/api/gemini`; this proxy injects the key, calls Gemini, and returns {content}.
 * A GET to `/api/gemini` reports whether a key is configured, so the UI can enable/disable the toggle.
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

        if (req.method === 'GET') {
          res.end(JSON.stringify({ configured: Boolean(KEY), model: MODEL }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        if (!KEY) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not set in .env' }))
          return
        }

        try {
          const body = await readJson(req)
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`
          const upstream = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: body.system || '' }] },
              contents: [{ role: 'user', parts: [{ text: body.user || '' }] }],
              generationConfig: {
                temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
                maxOutputTokens: typeof body.maxTokens === 'number' ? body.maxTokens : 512,
                responseMimeType: 'application/json',
                // Disable "thinking" so reasoning tokens don't consume the output budget.
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          })
          if (!upstream.ok) {
            const detail = await upstream.text()
            res.statusCode = 502
            res.end(JSON.stringify({ error: `Gemini responded ${upstream.status}`, detail }))
            return
          }
          const data = await upstream.json()
          const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
          res.end(JSON.stringify({ content }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err?.message || err) }))
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
