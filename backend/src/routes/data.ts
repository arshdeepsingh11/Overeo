/* =====================================================================
   Her data: sync (records + app state), files, conversations, export.

   Sync is offline-first. The phone keeps working without a network and
   sends changes when it can:
     POST /v1/profiles/:id/sync   { records: [...], items: [...] }
     GET  /v1/profiles/:id/sync?since=<cursor>
   The newest edit wins (by the device's updatedAt). The cursor is the
   server's own clock (synced_at), so no change is ever missed even when
   a phone's clock is wrong.
   ===================================================================== */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { db, tx } from "../db/db.js";
import { HttpError, body, limit, readBody, type Router } from "../http/kit.js";
import { audit } from "../auth/session.js";
import { profileAccess, profileOut } from "./profiles.js";

const TYPES = ["period_start", "period_end", "symptom", "mood", "sleep_duration", "blood_pressure", "morning_temperature", "lab_result", "medication", "weight"] as const;
const COLLECTIONS = ["agents", "inbox", "diary", "reminders", "memory", "prefs", "feedback", "mind", "account", "push"] as const;

const iso = z.string().datetime({ offset: true });
const id = z.string().min(1).max(100);
const recordIn = z.object({
  id,
  type: z.enum(TYPES),
  value: z.record(z.unknown()),
  observedAt: iso,
  createdAt: iso.optional(),
  updatedAt: iso,
  source: z.record(z.unknown()).default({}),
  confirmationStatus: z.enum(["unconfirmed", "confirmed", "corrected", "rejected"]).default("confirmed"),
  status: z.enum(["active", "superseded", "archived"]).default("active"),
  history: z.array(z.unknown()).max(200).default([]),
  schemaVersion: z.number().int().min(1).max(100).default(1),
  deleted: z.boolean().optional(),
});
const itemIn = z.object({
  collection: z.enum(COLLECTIONS),
  id,
  data: z.unknown(),
  updatedAt: iso,
  deleted: z.boolean().optional(),
});

type RecRow = { id: string; type: string; value: unknown; observed_at: Date; source: unknown; confirmation: string; status: string; history: unknown; schema_version: number; created_at: Date; updated_at: Date; synced_at: Date; deleted_at: Date | null };
type ItemRow = { collection: string; id: string; data: unknown; updated_at: Date; synced_at: Date; deleted_at: Date | null };

const recordOut = (r: RecRow) => ({
  id: r.id,
  type: r.type,
  value: r.value,
  observedAt: r.observed_at,
  source: r.source,
  confirmationStatus: r.confirmation,
  status: r.status,
  history: r.history,
  schemaVersion: r.schema_version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deleted: !!r.deleted_at,
});
const itemOut = (r: ItemRow) => ({ collection: r.collection, id: r.id, data: r.data, updatedAt: r.updated_at, deleted: !!r.deleted_at });

/** jsonb parameters are always sent as JSON text (arrays would otherwise become Postgres arrays) */
const J = (v: unknown) => JSON.stringify(v ?? null);

/** A device clock far in the future must not win every future edit. */
const clamp = (t: string) => new Date(Math.min(new Date(t).getTime(), Date.now() + 5 * 60_000));

const MIME: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

