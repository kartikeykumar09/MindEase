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
  Vercel serverless function in production (`api/gemini.js`, sharing `api/gemini-core.js`). It is
  **never** exposed to the browser bundle and is **never** committed (`.env` is git-ignored; only
  `.env.example` with a blank value is tracked). A [pre-commit hook](.githooks/pre-commit) blocks
  committing `.env` or any secret-shaped string; run `npm run setup:hooks` to enable it. If a key is
  ever exposed, **rotate it immediately** in Google AI Studio.
- When Gemini is selected, only the current entry (mood + journal text) plus a short **derived**
  context — your recurring trigger _tags_, a one-word mood-trend label, and your exam name if set —
  is sent for that single request. Your past journal text is **never** transmitted.

### Relay hardening (the proxy is internet-reachable on a public deploy)

The Gemini relay is designed so it can't be abused as a free, open LLM billed to the deployer:

- **The system prompt is server-owned.** The client sends only a `mode` (`triage` | `analyze`) and
  the user text; the server selects the fixed prompt — there is **no client-controlled prompt**, so
  no prompt-injection / jailbreak path.
- **Bounded cost.** The token budget is fixed per mode (and hard-clamped), and user text is
  length-capped server-side (`MAX_USER_CHARS`).
- **Same-origin only.** Requests whose `Origin`/`Referer` host doesn't match are rejected with `403`.
- **Rate limited.** A best-effort per-IP limiter throttles bursts (`429`).
- **No information leakage.** Upstream provider errors are logged server-side and returned to the
  browser as a generic message — never the raw provider detail.

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
