# Security & Privacy

MindEase is built privacy-first. This document describes how data is handled and the security
posture of the app.

## Data handling

- **Journal entries never leave your browser by default.** They are stored only in
  `localStorage` on your device. There is **no backend, no account, no cloud database, no
  analytics, and no tracking**.
- **No PII is collected.** The app asks for no name, email, login, or identifier of any kind.
- **On-device AI by default.** Inference runs against a _local_ Ollama instance at
  `http://localhost:11434` — requests stay on the user's machine.
- **Clearing browser storage** erases all entries. Nobody else can read them.

## Optional cloud provider (Gemini)

MindEase offers an **opt-in** "Gemini · cloud" engine for comparison. It is **off by default**, and
choosing it is the only path where text leaves the device:

- The UI shows a persistent banner whenever the cloud engine is active.
- The Gemini API key is read **server-side** — by the Vite dev-server proxy locally, and by the
  Vercel serverless function in production (`api/gemini.js`). It is **never** exposed to the browser
  bundle and is **never** committed (`.env` is git-ignored; only `.env.example` with a blank value
  is tracked).
- When Gemini is selected, only the current journal text + mood is sent to Google for that single
  request. No history is transmitted.

## Application security

- **No `eval`, no `dangerouslySetInnerHTML`.** All user text is rendered as React text nodes, which
  are escaped by default — no HTML injection surface.
- **No third-party runtime dependencies** beyond React, minimizing supply-chain surface.
- The safety helpline (Tele-MANAS **14416**) is **hardcoded** in `src/lib/constants.js` and can
  never be altered by model output.
- **Fail-safe triage:** if a safety classification cannot be parsed, risk is treated as `elevated`
  (never `none`), so the crisis path is never skipped by accident.

## Reporting

This is a hackathon project. For any security concern, open an issue on the repository.