export function dataRoutes(r: Router) {
  /* ------------------------------- sync ------------------------------- */
  r.get("/v1/profiles/:id/sync", async (c) => {
    const p = await profileAccess(c, c.params.id);
    const since = c.url.searchParams.get("since");
    const from = since && !isNaN(Date.parse(since)) ? new Date(since) : new Date(0);
    // read the cursor first, so anything written during this read is picked up next time
    const now = (await db().query<{ now: Date }>("SELECT now() AS now")).rows[0].now;
    const [recs, items] = await Promise.all([
      db().query<RecRow>("SELECT * FROM records WHERE profile_id = $1 AND synced_at > $2 AND synced_at <= $3 ORDER BY synced_at LIMIT 20000", [p.id, from, now]),
      db().query<ItemRow>("SELECT * FROM items WHERE profile_id = $1 AND synced_at > $2 AND synced_at <= $3 ORDER BY synced_at LIMIT 20000", [p.id, from, now]),
    ]);
    return { cursor: now, profile: profileOut(p), records: recs.rows.map(recordOut), items: items.rows.map(itemOut) };
  });

  r.post("/v1/profiles/:id/sync", async (c) => {
    const p = await profileAccess(c, c.params.id);
    limit(`sync:${p.id}`, 120, 60);
    const b = await body(c, z.object({ records: z.array(recordIn).max(5000).default([]), items: z.array(itemIn).max(5000).default([]) }), 8_000_000);
    let records = 0;
    let items = 0;
    await tx(async (q) => {
      for (const x of b.records) {
        if (x.deleted) {
          // deleting keeps what was stored (only marks it), and only if this delete is newer
          const res = await q("UPDATE records SET deleted_at = COALESCE(deleted_at, now()), updated_at = $3, synced_at = now() WHERE profile_id = $1 AND id = $2 AND updated_at <= $3", [p.id, x.id, clamp(x.updatedAt)]);
          records += res.rowCount;
          continue;
        }
        const res = await q(
          `INSERT INTO records (profile_id, id, type, value, observed_at, source, confirmation, status, history, schema_version, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, now()),$12)
           ON CONFLICT (profile_id, id) DO UPDATE SET
             type = EXCLUDED.type, value = EXCLUDED.value, observed_at = EXCLUDED.observed_at, source = EXCLUDED.source,
             confirmation = EXCLUDED.confirmation, status = EXCLUDED.status, history = EXCLUDED.history,
             schema_version = EXCLUDED.schema_version, updated_at = EXCLUDED.updated_at,
             deleted_at = NULL, synced_at = now()
           WHERE records.updated_at <= EXCLUDED.updated_at`,
          [p.id, x.id, x.type, J(x.value), x.observedAt, J(x.source), x.confirmationStatus, x.status, J(x.history), x.schemaVersion, x.createdAt ?? null, clamp(x.updatedAt)],
        );
        records += res.rowCount;
      }
      for (const x of b.items) {
        const res = await q(
          `INSERT INTO items (profile_id, collection, id, data, updated_at, deleted_at)
           VALUES ($1,$2,$3,$4,$5, CASE WHEN $6 THEN now() END)
           ON CONFLICT (profile_id, collection, id) DO UPDATE SET
             data = EXCLUDED.data, updated_at = EXCLUDED.updated_at,
             deleted_at = CASE WHEN $6 THEN COALESCE(items.deleted_at, now()) ELSE NULL END,
             synced_at = now()
           WHERE items.updated_at <= EXCLUDED.updated_at`,
          [p.id, x.collection, x.id, J(x.data ?? null), clamp(x.updatedAt), !!x.deleted],
        );
        items += res.rowCount;
      }
    });
    return { accepted: { records, items }, ignored: { records: b.records.length - records, items: b.items.length - items } };
  });

  /* ------------------------------- files ------------------------------- */
  r.post("/v1/profiles/:id/files", async (c) => {
    const p = await profileAccess(c, c.params.id);
    limit(`upload:${p.id}`, 30, 3600);
    const mime = String(c.req.headers["content-type"] ?? "").split(";")[0].trim();
    if (!MIME[mime]) throw new HttpError(415, "file_type", "Please upload a PDF or a photo (JPG, PNG, WEBP, HEIC).");
    const name = decodeURIComponent(String(c.req.headers["x-file-name"] ?? "report")).replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 120) || "report";
    const clientId = String(c.req.headers["x-client-id"] ?? "").slice(0, 100) || null;
    const data = await readBody(c.req, config.maxFileMb * 1024 * 1024);
    if (!data.length) throw new HttpError(400, "empty_file", "That file is empty.");
    // check the bytes really are what the type says
    const head = data.subarray(0, 12);
    const real = head.subarray(0, 4).toString() === "%PDF" ? "application/pdf" : head[0] === 0x89 && head[1] === 0x50 ? "image/png" : head[0] === 0xff && head[1] === 0xd8 ? "image/jpeg" : head.subarray(8, 12).toString() === "WEBP" ? "image/webp" : /ftyphei|ftypmif|ftypheic/.test(head.toString("latin1")) ? mime : null;
    if (real !== mime) throw new HttpError(415, "file_type", "That file doesn't look like a PDF or photo.");
    if (clientId) {
      const prev = (await db().query<{ id: string }>("SELECT id FROM files WHERE profile_id = $1 AND client_id = $2 AND deleted_at IS NULL", [p.id, clientId])).rows[0];
      if (prev) return { file: { id: prev.id, duplicate: true } };
    }
    const fileId = crypto.randomUUID();
    const key = path.join(p.id, `${fileId}.${MIME[mime]}`);
    await fs.mkdir(path.join(config.storageDir, p.id), { recursive: true });
    await fs.writeFile(path.join(config.storageDir, key), data, { mode: 0o600 });
    const sha = crypto.createHash("sha256").update(data).digest("hex");
    await db().query("INSERT INTO files (id, profile_id, client_id, name, mime, size, sha256, storage_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [fileId, p.id, clientId, name, mime, data.length, sha, key]);
    c.status = 201;
    return { file: { id: fileId, name, mime, size: data.length, sha256: sha } };
  });

  r.get("/v1/profiles/:id/files", async (c) => {
    const p = await profileAccess(c, c.params.id);
    const rows = (await db().query<{ id: string; name: string; mime: string; size: number; created_at: Date; client_id: string | null }>("SELECT id, name, mime, size, created_at, client_id FROM files WHERE profile_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", [p.id])).rows;
    return { files: rows.map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, createdAt: f.created_at, clientId: f.client_id })) };
  });

  r.get("/v1/profiles/:id/files/:fid", async (c) => {
    const p = await profileAccess(c, c.params.id);
    const f = (await db().query<{ name: string; mime: string; storage_key: string }>("SELECT name, mime, storage_key FROM files WHERE id::text = $1 AND profile_id = $2 AND deleted_at IS NULL", [c.params.fid, p.id])).rows[0];
    if (!f) throw new HttpError(404, "no_file", "That file doesn't exist.");
    const data = await fs.readFile(path.join(config.storageDir, f.storage_key));
    c.headers["content-type"] = f.mime;
    c.headers["content-disposition"] = `attachment; filename="${encodeURIComponent(f.name)}"`;
    return data;
  });

  r.delete("/v1/profiles/:id/files/:fid", async (c) => {
    const p = await profileAccess(c, c.params.id);
    const f = (await db().query<{ storage_key: string }>("UPDATE files SET deleted_at = now() WHERE id::text = $1 AND profile_id = $2 AND deleted_at IS NULL RETURNING storage_key", [c.params.fid, p.id])).rows[0];
    if (f) await fs.rm(path.join(config.storageDir, f.storage_key), { force: true }).catch(() => undefined);
    return { ok: true };
  });

  /* --------------------------- conversations --------------------------- */
  r.post("/v1/profiles/:id/messages", async (c) => {
    const p = await profileAccess(c, c.params.id);
    limit(`msg:${p.id}`, 240, 60);
    const b = await body(
      c,
      z.object({
        conversationId: id,
        kind: z.enum(["si", "agent", "team"]).default("si"),
        title: z.string().max(200).default(""),
        messages: z.array(z.object({ id, role: z.enum(["user", "assistant"]), agent: z.string().max(40).nullable().optional(), text: z.string().max(20000), meta: z.record(z.unknown()).default({}), createdAt: iso.optional() })).min(1).max(100),
      }),
    );
    await tx(async (q) => {
      await q(
        `INSERT INTO conversations (id, profile_id, kind, title) VALUES ($1,$2,$3,$4)
         ON CONFLICT (profile_id, id) DO UPDATE SET updated_at = now(), title = CASE WHEN conversations.title = '' THEN EXCLUDED.title ELSE conversations.title END`,
        [b.conversationId, p.id, b.kind, b.title],
      );
      for (const m of b.messages)
        await q("INSERT INTO messages (id, profile_id, conversation_id, role, agent, text, meta, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, now())) ON CONFLICT (profile_id, id) DO NOTHING", [m.id, p.id, b.conversationId, m.role, m.agent ?? null, m.text, J(m.meta), m.createdAt ?? null]);
    });
    c.status = 201;
    return { ok: true };
  });

  r.get("/v1/profiles/:id/conversations", async (c) => {
    const p = await profileAccess(c, c.params.id);
    const rows = (await db().query<{ id: string; kind: string; title: string; updated_at: Date; n: number }>("SELECT c.id, c.kind, c.title, c.updated_at, (SELECT count(*)::int FROM messages m WHERE m.profile_id = c.profile_id AND m.conversation_id = c.id) AS n FROM conversations c WHERE c.profile_id = $1 ORDER BY c.updated_at DESC LIMIT 200", [p.id])).rows;
    return { conversations: rows.map((x) => ({ id: x.id, kind: x.kind, title: x.title, updatedAt: x.updated_at, messages: x.n })) };
  });

  r.get("/v1/profiles/:id/conversations/:cid", async (c) => {
    const p = await profileAccess(c, c.params.id);
    const rows = (await db().query<{ id: string; role: string; agent: string | null; text: string; meta: unknown; created_at: Date }>("SELECT id, role, agent, text, meta, created_at FROM messages WHERE profile_id = $1 AND conversation_id = $2 ORDER BY created_at, id", [p.id, c.params.cid])).rows;
    return { messages: rows.map((m) => ({ id: m.id, role: m.role, agent: m.agent, text: m.text, meta: m.meta, createdAt: m.created_at })) };
  });

  /* ------------------------------- export ------------------------------- */
  r.get("/v1/profiles/:id/export", async (c) => {
    const p = await profileAccess(c, c.params.id);
    limit(`export:${p.id}`, 10, 3600);
    const [recs, items, files, convs, msgs] = await Promise.all([
      db().query<RecRow>("SELECT * FROM records WHERE profile_id = $1 AND deleted_at IS NULL ORDER BY observed_at", [p.id]),
      db().query<ItemRow>("SELECT * FROM items WHERE profile_id = $1 AND deleted_at IS NULL", [p.id]),
      db().query("SELECT id, name, mime, size, sha256, created_at FROM files WHERE profile_id = $1 AND deleted_at IS NULL", [p.id]),
      db().query("SELECT id, kind, title, created_at, updated_at FROM conversations WHERE profile_id = $1", [p.id]),
      db().query("SELECT id, conversation_id, role, agent, text, created_at FROM messages WHERE profile_id = $1 ORDER BY created_at", [p.id]),
    ]);
    await audit(c, "profile_exported", {}, p.id);
    c.headers["content-disposition"] = `attachment; filename="overeo-${p.name.replace(/[^\w]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json"`;
    return {
      exportedAt: new Date(),
      format: "overeo-export-v1",
      profile: profileOut(p),
      records: recs.rows.map(recordOut),
      items: items.rows.map(itemOut),
      files: files.rows,
      conversations: convs.rows,
      messages: msgs.rows,
    };
  });
}
