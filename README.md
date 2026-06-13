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
- **Patterns dashboard** — a mood-over-time chart + your recurring triggers, ranked.
- **History** — revisit past entries.
- **Read aloud** — hear reflections via your browser's speech synthesis.

## 🔒 Privacy by design (on-device)

- Journal entries are stored **only** in your browser's `localStorage`. There is **no backend, no
  account, no cloud database, and no analytics**.
- By default, AI runs on a **local** [Ollama](https://ollama.com) model at `http://localhost:11434`.
  Your words are sent only to software running on your own machine — **data never leaves the device**.
- Clearing your browser data clears your journal. Nobody else can read it.

### Optional: Gemini (cloud) provider

MindEase has an **AI-engine toggle**: **Local · private** (default) or **Gemini · cloud**. The
on-device option is the recommended, privacy-preserving default. Gemini is available only for
comparison and only if you opt in:

- Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (it starts with
  `AIza`), and set `GEMINI_API_KEY` in your local `.env` (gitignored — never committed).
- The key is read **server-side** by a small Vite dev-server proxy (`/api/gemini`); it is never
  bundled into the browser code.
- ⚠️ **Choosing Gemini sends your journal text to Google's servers** — this is _not_ on-device. The
  UI shows a clear banner whenever the cloud engine is active. Switch back to **Local · private** to
  stay fully on-device.

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
CheckIn (mood + journal) ──save──▶ localStorage
        │
        ▼  PASS 1: safety triage  (runs first, always)
   risk = elevated/crisis ──▶ SafetyCard only (Tele-MANAS 14416). Stop.
   risk = none ──▶ PASS 2: analysis ──▶ SupportCard (reflection, triggers, coping, encouragement)

Dashboard ◀── localStorage ──▶ HistoryList
```

| Path              | Purpose                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/components/` | UI: `CheckIn`, `SafetyCard`, `SupportCard`, `Dashboard`, `MoodChart`, `HistoryList`, `Footer`, `ReadAloud` |
| `src/lib/`        | Logic: `constants.js`, `prompts.js`, `storage.js`, `model.js`, `triggers.js`                               |
| `src/App.jsx`     | Flow state machine                                                                                         |

## Accessibility

Large readable text, high contrast, full keyboard navigation, ARIA labels, big tap targets, an
SVG chart with a screen-reader data table, and respect for `prefers-reduced-motion`.

## Testing

```bash
npm test
```

37 unit tests (vitest) cover the safety-critical pure logic and the provider layer:

- **Model parsing** — JSON extraction (clean / prose-wrapped / fenced / garbled), the **fail-safe**
  triage behavior (unparseable → _elevated_, never _none_), and analysis normalisation (bracket
  stripping, capping triggers/coping, dropping malformed items).
- **Provider dispatch** — `triage`/`analyze` route to the right backend (mocked `fetch`) and a
  transport error propagates rather than silently producing support.
- **Storage** — save / load / update / clear, newest-first ordering, and graceful recovery from
  corrupt `localStorage`.
- **Safety constants** — the Tele-MANAS helpline is hardcoded and the model URL stays on `localhost`.

## Development & quality

```bash
npm run dev          # start the dev server
npm test             # run unit tests
npm run lint         # ESLint (flat config: react + hooks)
npm run format       # Prettier (format)
npm run format:check # Prettier (verify)
npm run build        # production build
```

The codebase is JSDoc-documented throughout, ESLint-clean, and Prettier-formatted. Runtime
dependencies are kept to just React; the mood chart is hand-rolled SVG (no chart library).

## License

MIT — see [LICENSE](LICENSE). Built for the PromptWars hackathon.
