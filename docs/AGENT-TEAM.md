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

## v3 — live switching, 3D characters, ECHO, Xevyo education

### Who answers (live switching)
- `pickAgent(q, intent)` in `src/agents/client.ts` chooses the agent whose job a question is: first from what OVEREO Mind understood (the `OWNS` map), then from the words (`scoreAgents`). "Remind me…" always goes to PIP. Emergencies never get handed over.
- **Ask SI (in her space):** every answer shows the agent who answered (`.si-agent`, avatar + name). When the live brain is used, the agent's name, job and briefing are sent as `persona` to `/api/si` and added to the system prompt.
- **Agent chat:** `routeTo(q, current)` switches to the right teammate when a question is clearly someone else's job, with a visible note ("MAEVE took this — menopause coach is MAEVE's job"). Follow-ups such as "why?" stay with the current agent. Each answer is labelled with who answered.

### Works on its own, uses Xevyo only to help
Order for every question: guard (on the device) → OVEREO Mind with her data (on the device) → live brain (Xevyo) with only the passages and facts chosen → if Xevyo is off, slow (15 s) or fails a check, the answer is built from OVEREO's own passages on the device and labelled. Nothing depends on Xevyo being up.

### Educating Xevyo
Xevyo has no training API, so OVEREO educates it two ways:
1. **Per question:** the agent's briefing, the shared rules and the most relevant OVEREO passages (and her facts, if she allows) are sent with each request.
2. **Knowledge pack:** `GET /api/agents/knowledge` returns everything the agents know as one Markdown file (team, rules, all passages with sources; no user data, no prices). A copy is in `docs/XEVYO-KNOWLEDGE.md`. Load it into Xevyo's knowledge base/project (`XEVYO_PROJECT_ID`) if Xevyo offers one.
She controls sharing with **Me → "Let my agents use my data"** (off = general answers only).

### 3D characters
`src/views/app/team/stage3d.ts` renders all characters with one shared WebGL context (three.js), copies each frame into a small canvas per character, pauses characters that are off screen, runs at ~30 fps, and shows a still pose with reduced motion. `Avatar.tsx` shows the SVG character first and swaps to 3D when WebGL is ready (falls back to SVG when it isn't).

### ECHO — translator (`src/translate/`)
- Turn on from **Why OVEREO**, **Agents** or **Me**. A button appears bottom-left on every page.
- **Whole page:** translates every visible text, placeholders, labels and alt text, visible part first; keeps translating new content; "Show the original" restores every word exactly.
- **Any word or sentence:** select it → Translate → card with Listen and Copy.
- Engine order: device cache → the browser's own on-device translator (only when the language is already installed; a download is started quietly for next time) → `/api/translate` (Xevyo, JSON, batches ≤ 80 strings).
- Safety: a translation that changes, adds or drops any number is refused (checked on the server and on the device) and that text stays in English. Names (OVEREO, LUNA…) are never translated. ECHO never translates its own controls or what she types.
- 28 languages, incl. Hindi, Punjabi, Urdu, Arabic, Chinese, Tagalog, Vietnamese.

### Why OVEREO (`/why`)
Replaces "Explore your hub" on Home. Plain-language page: what OVEREO is and isn't, 12 checked research facts with sources (`src/content/research-facts.ts`), three steps, the whole team with 3D characters, how to turn agents and ECHO on, privacy, FAQ, emergency note. Linked from the portal menu and the phone menu.

## v4 — instant answers, visible hand-overs, living-light characters

- **Instant answers.** A question gets an answer straight away from her data (OVEREO Mind), the agent's own checked guides, or OVEREO's content. In the meantime the live brain (Xevyo) writes a fuller answer, which replaces the instant one when it's ready ("Updated with more detail ✓"). If Xevyo is slow or down, the instant answer stays, labelled. Before this, open questions waited for Xevyo, which is why answers felt slow on the live site.
- **Hand-overs you can see.** In Ask SI, the agent who'll answer appears as soon as the question is sent ("MAEVE · Looking at your data…"). When the job moves to another agent, a banner says "MAEVE takes this — menopause coach is MAEVE's job". In agent chat, the new agent takes over with a highlighted note, and every answer is labelled with who gave it.
- **Living-light characters** (`stage3d.ts`): custom shaders for a liquid core, a glowing nucleus carrying the agent's symbol, orbiting rings, light particles and an aura. Each agent is a different "species", and each state moves differently. The light SVG version (`Character.tsx`) has the same design.
- **Performance.** One WebGL context for every character. WebGL support is checked once (before this, each character created its own test context, which froze the page for seconds on weaker devices). A one-time speed probe and a governor switch slow devices to the light versions. Characters behind open dialogs, off-screen or in hidden tabs don't render. **Me → Lighter animations** turns 3D off.
- **Chats are saved** to her account (`POST /v1/profiles/:id/messages`) when she's signed in.
