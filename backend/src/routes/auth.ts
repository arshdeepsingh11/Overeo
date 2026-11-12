/* Accounts: sign up, log in, log out, sessions, password, delete account. */
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { db, tx } from "../db/db.js";
import { HttpError, body, limit, type Ctx, type Router } from "../http/kit.js";
import { burnTime, hashSecret, randomToken, sha256, verifySecret } from "../auth/crypto.js";
import { audit, endSession, requireUser, startSession } from "../auth/session.js";
import { sendMail } from "../lib/mail.js";
import { listProfiles, profileOut } from "./profiles.js";

const email = z.string().trim().toLowerCase().max(254).email("Please enter a valid email.");
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(200, "That password is too long.")
  .refine((p) => !/^(password|12345678|123456789|qwertyui|11111111|overeo123)$/i.test(p), "That password is too easy to guess.");
const name = z.string().trim().min(1, "Please enter a name.").max(60, "Please use a shorter name.");

const userOut = (u: { id: string; email: string; name: string; email_verified_at?: Date | null; created_at?: Date }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  emailVerified: !!u.email_verified_at,
  createdAt: u.created_at,
});

async function me(c: Ctx) {
  const u = await requireUser(c);
  const r = await db().query<{ id: string; email: string; name: string; email_verified_at: Date | null; created_at: Date }>("SELECT id, email, name, email_verified_at, created_at FROM users WHERE id = $1", [u.id]);
  return { user: userOut(r.rows[0]), profiles: await listProfiles(u.id) };
}

async function mailToken(userId: string, to: string, kind: "verify" | "reset") {
  const token = randomToken(24);
  await db().query("INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES ($1,$2,$3, now() + make_interval(hours => $4))", [userId, kind, sha256(token), kind === "reset" ? 1 : 72]);
  const link = `${config.appUrl}/app/${kind === "reset" ? "reset" : "verify"}?token=${token}`;
  await sendMail(
    kind === "reset"
      ? { to, subject: "Reset your OVEREO password", text: `Tap to choose a new password (valid for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email.` }
      : { to, subject: "Confirm your email for OVEREO", text: `Welcome to OVEREO. Tap to confirm your email:\n${link}` },
  );
}

