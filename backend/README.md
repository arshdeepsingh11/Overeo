# OVEREO backend

Accounts, family profiles, health records, app state, files and chat history, stored in **PostgreSQL**.

- **Plain PostgreSQL 13+**, no extensions. To move it to another host (your own server, Supabase, Neon, RDS, Cloud SQL), dump and restore. Nothing in the code changes.
- **Node 20+**, two runtime packages (`pg`, `zod`) and no web framework. If `pg` isn't installed, the built-in Postgres client in `src/db/pgwire.ts` is used instead.
- **Offline-first sync.** The phone works without a network and sends changes later. The newest edit wins.

## Run it

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, APP_SECRET, ALLOWED_ORIGINS, APP_URL
npm install
npm run build
npm start                   # applies database migrations on start (AUTO_MIGRATE=true)
curl localhost:4000/v1/health
```

For development, run `npm run dev`. Tests use a real database: `TEST_DATABASE_URL=postgres://… npm test`. The tests wipe that database.

To run the whole stack with Docker (database, backend and website), use `docker compose up -d --build` from the project root. See `docs/SELF-HOSTING.md`.

The website reaches the backend through `/api/v1/*`. Next.js forwards these requests to `BACKEND_URL`, so cookies stay first-party.

## Database

| table | what it holds |
|---|---|
| `users` | login: email, scrypt password hash, lockout counter |
| `sessions` | signed-in devices (only a SHA-256 of each token is stored) |
| `profiles` | family profiles under one login: name, relation, life stage, goals, optional PIN (scrypt), consent |
| `records` | health records: period, symptom, mood, sleep, blood pressure, temperature, lab result, medication, weight |
| `items` | app state per profile: agents, inbox, diary, reminders, memory, prefs, feedback, mind |
| `files` | uploaded reports (metadata; the bytes are in `STORAGE_DIR`) |
| `conversations`, `messages` | Ask SI and agent chats |
| `email_tokens` | email verification and password reset links |
| `push_subscriptions` | notifications |
| `audit_log` | sign-ups, logins, failed logins, profile changes, exports, deletions |

Migrations live in `migrations/NNN_name.sql`. Each one is applied once, in order, inside a transaction. To change the schema, add a new file. Never edit a migration that has already been applied.

## API (all JSON, under `/v1`)

| | |
|---|---|
| `POST /auth/signup` `{name,email,password}` | creates the account and her own profile, then signs her in |
| `POST /auth/login` `{email,password}` · `POST /auth/logout` · `GET /auth/me` · `PATCH /auth/me` | |
| `POST /auth/password` `{current,next}` | also signs out her other devices |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` | where she is signed in |
| `POST /auth/forgot` `{email}` · `POST /auth/reset` `{token,password}` · `POST /auth/verify` `{token}` | email links |
| `DELETE /account` `{password}` | deletes everything she owns, including files |
| `GET /profiles` · `POST /profiles` · `PATCH /profiles/:id` · `DELETE /profiles/:id` `{password}` | family profiles (up to `MAX_PROFILES`) |
| `POST /profiles/:id/unlock` `{pin}` → `{key}` | send the key as `X-Profile-Key` for PIN-locked profiles |
| `GET /profiles/:id/sync?since=` · `POST /profiles/:id/sync` `{records,items}` | sync |
| `POST /profiles/:id/files` (raw body) · `GET /profiles/:id/files[/:fid]` · `DELETE …/:fid` | PDF and photos only; the bytes are checked against the stated type |
| `POST /profiles/:id/messages` · `GET /profiles/:id/conversations[/:cid]` | chat history |
| `GET /profiles/:id/export` | everything for one profile, as JSON |
| `GET /health` | |

Errors always have the shape `{ "error": { "code", "message", "fields"? } }`, with a plain-language `message` the app can show as it is.

## Security

- Passwords and PINs are hashed with scrypt (N=2¹⁷). Login attempts are rate-limited, and an account locks for 15 minutes after 10 wrong passwords.
- Sessions use an HttpOnly, SameSite=Lax, Secure cookie, or a `Bearer` token for apps. Only the token's hash is stored.
- Requests that change data must come from `ALLOWED_ORIGINS` (CSRF protection). CORS allows only those origins.
- Every query is parameterised. Every input is validated (zod). Request bodies are size-limited. Security headers are sent on every response.
- Each profile's data can only be reached through its owner's session. A PIN-locked profile also needs a fresh unlock key.
- Logs never contain request bodies, health data or full email addresses.

## Email (later)

Until email is connected, `EMAIL_TRANSPORT=console` writes the confirm-email and reset-password messages to the log. To connect email, implement `sendMail` in `src/lib/mail.ts` for your provider. Nothing else changes.
