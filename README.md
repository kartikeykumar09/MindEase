# MindEase 🌿

**A private journaling + mood companion that helps students manage stress during high-stakes exams**
(NEET / JEE / CUET / CAT / GATE / UPSC).

MindEase helps you notice the stress you can't always name — surfacing hidden triggers and emotional
patterns, offering gentle evidence-based coping, and knowing when to hand off to a real human.
Everything runs **on your device**. Your journal never leaves your browser.

---

## Why it's different

Standard mood trackers ask "rate your day 1–5" and miss the real signal. The signal lives in what
you _write_ — but students won't pour their fears into something that ships their mental health to a
server. MindEase keeps it private by design, and draws a hard line around crisis: it doesn't play
therapist, it routes you to help.

## Features

- **Check-in** — a 1–5 mood selector + free-text journal, saved instantly to your browser.
- **Safety first** — every entry is screened for crisis risk _before_ anything else.
- **Empathetic reflection** — a warm, non-judgmental reflection of what you're feeling.
- **Hidden triggers** — detected stressors (sleep, comparison, time pressure, self-doubt…) tagged per entry.
- **Curated coping** — 1–2 safe, evidence-based techniques (breathing, grounding, breaks, sleep, etc.).
- **Personalised over time** — support adapts to _your_ history: your recurring triggers, recent
  mood trend, and the exam you're preparing for are woven into each reflection.
- **Companion follow-up** — say more and keep the conversation going; every follow-up is re-screened
  for safety first, and carries the prior reflection as context.
- **Patterns dashboard** — narrative insights ("your mood tends to dip on Wednesdays"), a
  mood-over-time chart, and your recurring triggers, ranked. All computed on-device, no AI call.
- **Exam context (optional)** — tell MindEase which exam and when, to ground support in your timeline.
- **History** — revisit past entries, delete any single one, or clear everything in one tap.
- **Read aloud** — hear reflections via your browser's speech synthesis.

## 🔒 Privacy by design (on-device)

- Journal entries are stored **only** in your browser's `localStorage`. There is **no backend, no
  account, no cloud database, and no analytics**.
