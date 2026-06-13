# MindEase — Design (2026-06-13)

A private journaling + mood companion that helps students manage stress during high-stakes exams
(NEET/JEE/CUET/CAT/GATE/UPSC). Surfaces hidden stress triggers, offers safe tailored coping, and
routes crisis cases to a human helpline. Fully on-device.

## Decisions

- **AI backend:** Ollama, local only. Model tag in one config constant (`MODEL_TAG`, default
  `gemma3:4b`). No cloud fallback — graceful inline error if Ollama is unreachable; the entry is
  still saved.
- **Sequencing:** MVP first (check-in → safety triage + crisis card → analysis + support), push,
  then dashboard / tests / a11y / read-aloud.
- **Charting:** hand-rolled SVG, zero dependencies.

## Architecture

```
CheckIn (mood 1–5 + journal)
   → storage.save() to localStorage immediately
   → model.triage()  PASS 1  → {risk, reason}
        risk ∈ {elevated, crisis} → SafetyCard ONLY (Tele-MANAS 14416). STOP. No coping advice.
        risk = none               → model.analyze() PASS 2 → {reflection, triggers[], coping[], encouragement}
                                     → SupportCard
Dashboard ← storage.all() → MoodChart (SVG) + recurring-trigger counts (triggers.aggregate)
HistoryList ← storage.all() → past entries, read-aloud via SpeechSynthesis
Footer (always visible) → disclaimer + helpline
```

## Files

- `src/lib/constants.js` — `MODEL_TAG`, `OLLAMA_URL`, `TELE_MANAS` helpline constants.
- `src/lib/prompts.js` — the two hardcoded system prompts (triage, analysis).
- `src/lib/storage.js` — localStorage CRUD for entries.
- `src/lib/model.js` — Ollama calls, robust JSON extraction/validation, fail-safe triage.
- `src/lib/triggers.js` — aggregate + count trigger tags across entries.
- `src/components/` — `CheckIn`, `SafetyCard`, `SupportCard`, `Dashboard`, `MoodChart`,
  `HistoryList`, `Footer`.
- `src/App.jsx` — view/flow state machine.
- `src/main.jsx`, `src/styles.css`.
- Tests: `src/lib/*.test.js` (model parse, triggers, fail-safe).

## Safety model

1. Triage always first. 2. Crisis/elevated → SafetyCard only, no advice. 3. Helpline hardcoded,
never model-generated. 4. Parse/validation failure on triage → treat as `elevated`. 5. No
diagnoses or medical claims; coping is curated evidence-based options.

## Data shapes

- Entry: `{ id, ts, mood (1-5), text, risk, analysis|null }`
- Triage result: `{ risk: 'none'|'elevated'|'crisis', reason: string }`
- Analysis: `{ reflection, triggers: string[], coping: {title, how}[], encouragement }`

## Accessibility

Large readable text, high contrast, full keyboard nav, ARIA labels, `prefers-reduced-motion`,
big tap targets.

## Testing

vitest unit tests on pure logic: JSON extraction (clean / prose-wrapped / garbled), trigger
aggregation + counts, and triage fail-safe (unparseable → elevated).