export function authRoutes(r: Router) {
  r.post("/v1/auth/signup", async (c) => {
    limit(`signup:${c.ip}`, 10, 3600);
    const b = await body(c, z.object({ name, email, password }));
    const hash = await hashSecret(b.password);
    const user = await tx(async (q) => {
      const exists = await q("SELECT 1 FROM users WHERE lower(email) = $1", [b.email]);
      if (exists.rowCount) throw new HttpError(409, "email_taken", "There's already an account with this email. Try logging in.");
      const u = (await q<{ id: string; email: string; name: string; created_at: Date }>("INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name, created_at", [b.email, hash, b.name])).rows[0];
      await q("INSERT INTO profiles (user_id, name, relation, is_primary) VALUES ($1,$2,'self',true)", [u.id, b.name]);
      return u;
    });
    await startSession(c, user.id);
    c.user = { id: user.id, email: user.email, name: user.name, sessionId: "" };
    await audit(c, "signup");
    await mailToken(user.id, user.email, "verify").catch(() => undefined);
    c.status = 201;
    return { user: userOut(user), profiles: await listProfiles(user.id) };
  });

  r.post("/v1/auth/login", async (c) => {
    const b = await body(c, z.object({ email, password: z.string().min(1).max(200) }));
    limit(`login-ip:${c.ip}`, 30, 600);
    limit(`login-email:${b.email}`, 10, 600);
    const u = (await db().query<{ id: string; email: string; name: string; password_hash: string; locked_until: Date | null; failed_logins: number; email_verified_at: Date | null; created_at: Date }>("SELECT * FROM users WHERE lower(email) = $1", [b.email])).rows[0];
    const wrong = new HttpError(401, "wrong_login", "Email or password is wrong.");
    if (!u) {
      await burnTime(b.password);
      throw wrong;
    }
    if (u.locked_until && new Date(u.locked_until) > new Date()) throw new HttpError(423, "locked", "Too many wrong tries. Please wait 15 minutes, or reset your password.");
    if (!(await verifySecret(b.password, u.password_hash))) {
      const n = u.failed_logins + 1;
      await db().query("UPDATE users SET failed_logins = $2, locked_until = CASE WHEN $2 >= 10 THEN now() + interval '15 minutes' ELSE NULL END WHERE id = $1", [u.id, n >= 10 ? 0 : n]);
      c.user = { id: u.id, email: u.email, name: u.name, sessionId: "" };
      await audit(c, "login_failed");
      throw wrong;
    }
    await db().query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1", [u.id]);
    await startSession(c, u.id);
    c.user = { id: u.id, email: u.email, name: u.name, sessionId: "" };
    await audit(c, "login");
    return { user: userOut(u), profiles: await listProfiles(u.id) };
  });

  r.post("/v1/auth/logout", async (c) => {
    try {
      await requireUser(c);
      await audit(c, "logout");
    } catch {}
    await endSession(c);
    return { ok: true };
  });

  r.get("/v1/auth/me", me);
  // the same, but "signed out" is a normal answer (200), not an error — for the app's start-up check
  r.get("/v1/auth/session", async (c) => {
    try {
      return await me(c);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) return { user: null, profiles: [] };
      throw e;
    }
  });

  r.patch("/v1/auth/me", async (c) => {
    const u = await requireUser(c);
    const b = await body(c, z.object({ name }));
    await db().query("UPDATE users SET name = $2, updated_at = now() WHERE id = $1", [u.id, b.name]);
    return me(c);
  });

  r.post("/v1/auth/password", async (c) => {
    const u = await requireUser(c);
    limit(`pw:${u.id}`, 10, 600);
    const b = await body(c, z.object({ current: z.string().min(1).max(200), next: password }));
    const row = (await db().query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id])).rows[0];
    if (!(await verifySecret(b.current, row.password_hash))) throw new HttpError(401, "wrong_password", "Your current password is wrong.");
    await db().query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [u.id, await hashSecret(b.next)]);
    // sign out every other device
    await db().query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL", [u.id, u.sessionId]);
    await audit(c, "password_changed");
    return { ok: true };
  });

  r.get("/v1/auth/sessions", async (c) => {
    const u = await requireUser(c);
    const rows = (await db().query<{ id: string; user_agent: string; created_at: Date; last_seen_at: Date }>("SELECT id, user_agent, created_at, last_seen_at FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC", [u.id])).rows;
    return { sessions: rows.map((s) => ({ id: s.id, device: s.user_agent, createdAt: s.created_at, lastSeenAt: s.last_seen_at, current: s.id === u.sessionId })) };
  });

  r.delete("/v1/auth/sessions/:id", async (c) => {
    const u = await requireUser(c);
    await db().query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2", [c.params.id, u.id]);
    await audit(c, "session_revoked");
    return { ok: true };
  });

  r.post("/v1/auth/forgot", async (c) => {
    limit(`forgot:${c.ip}`, 5, 3600);
    const b = await body(c, z.object({ email }));
    const u = (await db().query<{ id: string; email: string }>("SELECT id, email FROM users WHERE lower(email) = $1", [b.email])).rows[0];
    if (u) await mailToken(u.id, u.email, "reset");
    // same answer either way, so nobody can test which emails have accounts
    return { ok: true, message: "If that email has an account, we've sent a link to reset the password." };
  });

  r.post("/v1/auth/reset", async (c) => {
    limit(`reset:${c.ip}`, 10, 3600);
    const b = await body(c, z.object({ token: z.string().min(10).max(200), password }));
    const t = (await db().query<{ id: string; user_id: string }>("SELECT id, user_id FROM email_tokens WHERE token_hash = $1 AND kind = 'reset' AND used_at IS NULL AND expires_at > now()", [sha256(b.token)])).rows[0];
    if (!t) throw new HttpError(400, "bad_token", "This link has expired. Please ask for a new one.");
    await tx(async (q) => {
      await q("UPDATE email_tokens SET used_at = now() WHERE id = $1", [t.id]);
      await q("UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1", [t.user_id, await hashSecret(b.password)]);
      await q("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [t.user_id]);
    });
    return { ok: true };
  });

  r.post("/v1/auth/verify", async (c) => {
    const b = await body(c, z.object({ token: z.string().min(10).max(200) }));
    const t = (await db().query<{ id: string; user_id: string }>("SELECT id, user_id FROM email_tokens WHERE token_hash = $1 AND kind = 'verify' AND used_at IS NULL AND expires_at > now()", [sha256(b.token)])).rows[0];
    if (!t) throw new HttpError(400, "bad_token", "This link has expired.");
    await db().query("UPDATE email_tokens SET used_at = now() WHERE id = $1", [t.id]);
    await db().query("UPDATE users SET email_verified_at = now() WHERE id = $1", [t.user_id]);
    return { ok: true };
  });

  r.delete("/v1/account", async (c) => {
    const u = await requireUser(c);
    limit(`del:${u.id}`, 5, 3600);
    const b = await body(c, z.object({ password: z.string().min(1).max(200) }));
    const row = (await db().query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id])).rows[0];
    if (!(await verifySecret(b.password, row.password_hash))) throw new HttpError(401, "wrong_password", "Your password is wrong.");
    const files = (await db().query<{ storage_key: string }>("SELECT f.storage_key FROM files f JOIN profiles p ON p.id = f.profile_id WHERE p.user_id = $1", [u.id])).rows;
    await audit(c, "account_deleted");
    await db().query("DELETE FROM users WHERE id = $1", [u.id]); // cascades to everything she owns
    for (const f of files) await fs.rm(path.join(config.storageDir, f.storage_key), { force: true }).catch(() => undefined);
    await endSession(c);
    return { ok: true };
  });
}

export { profileOut };
