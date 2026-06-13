# CLAUDE.md — MindEase conventions

MindEase is a private journaling + mood companion that helps students manage stress during
high-stakes exams. Keep the codebase consistent with the rules below.

## Product rules (non-negotiable)

1. **Privacy is on-device.** Journal entries live ONLY in `localStorage`. No backend, no accounts,
   no cloud DB, no analytics, no third-party calls. AI runs on a _local_ Ollama instance
   (`http://localhost:11434/api/chat`). Data never leaves the machine. State this in UI + README.
2. **Safety triage runs FIRST.** Every entry is classified for crisis risk before any support is
   generated. If risk is `elevated` or `crisis`, show ONLY the SafetyCard (helpline + trusted-person
   nudge). Never generate coping advice in that path.
3. **The helpline is hardcoded.** Tele-MANAS **14416** (also 1-800-891-4416). Never let the model
   produce or alter a helpline number. It lives in `src/lib/constants.js`.
4. **Fail safe.** If the triage response can't be parsed/validated, treat risk as `elevated`
   (never `none`). Safety beats convenience.
5. **The companion is not a therapist.** No diagnoses, no medical claims. Coping content is curated,
   general, evidence-based.

## Code conventions

- React + Vite, JavaScript with **JSDoc** comments on every exported function/component.
- Components in `src/components/`, one component per file, PascalCase. Pure presentational where
  possible; side effects (storage, model calls) live in `src/lib/`.
- Logic in `src/lib/`: `constants.js`, `prompts.js`, `storage.js`, `model.js`, `triggers.js`.
- Clear names, small focused files. No dependency added without a reason (Efficiency is scored).
- Accessibility by default: semantic HTML, ARIA labels, keyboard nav, large text, high contrast,
  honor `prefers-reduced-motion`.

## Testing

- Unit tests (vitest) for pure logic: model JSON parsing, trigger aggregation, fail-safe behavior.
- Run with `npm test`.
