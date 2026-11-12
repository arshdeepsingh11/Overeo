# The OVEREO agent team

Named agents, each with its own look, job, knowledge and limits. This is adapted from the "Intelligence Network" pattern (guard → retrieval → prompt → model → validator, plus a verified team run) for women's health.

## The team

| Agent | Title | Looks like | Covers | Never does |
|---|---|---|---|---|
| **LUNA** | Cycle guide | moon | periods, phases, regularity, period pain, PCOS/endometriosis basics | contraception, pregnancy diagnosis, medicines |
| **VERA** | Lab interpreter | flask | what tests measure, her results/ranges/trends, cycle-day timing, useful tests, BioAro tests | diagnosis, doses, prices |
| **SAGE** | Care navigator | leaf | visit prep, questions to ask, which specialist, heart/gut/skin/bone guides | booking, choosing a doctor, diagnosis |
| **PIP** | Reminder keeper | bird | reminders, timing, notifications, habits | medical advice |
| **IRIS** | Medicine companion | hexagon | what she logged, questions for the pharmacist, pharmacogenomics in general | doses, start/stop/switch, interaction verdicts |
| **NOOR** | Mood & sleep companion | star | mood/sleep patterns, cycle effects, PMS/PMDD basics, what-ifs | therapy, crisis counselling (gives emergency help first) |
| **BLOOM** | Fertility planner | flower | fertile window, AMH/FSH, egg freezing, trying to conceive | success rates, promises, clinic choice |
| **MAEVE** | Menopause coach | wave | perimenopause/menopause, hot flashes, bone and heart in midlife | prescribing HRT, doses |
| **ORA** | Verifier (team runs only) | shield | checks every claim and figure | answering directly |
| **Overeo SI** | Presenter (team runs only) | orb | one clear final answer from verified notes | adding anything unverified |

The eight specialists use the same ids as her personal agents, so the agent that sends an Inbox suggestion is the one she can chat with.

## Code

| File | Role |
|---|---|
| `src/agents/team.ts` | Registry (name, title, role, personality, does/doesNot, briefing, routing keys, knowledge tags, look, starters), `SHARED_LIMITS`, `SITE_MAP` whitelist |
| `src/agents/corpus.ts` | Knowledge base built from OVEREO's own content: specialty guides, test navigator, BioAro Labs tests, stream explanations, lab/symptom guides, how OVEREO works, privacy, emergency signs. 228 short passages. Prices are excluded on purpose. |
| `src/agents/retrieval.ts` | BM25 with everyday-word expansion ("tired" → fatigue, ferritin, thyroid…). Her facts are added per question and ranked first. |
| `src/agents/guard.ts` | Runs before any model call, with no model: emergency, injection, dose, diagnosis, commitment (price/booking/guarantee), other people's data, harmful, off-topic. Each gives a kind reply. |
| `src/agents/validate.ts` | Every figure must exist in the context or her question. Doses, diagnoses and other-assistant names are blocked. ORA removes unsupported sentences. |
| `src/agents/engine.ts` | Shared by server and device: `prepare` (guard → retrieve → sources → whitelisted actions → hand-off), `plan`, `systemPrompt`, `compose` (no-model answer) |
| `src/agents/client.ts` | `talk()`: guard on the device first → OVEREO Mind for her own data ("device") → live → demo/fallback. `runTeam()` streams NDJSON and finishes on the device if the server can't. |
| `src/server/xevyo.ts` | Provider interface (Xevyo, OpenAI-compatible), rate limit |
| `src/app/api/agents/{chat,network,status}` | API routes (key server-only) |
| `src/views/app/team/*` | `Character` (SVG characters with idle/listening/thinking/speaking/done/waiting states), `AgentConsole`, `TeamScreen` (`/app/team`) |

## Modes shown to her
- **From your data · on your device** — OVEREO Mind answered from her records.
- **Live brain (Xevyo) · checked** — answered by Xevyo from the passages, then validated.
- **Demo / On this device** — no live brain; the answer is composed from OVEREO's passages.
- **Kept within OVEREO's rules** — the guard answered.

**Figure check:** a sentence with a number OVEREO can't back up is removed, and she's told which figure.

## Team run (`/app/team`)
1. Plan picks up to 3 specialists by keywords.
2. The specialists work in parallel, each with its own slice of knowledge.
3. ORA verifies every note (in code).
4. Overeo SI presents from the verified notes only.
5. The final answer is checked again.

Her view shows notes only after ORA's check. If a specialist's live call fails, the run stops on the server, says so, and the same plan finishes on the device, labelled.

## Adding or changing an agent
1. Edit `team.ts`: keep one clear job; fill does/doesNot, briefing, keys and tags.
2. If it's a new area, add passages in `corpus.ts`.
3. Add guard rules if the area has new "never" cases.
4. Add a shape in `Character.tsx` if it needs a new look.

## Tested
- Unit, 45/45: retrieval, guard (incl. false-positive checks), planner, hand-off, validator, ORA.
- End-to-end, 28/28: names and looks, chat, device answers, live answers with sources, guard, injection, emergency, hand-off, figure removal, unsafe live answer replaced, team run live and on quota, phone layout.
- Live calls were tested against a Xevyo mock; confirm against the real Xevyo once.
