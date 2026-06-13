# PromptWars — Mental Wellness Tracker · Build Kit (Claude Code edition)

A private journaling + mood companion that surfaces stress triggers and offers safe, tailored
support for students in high-stakes exams (NEET/JEE/CUET/CAT/GATE/UPSC). Built with **Claude Code**
and scored on the rubric: **Problem Statement Alignment (HIGH), Code Quality (HIGH),
Security (MED), Efficiency (MED), Testing (LOW), Accessibility (LOW).**

> Suggested name: **MindEase** (or ExamCalm / Anchor). Pick one and use it consistently.

---

## THE SCORING MAP (spend effort by weight)

- **Problem Statement Alignment (HIGH):** hit every keyword in the prompt — journaling + mood logs,
  *uncover hidden stress triggers & emotional patterns*, tailored coping, mindfulness, motivation,
  empathetic companion. The crisis-safety routing lands here too.
- **Code Quality (HIGH):** modular components, clear names, comments, a real README. Claude Code
  is strong here — use plan mode + a CLAUDE.md so the codebase stays consistent (see below).
- **Security (MED):** privacy-first. Process on-device, store entries only in the browser
  (localStorage), no accounts, no PII, no third-party data leakage. Say it in the README + footer.
- **Efficiency (MED):** lean, fast, minimal dependencies.
- **Testing (LOW):** a few unit tests on the parsing / trigger-tagging / crisis-keyword logic.
- **Accessibility (LOW):** large text, high contrast, keyboard nav, ARIA labels, reduced-motion.

---

## SAFETY MODEL (read first — this is the spine of the product)

This serves students under severe stress. Non-negotiable rules:
1. The app is a **companion for everyday stress, NOT a therapist or crisis service.** Show this.
2. **Crisis routing:** every entry runs a safety check FIRST. If it signals self-harm or
   crisis-level distress, show the helpline prominently and urge reaching a trusted person — and do
   NOT generate coping "advice" or try to counsel.
3. **Helpline to display (India):** **Tele-MANAS — 14416** (also 1-800-891-4416), free & 24/7,
   Government of India. Hardcode it; never let the model invent a number.
4. Support content is **general, evidence-based, and curated** (breathing, breaks, sleep, grounding,
   reframing) — the model personalizes from safe options, it does not make medical claims.

---

## ARCHITECTURE

```
React (Vite) web app  →  GenAI calls  →  localStorage only
```
- **Recommended (best Security score):** run Gemma locally via Ollama at
  `http://localhost:11434/api/chat`, `"format":"json"`. Data never leaves the device.
- **Alternative:** Gemini API for richer language — if used, store nothing server-side and say so.
  (On-device is the stronger rubric play since Security is scored.)
- Two model passes per entry: **(1) Safety triage → (2) Analysis + support.** Triage runs first.
- Persist entries in `localStorage`. No backend, no login.

---

## WORKING WITH CLAUDE CODE (the tooling differences)

Claude Code is a terminal agent — there's no built-in browser tester. Adapt like this:
- **Plan first:** start in **plan mode** so it proposes structure before writing code. Approve the
  plan, then let it build. This directly protects your HIGH Code Quality score.
- **CLAUDE.md:** have it write a `CLAUDE.md` capturing conventions (component structure, naming, the
  privacy rule, the safety rule) so the codebase stays consistent across the session.
- **Testing loop:** Claude Code can't click your UI. Have it **run the dev server**; you test in your
  own browser and paste back errors or screenshots for it to fix.
- **Git:** Claude Code manages git — use it for the single-branch, sub-10MB, public-repo submission.
- **Stay surgical:** review diffs as they come; ask it to refactor anything messy. Clean code = points.

---

## 1. KICKOFF MESSAGE (paste to Claude Code first)

```
We're building a hackathon project. First, read this spec and propose a plan and file structure
BEFORE writing code. Then create a CLAUDE.md capturing our conventions (component structure,
naming, the privacy rule, the safety rule) so the codebase stays consistent.

PROJECT: "MindEase" — a private journaling + mood companion that helps students manage stress
during high-stakes exams. React + Vite. Runs locally. No login, no backend, no cloud DB. Journal
entries stored ONLY in localStorage. AI calls go to a local model at
http://localhost:11434/api/chat (model "MODEL_TAG", "format":"json"). State the on-device privacy
guarantee in the UI footer and README.

DESIGN: calm, low-stimulation, large readable text, high contrast, big tap targets, full keyboard
nav, ARIA labels, prefers-reduced-motion. Accessible by default.

ALWAYS-VISIBLE FOOTER: "MindEase supports everyday stress. It is not a substitute for professional
care. In distress? Call Tele-MANAS 14416 (free, 24/7)."

FLOW (build in this order):
1. Check-in: 1-5 mood selector + free-text journal + "Reflect" button. Persist to localStorage.
2. SAFETY TRIAGE FIRST: send the entry to the model with a safety-triage system prompt (I'll paste
   it) and parse JSON {risk, reason}. If risk is "elevated" or "crisis", show ONLY a calm support
   card: a brief caring message, a tap-to-call Tele-MANAS link (tel:14416), and a nudge to reach a
   trusted person. Stop — no coping content in that case.
3. Analysis + support (only if risk = "none"): send to the model with an analysis system prompt
   (I'll paste it), parse JSON, show an empathetic reflection, detected trigger tags, 1-2 coping
   techniques, and one encouragement line.
4. Dashboard: mood-over-time line chart from stored entries + a "recurring triggers" list with
   counts.

ALSO: history list of past entries; a "read aloud" button using the browser SpeechSynthesis API.

CODE QUALITY: clear components (CheckIn, SafetyCard, SupportCard, Dashboard, HistoryList) + a small
lib/ for model calls and trigger helpers; JSDoc comments; a README covering features, the
on-device privacy design, and the safety model. Minimal dependencies. Add a .gitignore that
excludes node_modules.

TESTING: unit tests for the model-response parsing and the trigger-tagging helper.

When the core is built, run the dev server so I can test in my browser, and set up a git repo with
a single branch ready to push to a public GitHub remote.
```

