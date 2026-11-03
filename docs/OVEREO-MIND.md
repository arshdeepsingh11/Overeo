# OVEREO Mind — the on-device intelligence

OVEREO Mind understands her and answers from her own data. It runs on her device and works without Xevyo. Xevyo (the live brain) is used only where it adds something, and every reply it gives is checked first.

| Part | File | What it does |
|---|---|---|
| Personal model | `src/personal/mind/model.ts` | Builds her baselines (90 days), recent change, trends, how she changes across her cycle, links between her own measures (e.g. sleep → mood, with statistics), labs, medicines and blood pressure. It then writes **insights**: watch-outs, heads-ups for tomorrow, and good news. Each insight carries its evidence and how sure it is. |
| Cycle prediction | `mind/cycle.ts` | Recency-weighted prediction, her own variability window, ovulation and fertile window, and FIGO regularity checks. |
| Understanding | `mind/nlu.ts` | Turns a question into an intent and entities, tolerating typos. It spots emergencies first. It recognises statements she can log in one tap ("bad cramps today", "slept 6 h", "bp 128/84") and things to remember ("I'm vegetarian"). |
| Answers | `mind/answer.ts`, `knowledge.ts` | Grounded answers with **Why this?**, how sure it is, and actions (log, remember, order a test, open a page). The context comes from cited guidance: FIGO, ACC/AHA, AASM, WHO, ASRM, ADA. |
| What-if | `mind/whatif.ts` | Fits her own sleep → mood and sleep → pain relationship, shrunk toward a cautious prior when there is little data. It gives a range and how sure it is. |
| Visit summary | `mind/visit.ts` | One page for her clinician, with questions written from what her data shows. |
| Report reading | `mind/report.ts` | Reads PDFs (pdf.js) and photos (Tesseract) in her browser, then parses tests, values, ranges and the collection date and converts units. The live brain only sees result lines (no name, birth date or IDs), and any value it returns must appear in the text. |
| Live brain | `mind/live.ts`, `/api/si` | Handles open questions, "Explain more", other languages, warmer agent wording and report structuring. Replies are blocked if they contain a dose, a diagnosis, another assistant's name, or an added or dropped number. If Xevyo is slow, at quota or offline, she gets Mind's answer and is told why. |
| Learning from her | `space.ts` (`mind`) | Records which topics she asks about. Two "not helpful" votes on a topic make SI go deeper (live) next time. Agent dismissals, her "never" rules and corrections to "What OVEREO knows" all feed back in. |

Tests: unit tests (parser, guardrails, edge-case users, push crypto against the RFC 8291 test vector) and end-to-end checks of every flow.
