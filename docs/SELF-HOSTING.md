# Running OVEREO on your own servers

OVEREO has three parts:

| part | what it is | where it lives |
|---|---|---|
| **Website** | Next.js app (what people see), plus Ask SI, the agents and ECHO, which talk to Xevyo | project root |
| **Backend** | accounts, family profiles, all health data, files, chat history | `backend/` |
| **Database** | PostgreSQL 13+ | any server |

The browser only ever talks to the website. The website forwards `/api/v1/*` to the backend (`next.config.ts`), so there is one address and the login cookie stays first-party.

## Option A: Docker (simplest)

```bash
cp backend/.env.example backend/.env
#   set APP_SECRET (openssl rand -base64 48), ALLOWED_ORIGINS and APP_URL = your https address
export POSTGRES_PASSWORD='a-long-random-password'
export XEVYO_API_KEY='…'            # server-side only; never NEXT_PUBLIC_
docker compose up -d --build
```

The website runs on `127.0.0.1:3000` and the backend on `127.0.0.1:4000`. Database migrations run automatically when the backend starts.

## Option B: without Docker (PM2 or systemd)

```bash
# database
createdb overeo && createuser overeo --pwprompt

# backend
cd backend && npm ci && npm run build
DATABASE_URL=postgres://overeo:…@localhost:5432/overeo APP_SECRET=… ALLOWED_ORIGINS=https://your.site APP_URL=https://your.site \
  node dist/src/server.js            # or: pm2 start dist/src/server.js --name overeo-api

# website
cd .. && npm ci && npm run build
BACKEND_URL=http://127.0.0.1:4000 XEVYO_API_KEY=… node .next/standalone/server.js
#   copy public/ and .next/static/ next to the standalone server (the Dockerfile shows how)
```

Set `BACKEND_URL` when you **build** the website, not only when you run it: the forwarding rule is built in.

## HTTPS in front (nginx example)

```nginx
server {
  server_name your.site;
  listen 443 ssl http2;
  # ssl_certificate … (Let's Encrypt / certbot)
  client_max_body_size 20m;          # lab report uploads
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto https; }
}
```

Keep `COOKIE_SECURE=true`. Login cookies need HTTPS.

## Backups

- Database: `pg_dump -Fc overeo > overeo-$(date +%F).dump` every night, and keep copies on another server.
- Files (lab reports): back up `STORAGE_DIR` (in Docker, the `files` volume).
- Test a restore once: `pg_restore -d overeo_restore overeo-….dump`.

## Moving to another database host

The schema is plain PostgreSQL with no extensions:

```bash
pg_dump -Fc "$OLD_URL" > overeo.dump
pg_restore -d "$NEW_URL" overeo.dump
```

Then change `DATABASE_URL`. For managed hosts, add `?sslmode=require`.

## Email (later)

Until email is connected, confirmation and password-reset emails are written to the backend log. To connect email, implement `sendMail` in `backend/src/lib/mail.ts` (SMTP, SES, Postmark…) and set `EMAIL_TRANSPORT`.

## Health checks

- Backend: `GET /v1/health` returns `{ ok, db, dbMs }`.
- Website: `GET /api/agents/status` reports whether the live brain (Xevyo) is configured.
