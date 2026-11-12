/* Family profiles: one login, several people, each with private data and an optional PIN. */
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/db.js";
import { HttpError, body, limit, type Ctx, type Router } from "../http/kit.js";
import { checkProfileKey, hashSecret, profileKey, verifySecret } from "../auth/crypto.js";
import { audit, requireUser } from "../auth/session.js";

export const RELATIONS = ["self", "mother", "daughter", "sister", "partner", "grandmother", "friend", "other"] as const;
export const STAGES = ["cycling", "trying", "pregnant", "postpartum", "peri", "post"] as const;
export const GOALS = ["periods", "fertility", "egg-freezing", "pregnancy", "menopause", "energy", "general"] as const;

type Row = {
  id: string;
  name: string;
  relation: string;
  is_primary: boolean;
  birth_year: number | null;
  life_stage: string;
  goals: string[];
  typical_cycle: number | null;
  hue: number;
  pin_hash: string | null;
  consent: Record<string, boolean>;
  created_at: Date;
  updated_at: Date;
};

export const profileOut = (p: Row) => ({
  id: p.id,
  name: p.name,
  relation: p.relation,
  isPrimary: p.is_primary,
  birthYear: p.birth_year,
  lifeStage: p.life_stage,
  goals: p.goals,
  typicalCycle: p.typical_cycle,
  hue: p.hue,
  hasPin: !!p.pin_hash,
  consent: p.consent,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

export async function listProfiles(userId: string) {
  const r = await db().query<Row>("SELECT * FROM profiles WHERE user_id = $1 ORDER BY is_primary DESC, created_at", [userId]);
  return r.rows.map(profileOut);
}

/** Her profile, checked: it belongs to this login, and a PIN-locked profile was unlocked in this session. */
export async function profileAccess(c: Ctx, pid: string, opts: { skipPin?: boolean } = {}): Promise<Row> {
  const u = await requireUser(c);
  if (!/^[0-9a-f-]{36}$/i.test(pid)) throw new HttpError(404, "no_profile", "That profile doesn't exist.");
  const p = (await db().query<Row>("SELECT * FROM profiles WHERE id = $1 AND user_id = $2", [pid, u.id])).rows[0];
  if (!p) throw new HttpError(404, "no_profile", "That profile doesn't exist.");
  if (p.pin_hash && !opts.skipPin && !checkProfileKey(String(c.req.headers["x-profile-key"] ?? ""), u.sessionId, p.id)) throw new HttpError(403, "pin_required", "Enter this profile's PIN to open it.");
  return p;
}

const pin = z.string().regex(/^\d{4,8}$/, "Use 4 to 8 numbers.");
const fields = {
  name: z.string().trim().min(1, "Please enter a name.").max(60),
  relation: z.enum(RELATIONS),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable(),
  lifeStage: z.enum(STAGES),
  goals: z.array(z.enum(GOALS)).max(7),
  typicalCycle: z.number().int().min(15).max(90).nullable(),
  hue: z.number().int().min(0).max(359),
  consent: z.object({ personalise: z.boolean(), genetics: z.boolean(), notifications: z.boolean(), research: z.boolean() }),
};

export function profileRoutes(r: Router) {
  r.get("/v1/profiles", async (c) => {
    const u = await requireUser(c);
    return { profiles: await listProfiles(u.id) };
  });

  r.post("/v1/profiles", async (c) => {
    const u = await requireUser(c);
    limit(`profile-new:${u.id}`, 20, 3600);
    const b = await body(
      c,
      z.object({ ...fields, relation: fields.relation.exclude(["self"]), pin: pin.optional() }).partial({ birthYear: true, lifeStage: true, goals: true, typicalCycle: true, hue: true, consent: true }),
    );
    const n = (await db().query<{ n: number }>("SELECT count(*)::int AS n FROM profiles WHERE user_id = $1", [u.id])).rows[0].n;
    if (n >= config.maxProfiles) throw new HttpError(409, "too_many_profiles", `One account can hold up to ${config.maxProfiles} profiles.`);
    const row = (
      await db().query<Row>(
        `INSERT INTO profiles (user_id, name, relation, birth_year, life_stage, goals, typical_cycle, hue, pin_hash, consent)
         VALUES ($1,$2,$3,$4,COALESCE($5,'cycling'),COALESCE($6,'{}'::text[]),$7,COALESCE($8,330),$9,COALESCE($10,'{"personalise": true, "genetics": false, "notifications": false, "research": false}'::jsonb))
         RETURNING *`,
        [u.id, b.name, b.relation, b.birthYear ?? null, b.lifeStage ?? null, b.goals ?? null, b.typicalCycle ?? null, b.hue ?? null, b.pin ? await hashSecret(b.pin) : null, b.consent ? JSON.stringify(b.consent) : null],
      )
    ).rows[0];
    await audit(c, "profile_created", { relation: b.relation }, row.id);
    c.status = 201;
    return { profile: profileOut(row), key: row.pin_hash ? profileKey(u.sessionId, row.id) : undefined };
  });

  r.patch("/v1/profiles/:id", async (c) => {
    const p = await profileAccess(c, c.params.id);
    const b = await body(c, z.object({ ...fields, pin: pin.nullable() }).partial());
    if (b.relation && p.is_primary && b.relation !== "self") throw new HttpError(422, "invalid", "Your own profile stays as you.");
    if (b.relation === "self" && !p.is_primary) throw new HttpError(422, "invalid", "Only your own profile can be 'you'.");
    const sets: string[] = [];
    const vals: unknown[] = [p.id];
    const put = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (b.name !== undefined) put("name", b.name);
    if (b.relation !== undefined) put("relation", b.relation);
    if (b.birthYear !== undefined) put("birth_year", b.birthYear);
    if (b.lifeStage !== undefined) put("life_stage", b.lifeStage);
    if (b.goals !== undefined) put("goals", b.goals);
    if (b.typicalCycle !== undefined) put("typical_cycle", b.typicalCycle);
    if (b.hue !== undefined) put("hue", b.hue);
    if (b.consent !== undefined) put("consent", JSON.stringify(b.consent));
    if (b.pin !== undefined) put("pin_hash", b.pin ? await hashSecret(b.pin) : null);
    if (!sets.length) return { profile: profileOut(p) };
    const row = (await db().query<Row>(`UPDATE profiles SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, vals)).rows[0];
    if (b.pin !== undefined) await audit(c, b.pin ? "profile_pin_set" : "profile_pin_removed", {}, p.id);
    const u = await requireUser(c);
    return { profile: profileOut(row), key: b.pin ? profileKey(u.sessionId, p.id) : undefined };
  });

  r.post("/v1/profiles/:id/unlock", async (c) => {
    const u = await requireUser(c);
    const p = await profileAccess(c, c.params.id, { skipPin: true });
    limit(`unlock:${u.id}:${p.id}`, 6, 300);
    const b = await body(c, z.object({ pin: z.string().max(12) }));
    if (!p.pin_hash) return { key: null };
    if (!(await verifySecret(b.pin, p.pin_hash))) {
      await audit(c, "profile_pin_wrong", {}, p.id);
      throw new HttpError(401, "wrong_pin", "That PIN isn't right.");
    }
    return { key: profileKey(u.sessionId, p.id) };
  });

  r.delete("/v1/profiles/:id", async (c) => {
    const u = await requireUser(c);
    const p = await profileAccess(c, c.params.id);
    if (p.is_primary) throw new HttpError(409, "primary_profile", "Your own profile can't be removed — delete the account instead.");
    const b = await body(c, z.object({ password: z.string().min(1).max(200) }));
    const row = (await db().query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id])).rows[0];
    if (!(await verifySecret(b.password, row.password_hash))) throw new HttpError(401, "wrong_password", "Your password is wrong.");
    const files = (await db().query<{ storage_key: string }>("SELECT storage_key FROM files WHERE profile_id = $1", [p.id])).rows;
    await db().query("DELETE FROM profiles WHERE id = $1", [p.id]);
    for (const f of files) await fs.rm(path.join(config.storageDir, f.storage_key), { force: true }).catch(() => undefined);
    await audit(c, "profile_deleted", { relation: p.relation }, p.id);
    return { ok: true };
  });
}