> Paste prompts #2 and #3 below when Claude Code reaches the AI-call step.

---

## 2. SAFETY TRIAGE SYSTEM PROMPT (Call 1 — runs first)

```
You are a safety classifier for a student wellness journaling app. Read the journal entry and
assess crisis risk. You do NOT counsel, advise, or reply to the user. You ONLY classify.

Return ONLY this JSON, nothing else:
{
  "risk": "none" | "elevated" | "crisis",
  "reason": "<one short neutral phrase>"
}

GUIDANCE:
- "crisis": any indication of suicidal thoughts, self-harm, wanting to disappear, hopelessness
  about living, or plans to hurt oneself.
- "elevated": severe distress, panic, expressions of being unable to cope, but no self-harm signal.
- "none": ordinary stress, frustration, tiredness, exam worry.
- When unsure between two levels, choose the HIGHER risk. Safety first.
- Do not quote or repeat any harmful details. Output valid JSON only.
```

---

## 3. ANALYSIS + SUPPORT SYSTEM PROMPT (Call 2 — only when risk = none)

```
You are a warm, supportive wellness companion for students preparing for major exams. You help
with everyday stress. You are NOT a therapist and you NEVER diagnose or give medical advice.
You receive a mood rating (1-5) and a journal entry.

Return ONLY this JSON, nothing else:
{
  "reflection": "<2-3 warm, validating sentences that reflect what the student is feeling, without judgment>",
  "triggers": ["<short tags for likely stressors, e.g. 'sleep', 'comparison', 'time pressure', 'self-doubt'>"],
  "coping": [
    { "title": "<technique name>", "how": "<one simple, concrete sentence>" }
  ],
  "encouragement": "<one short, genuine, non-cheesy motivational line>"
}

RULES:
- reflection: empathetic and specific; never minimize feelings; no toxic positivity.
- triggers: only what the text supports; 1-4 tags; lowercase short phrases.
- coping: choose 1-2 from safe, evidence-based options only — slow breathing, short timed study
  breaks, brief walks, sleep routine, grounding (5-4-3-2-1), writing worries down, talking to
  someone. One concrete sentence each. No medical/clinical claims, no supplements, no diagnoses.
- encouragement: warm and realistic, never dismissive of the difficulty.
- Do not give advice for severe crises (handled elsewhere). Output valid JSON only.
```

---

## 4. BUILD ORDER (and the bonus-window plan)

1. **Check-in UI + localStorage** — the skeleton.
2. **Safety triage call + crisis card** — build this BEFORE the support feature. It's the spine.
3. **Analysis + support call + cards** — the core experience.
4. **Dashboard** (mood chart + recurring triggers) — your demo artifact.
5. README + a couple of unit tests + accessibility polish.
6. Read-aloud (cheap, nice).

**Bonus window:** have steps 1-3 working and pushed BEFORE 12:30 PM, then submit inside
12:30-1:00 for the guaranteed +2. Use a later attempt for the dashboard/polish version.

---

## 5. SUBMISSION CHECKLIST

- [ ] Public GitHub repo, **single branch**, **under 10 MB** (`.gitignore` excludes node_modules).
- [ ] Clear README: what it does, on-device/privacy design, the safety model + Tele-MANAS routing.
- [ ] Have Claude Code commit + push to the public remote → copy the repo link.
- [ ] Submit the link on the H2S PromptWars portal (Submissions tab).
- [ ] Confirm your real attempt count on the portal (guide says 3, portal showed 6); keep one in reserve.

---

## 6. PITCH BEATS (for when you present)

1. **A student:** "A NEET aspirant, three months out, sleeping four hours, sure everyone's ahead of
   them. Standard mood trackers just ask 'rate your day 1-5' and miss all of it."
2. **The gap:** journaling holds the real signal, but it's private — students won't pour their fears
   into something that ships their mental health to a server.
3. **Demo:** write a real entry → watch it surface the hidden triggers and offer a grounded coping
   step → show the dashboard spotting a pattern over the week. All on-device.
4. **The safety beat (say it with pride):** "We drew a hard line — if someone's in real crisis, we
   don't play therapist. We route them to Tele-MANAS, the government's helpline, fast."
5. **Close:** "MindEase finds the stress students can't name, helps with the everyday, and knows
   when to hand off to a human. Private, by design."
```

---
**The formula that wins regardless:** align tightly to the prompt, keep the code clean, make
privacy real, and make the crisis routing bulletproof.
