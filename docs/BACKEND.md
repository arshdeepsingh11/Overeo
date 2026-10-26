# OVEREO — backend map

Everything works **on the device** today: offline-first, no server needed. This document maps what a backend must provide so it can be plugged in without changing any screen.

**Where it plugs in:** `src/data/adapters.ts`, which defines the interfaces. `src/data/rest.ts` is a ready REST client for a custom backend, and `src/integrations/shopify.ts` is the client for BioAro's Shopify store.

---

## 1. How the app is layered

```
Screens (src/views/app/*)  ──read──▶  Space store (src/personal/space.ts)
                                         │  writes through
                                         ▼
                    Local storage (src/personal/db.ts)  ── today
                    DataAdapter (src/data/rest.ts)      ── when the backend exists
                                         │
         Agents & patterns (src/personal/agents.ts, patterns.ts)  — deterministic, run on device
         Overeo SI live brain  →  /api/si (server)  →  Xevyo        — key stays on the server
```

Rules that hold in every layer:

1. **Sample and real data never mix.** Each lives in its own namespace (`sample` and `real-<accountId>`). The server must enforce this per account, not just the UI.
2. **Only confirmed, active records enter calculations.** Values read from a report are *unconfirmed* until she confirms them.
3. **Corrections create revisions.** Nothing is overwritten silently, and every record keeps its `history`.
4. **Source ≠ confirmation.** A record from a report keeps `source.origin = "uploaded_document"` even after she corrects it.
5. **The system calculates; SI explains.** Agents' triggers are code. Xevyo only words answers.

## 2. Two backend options

### Option A — custom OVEREO API (recommended for health data)

Set `NEXT_PUBLIC_DATA_BACKEND=rest` and `NEXT_PUBLIC_API_URL=https://api.overeo.com`. Then implement:

| Method | Path | Body / returns | Notes |
|---|---|---|---|
| POST | `/v1/auth/signup` | `{name,email,password?}` → `Session` | Or passkeys / magic link |
| POST | `/v1/auth/signin` | `{email,password?}` → `Session` | |
| POST | `/v1/auth/code` · `/v1/auth/verify` | email one-time code | Optional |
| GET · PATCH · DELETE | `/v1/me` | `Account` | DELETE erases everything (right to erasure) |
| GET | `/v1/me/export` | full JSON export | Right of access / portability |
| GET | `/v1/records?since=` | `HealthRecord[]` | Delta sync |
| POST | `/v1/records:batch` | `{records}` → `{accepted, conflicts}` | Upsert; server keeps revisions |
| GET · PUT | `/v1/reminders` | `Reminder[]` | |
| GET · POST | `/v1/diary?since=` | `DiaryEntry[]` | Append-only audit log |
| GET · PUT | `/v1/agents` | `Record<AgentId, AgentSettings>` | Her training of each agent |
| GET · PUT | `/v1/inbox` | `Suggestion[]` | |
| GET · PUT | `/v1/memory` | `{overrides, told}` | "What OVEREO knows" corrections |
| POST · GET · DELETE | `/v1/files[/:id]` | multipart upload → `{documentId}` | Encrypted at rest |
| POST | `/v1/push/subscribe` | `PushSubscriptionJSON` | Reminders when the app is closed |
| POST | `/v1/si` | same contract as `/api/si` | If SI moves behind the API |

**Data model:** the canonical types are in `src/personal/types.ts`: `HealthRecord`, `Account`, `AgentSettings`, `Suggestion`, `DiaryEntry`, `Reminder`, `MemoryItem`. Use `schemaVersion` and the migration in `db.ts` as the pattern.

**Sync:** the app writes locally first, then pushes an outbox (collection `outbox`, reserved) when online. On a conflict, the server's newest revision wins and both versions stay in history.

**Suggested stack:**
- Postgres with row-level security per account.
- Object storage with server-side encryption for files.
- Background workers for push notifications.
- Region-pinned deployments (Canada / EU / US) so data stays in the user's region.

### Option B — Shopify (commerce only)

BioAro Labs already runs on Shopify (Storefront API 2025-07). Shopify suits **ordering tests**, not health records.

1. Ask BioAro for a **public Storefront access token**.
2. Set `NEXT_PUBLIC_SHOPIFY_DOMAIN` and `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`.
3. `shopify.product(handle)` returns price and variant. `shopify.addToCart(variantId)` returns a Shopify checkout URL.
4. Product handles are already in `src/content/bioaroLabs.ts` (`slug`), so the showcase can show price and an "Order" button.

Health data must **not** go into Shopify customer metafields. Keep it in Option A.

## 3. Overeo SI (Xevyo)

- `POST /api/si` (`src/app/api/si/route.ts`) is a server route. It reads `XEVYO_API_KEY` from the server environment, adds OVEREO's safety rules, her language and a compact pattern summary, and streams plain text back.
- If Xevyo is unavailable (missing key, quota, outage), it returns `503 {fallback:true, reason}`. The app then answers on the device and shows why.
- **On Vercel:** add `XEVYO_API_KEY` (plus optional `XEVYO_PROJECT_ID`) under Project → Settings → Environment Variables. Never prefix it with `NEXT_PUBLIC_`.

## 4. Before real users

| Area | Needed |
|---|---|
| Hosting | Data residency per region; signed data-processing agreements with Vercel and Xevyo |
| Law | Canada: PIPEDA plus provincial health laws (e.g. Alberta HIA). EU: GDPR (health data is a special category). US: HIPAA when working with covered entities |
| Security | Encryption at rest and in transit, audit log (diary), rate limits at the gateway, a penetration test |
| AI | Xevyo zero-retention for health data, confirmed in writing; evaluation set (`scripts/xevyo-probe.mjs`) run before each release |
| Clinical | Clinician review of every agent rule and every translated string |