- By default, AI runs on a **local** [Ollama](https://ollama.com) model at `http://localhost:11434`.
  Your words are sent only to software running on your own machine — **data never leaves the device**.
- You stay in control of your data: delete any entry, or **Clear all** from the History tab.
  Clearing your browser data also wipes your journal. Nobody else can read it.

See [SECURITY.md](SECURITY.md) for the full data-handling and threat model.

### Optional: Gemini (cloud) provider

MindEase has an **AI-engine toggle**: **Local · private** (default) or **Gemini · cloud**. The
on-device option is the recommended, privacy-preserving default. Gemini is available only for
comparison and only if you opt in:

- Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (it starts with
  `AIza`), and set `GEMINI_API_KEY` in your local `.env` (gitignored — never committed).
- The key is read **server-side** — by the Vite dev-server proxy in development and by the Vercel
  function [`api/gemini.js`](api/gemini.js) in production; both share [`api/gemini-core.js`](api/gemini-core.js).
  It is never bundled into the browser code.
- **The relay is hardened** (it's internet-reachable on a public deploy): the client sends only a
  `mode` (`triage`/`analyze`) and the journal text — the **system prompt and token budget are
  server-owned** (no prompt injection, no unbounded cost), user text is length-capped, requests must
  be **same-origin**, and a **per-IP rate limit** throttles bursts. Upstream errors are logged
  server-side and returned to the browser as a generic message.
- ⚠️ **Choosing Gemini sends your journal text to Google's servers** — this is _not_ on-device. The
  UI shows a clear banner whenever the cloud engine is active. Switch back to **Local · private** to
  stay fully on-device.
- **Never commit your key.** `.env` is gitignored, and a [pre-commit hook](.githooks/pre-commit)
  (`npm run setup:hooks`) blocks committing `.env` or any secret-shaped string. If a key is ever
  exposed, rotate it in Google AI Studio immediately.

## 🆘 Safety model

MindEase is a **companion for everyday stress — not a therapist or a crisis service.**

1. **Triage runs first.** Every entry is classified for crisis risk _before_ any support is generated.
2. **If risk is elevated or crisis**, MindEase shows **only** a calm support card with the helpline and
   a nudge to reach a trusted person — it generates **no coping "advice"** in that path.
3. **The helpline is hardcoded** and never produced by the model:
   **Tele-MANAS — 14416** (also 1-800-891-4416), free & 24/7, Government of India.
4. **Fail safe.** If a safety check can't be parsed, MindEase treats the risk as _elevated_, never _none_.
5. **No diagnoses, no medical claims.** Coping content is general, curated, and evidence-based.

> If you or someone you know is in distress, call **Tele-MANAS 14416** — free, 24/7.

## Getting started

**Prerequisites:** [Node.js](https://nodejs.org) 18+ and [Ollama](https://ollama.com).

```bash
# 1. Start the local model
ollama pull gemma3:4b      # or your preferred local model
ollama serve               # runs at http://localhost:11434

# 2. Run the app
npm install
npm run dev                # open the printed localhost URL
```

> Using a different local model? Change the one line `MODEL_TAG` in
> [`src/lib/constants.js`](src/lib/constants.js).

If Ollama isn't running, your entry is still saved and MindEase shows a calm "couldn't reach the
local model" message — it never crashes and never sends your data anywhere.

## Tech & architecture

React + Vite, plain JavaScript with JSDoc. **Minimal dependencies** — just React; the mood chart is
hand-rolled SVG (no chart library).

```
CheckIn (mood + journal + optional exam) ──save──▶ localStorage
        │
        ▼  PASS 1: safety triage  (runs first, always)
   risk = elevated/crisis ──▶ SafetyCard only (Tele-MANAS 14416). Stop.
   risk = none ──▶ PASS 2: analysis (+ context: recurring triggers, mood trend, exam)
                         ──▶ SupportCard (reflection, triggers, coping, encouragement)
                              │
                              ▼  optional follow-up ──▶ PASS 1 again (safety) ──▶ PASS 2 with prior reflection

Dashboard ◀── localStorage ──▶ HistoryList
```

The cloud path adds one hop: the browser posts `{ mode, user }` to `/api/gemini`, which injects the
key server-side and picks the fixed prompt + budget — see [Optional: Gemini](#optional-gemini-cloud-provider).

| Path              | Purpose                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/components/` | UI: `CheckIn`, `SafetyCard`, `SupportCard`, `Dashboard`, `MoodChart`, `HistoryList`, `Footer`, `ReadAloud` |
| `src/lib/`        | Logic: `constants.js`, `prompts.js`, `storage.js`, `model.js`, `triggers.js`, `providers/`                 |
| `api/`            | Server-side Gemini relay: `gemini.js` (Vercel fn) + `gemini-core.js` (shared request + security guards)    |
| `src/App.jsx`     | Flow state machine                                                                                         |

## Accessibility

Large readable text, high contrast, full keyboard navigation, ARIA labels, big tap targets, an
SVG chart with a screen-reader data table, and respect for `prefers-reduced-motion`.

## Testing

```bash
npm test
```

102 tests (vitest + React Testing Library) cover the safety-critical logic, the API relay, and the UI flow:

- **Safety gating (integration)** — rendering `<App>` with a mocked crisis/elevated triage shows
  **only** the `SafetyCard` and asserts `analyze()` is **never** called; a crisis _follow-up_ also
  switches back to the safety screen.
- **Model parsing** — JSON extraction (clean / prose-wrapped / fenced / garbled), the **fail-safe**
  triage behavior (unparseable → _elevated_, never _none_), analysis normalisation, and the
  personalisation context builder.
- **Provider dispatch** — `triage`/`analyze` route to the right backend (mocked `fetch`); the Gemini
  relay receives **only** `{ mode, user }` (never the system prompt); transport errors propagate.
- **API relay security** — `resolveRequest` ignores client-supplied prompts and caps user length;
  the `api/gemini.js` handler is tested for GET-configured, 400 (no key / bad mode), **403**
  (cross-origin), **429** (rate limit), 502 (generic error, no detail leak), and malformed bodies.
- **Storage** — save / load / update / **delete** / clear, the exam profile, newest-first ordering,
  and graceful recovery from corrupt `localStorage`.
- **Patterns** — trigger aggregation, mood-trend description, and the dashboard narrative insights.
- **Components** — `CheckIn` (disabled-state hint, exam fields), `SupportCard` (follow-up form),
  `HistoryList` (delete + confirm-to-clear), and the `SafetyCard`/helpline.

## Development & quality

```bash
npm run dev          # start the dev server
npm test             # run tests (vitest + RTL)
npm run typecheck    # type-check the JSDoc on src/lib via tsc --checkJs
npm run lint         # ESLint (flat config: react + hooks)
npm run format       # Prettier (format)
npm run format:check # Prettier (verify)
npm run build        # production build
npm run setup:hooks  # enable the secret-blocking pre-commit hook
```

The codebase is JSDoc-documented throughout, **type-checked** (the JSDoc on `src/lib` is enforced by
`tsc --checkJs`, so types can't rot silently), ESLint-clean, and Prettier-formatted. Runtime
dependencies are kept to just React; the mood chart is hand-rolled SVG (no chart library).

## License

MIT — see [LICENSE](LICENSE). Built for the PromptWars hackathon.
