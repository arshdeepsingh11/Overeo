import { config } from "../config.js";
import { db } from "../db/db.js";
import { HttpError, cookies, setCookie, type Ctx } from "../http/kit.js";
import { randomToken, sha256 } from "./crypto.js";

/** Start a session: random token in an HttpOnly cookie (and returned for apps that use a Bearer header). */
export async function startSession(c: Ctx, userId: string) {
  const token = randomToken();
  const days = config.sessionDays;
  await db().query("INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at) VALUES ($1,$2,$3,$4, now() + make_interval(days => $5))", [userId, sha256(token), String(c.req.headers["user-agent"] ?? "").slice(0, 300), c.ip, days]);
  setCookie(c, config.cookieName, token, days * 86400);
  return token;
}

function tokenFrom(c: Ctx) {
  const auth = String(c.req.headers.authorization ?? "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return cookies(c.req)[config.cookieName];
}

/** The signed-in user, or 401. Sessions slide: each day of use extends them. */
export async function requireUser(c: Ctx) {
  if (c.user) return c.user;
  const token = tokenFrom(c);
  if (!token || token.length > 200) throw new HttpError(401, "signed_out", "Please sign in.");
  const r = await db().query<{ sid: string; id: string; email: string; name: string; last_seen_at: Date }>(
    `SELECT s.id AS sid, u.id, u.email, u.name, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [sha256(token)],
  );
  const s = r.rows[0];
  if (!s) throw new HttpError(401, "signed_out", "Your session has ended. Please sign in again.");
  if (Date.now() - new Date(s.last_seen_at).getTime() > 3600_000)
    await db().query("UPDATE sessions SET last_seen_at = now(), expires_at = now() + make_interval(days => $2) WHERE id = $1", [s.sid, config.sessionDays]);
  c.user = { id: s.id, email: s.email, name: s.name, sessionId: s.sid };
  return c.user;
}

export async function endSession(c: Ctx) {
  const token = tokenFrom(c);
  if (token) await db().query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [sha256(token)]);
  setCookie(c, config.cookieName, "", 0);
}

export async function audit(c: Ctx, action: string, detail: Record<string, unknown> = {}, profileId?: string) {
  await db().query("INSERT INTO audit_log (user_id, profile_id, action, detail, ip) VALUES ($1,$2,$3,$4,$5)", [c.user?.id ?? null, profileId ?? null, action, JSON.stringify(detail), c.ip]);
}
