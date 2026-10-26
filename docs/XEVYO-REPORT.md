# Xevyo × OVEREO — findings (24 Oct 2026)

Tested with the OVEREO key, from the Xevyo console in the browser, plus a review of the console itself. Rerun the full test any time with `node scripts/xevyo-probe.mjs`; it writes `docs/xevyo-probe-report.md`.

## Confirmed working

| Check | Result |
|---|---|
| API is OpenAI-compatible (`/xevyo/v1/chat/completions`, `/models`) | ✅ |
| Responds; one model `xevyo` | ✅ ~1.3–1.6 s for a short answer (not streamed) |
| Identity: answers as **"Overeo SI"** when given `assistant_name`/`company_name` and a system prompt | ✅ |
| Self-hosted ("Running on your own hardware. Nothing leaves this server.") | ✅ per console |

## Problems to fix (please send to the Xevyo team)

1. **Hidden prompt cost.** A one-line question used **13,243 prompt tokens**, because Xevyo adds a large built-in prompt to every call. With OVEREO's own context on top, each answer costs about 14,000 tokens.
   - *Ask:* an option to turn off the built-in prompt for API keys, or a much shorter one.
2. **Free-plan quota.** The key hit `402 quota_exceeded` after **3 calls** (resets 2026-11-01).
   - *Ask:* move the OVEREO key to a paid or unlimited plan. Show per-key quotas in the console.
3. **Default identity is "NEXUS".** Without our parameters, the key introduces itself as NEXUS by Dr. Anmol Kapoor.
   - *Ask:* confirm that `assistant_name: "Overeo SI"` is now saved on the key, and that it never says "Xevyo" or "NEXUS" to OVEREO users.
4. **Voice limit.** Realtime voice allows **2 concurrent sessions per key**.
   - *Ask:* a production limit, and how browser "voice tickets" work, so the key never reaches a phone.

## Still to test (blocked by the quota)

Run `node scripts/xevyo-probe.mjs` after the quota resets or the plan is upgraded:

| Needed for | Check |
|---|---|
| Agents acting | **Tool calling** (`tools` / `tool_calls`) |
| Report data | Exact **JSON output** (`response_format`) |
| Snap a report | **Reading an image** (synthetic report in `scripts/fixtures/`) |
| Trust | Emergencies → call now · refuses to diagnose · no doses · says "I don't know" |
| Training | Follows her "never" rules |
| Worldwide | Hindi, Punjabi, Spanish, Chinese replies |
| Speed / scale | Streaming first-token time · 6-month history · 10 requests at once |

## Questions only Xevyo can answer

- Does Xevyo **store or log** prompts or replies? For how long? Is anything used for training? (For health data we need zero retention, in writing.)
- **Where** are the servers physically? (Data residency for Canada, the EU and the US.)
- Is there an **embeddings** endpoint, and can Library projects be **per user**?

## How OVEREO uses Xevyo today

- Overeo SI → `/api/si` (our server) → Xevyo, streamed. The key never reaches the browser.
- If Xevyo fails, SI answers on the device and says why (e.g. "usage limit reached").
- Agents decide *when* to act with deterministic code. Xevyo only words answers. If tool calling passes, agents can let SI propose actions in conversation, and she still approves each one.
