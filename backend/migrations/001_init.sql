-- =====================================================================
-- OVEREO database — v1
-- Plain PostgreSQL (13+). No extensions needed, so it moves to any
-- Postgres host with pg_dump / pg_restore.
--
--   users ─┬─ sessions            who can sign in, and where
--          ├─ profiles ─┬─ records        health data (periods, symptoms, mood, sleep, BP, labs…)
--          │            ├─ items          app state (agents, inbox, diary, reminders, memory, prefs…)
--          │            ├─ files          uploaded reports (bytes on disk / object storage)
--          │            └─ conversations ─ messages   Ask SI + agent chats
--          ├─ email_tokens        verify email / reset password (email comes later)
--          └─ push_subscriptions  notifications
--   audit_log                     who did what, when
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  password_hash   text NOT NULL,
  name            text NOT NULL,
  email_verified_at timestamptz,
  failed_logins   integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_format CHECK (position('@' in email) > 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  user_agent   text,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;

-- one login can hold several people (family profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  relation      text NOT NULL DEFAULT 'self'
                CHECK (relation IN ('self','mother','daughter','sister','partner','grandmother','friend','other')),
  is_primary    boolean NOT NULL DEFAULT false,
  birth_year    integer CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100),
  life_stage    text NOT NULL DEFAULT 'cycling'
                CHECK (life_stage IN ('cycling','trying','pregnant','postpartum','peri','post')),
  goals         text[] NOT NULL DEFAULT '{}',
  typical_cycle integer CHECK (typical_cycle IS NULL OR typical_cycle BETWEEN 15 AND 90),
  hue           integer NOT NULL DEFAULT 330 CHECK (hue BETWEEN 0 AND 359),
  pin_hash      text,
  consent       jsonb NOT NULL DEFAULT '{"personalise": true, "genetics": false, "notifications": false, "research": false}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_user ON profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_primary ON profiles (user_id) WHERE is_primary;

-- health records: the verified personal record contract (src/personal/types.ts)
CREATE TABLE IF NOT EXISTS records (
  profile_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  id             text NOT NULL,
  type           text NOT NULL CHECK (type IN ('period_start','period_end','symptom','mood','sleep_duration','blood_pressure','morning_temperature','lab_result','medication','weight')),
  value          jsonb NOT NULL,
  observed_at    timestamptz NOT NULL,
  source         jsonb NOT NULL DEFAULT '{}',
  confirmation   text NOT NULL DEFAULT 'confirmed' CHECK (confirmation IN ('unconfirmed','confirmed','corrected','rejected')),
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','archived')),
  history        jsonb NOT NULL DEFAULT '[]',
  schema_version integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- updated_at: when she changed it (device clock, decides which edit wins)
  -- synced_at:  when the server stored it (server clock, drives "what's new since…")
  updated_at     timestamptz NOT NULL DEFAULT now(),
  synced_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  PRIMARY KEY (profile_id, id)
);
CREATE INDEX IF NOT EXISTS records_sync ON records (profile_id, synced_at);
CREATE INDEX IF NOT EXISTS records_type_time ON records (profile_id, type, observed_at DESC) WHERE deleted_at IS NULL;

-- everything else the app keeps per profile, one row per item
CREATE TABLE IF NOT EXISTS items (
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  collection  text NOT NULL CHECK (collection IN ('agents','inbox','diary','reminders','memory','prefs','feedback','mind','account','push')),
  id          text NOT NULL,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  synced_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  PRIMARY KEY (profile_id, collection, id)
);
CREATE INDEX IF NOT EXISTS items_sync ON items (profile_id, synced_at);

CREATE TABLE IF NOT EXISTS files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id   text,
  name        text NOT NULL,
  mime        text NOT NULL,
  size        integer NOT NULL CHECK (size >= 0),
  sha256      text NOT NULL,
  storage_key text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS files_profile ON files (profile_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS files_client ON files (profile_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversations (
  id          text NOT NULL,
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'si' CHECK (kind IN ('si','agent','team')),
  title       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              text NOT NULL,
  profile_id      uuid NOT NULL,
  conversation_id text NOT NULL,
  role            text NOT NULL CHECK (role IN ('user','assistant')),
  agent           text,
  text            text NOT NULL,
  meta            jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, id),
  FOREIGN KEY (profile_id, conversation_id) REFERENCES conversations(profile_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS messages_conv ON messages (profile_id, conversation_id, created_at);

CREATE TABLE IF NOT EXISTS email_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('verify','reset')),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  keys        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, endpoint)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid,
  profile_id  uuid,
  action      text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}',
  ip          text,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_user ON audit_log (user_id, at DESC);
