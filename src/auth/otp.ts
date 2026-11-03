import { load, save } from "../personal/db";

/* =====================================================================
   Email + one-time code sign-in.

   Works with either backend, chosen by environment:
     Supabase   NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
                (email template must include {{ .Token }} — docs/BACKEND.md)
     Custom API NEXT_PUBLIC_DATA_BACKEND=rest + NEXT_PUBLIC_API_URL
                POST /v1/auth/code {email} · POST /v1/auth/verify {email, code}
     Neither    sign-in stays hidden; her space works fully on the device.

   The session is kept on this device only. Her health data still lives
   on the device until sync is switched on — signing in proves it's her
   and reserves her account.
   ===================================================================== */

export type AuthMode = "supabase" | "rest" | "none";

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export const AUTH_MODE: AuthMode = SB_URL && SB_KEY ? "supabase" : process.env.NEXT_PUBLIC_DATA_BACKEND === "rest" && API ? "rest" : "none";

export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  /** ms since epoch */
  expiresAt: number;
}

export type AuthResult<T = void> = { ok: true; value: T } | { ok: false; error: string; retryAfter?: number };

const DEVICE = "device";
export const getSession = (): AuthSession | null => load<AuthSession | null>(DEVICE, "auth", null);
const setSession = (s: AuthSession | null) => save(DEVICE, "auth", s);

export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
export const normaliseEmail = (e: string) => e.trim().toLowerCase();

async function call(url: string, body: unknown, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, ok: res.ok, j, retryAfter: Number(res.headers.get("retry-after")) || undefined };
  } catch {
    return { status: 0, ok: false, j: {} as Record<string, unknown>, retryAfter: undefined };
  }
}

const sbHeaders = () => ({ apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` });

function explain(status: number, j: Record<string, unknown>, stage: "send" | "verify"): string {
  const msg = String(j.msg ?? j.message ?? j.error_description ?? j.error ?? "").toLowerCase();
  if (status === 0) return "Can't reach the sign-in service. Check your connection and try again.";
  if (status === 429 || /rate|too many|security purposes/.test(msg)) return "Too many tries. Please wait a minute and try again.";
  if (stage === "verify" && (/expired/.test(msg) || /otp_expired/.test(String(j.error_code ?? "")))) return "That code has expired. Send a new one.";
  if (stage === "verify" && (status === 400 || status === 401 || status === 403 || /invalid|token/.test(msg))) return "That code doesn't match. Check the latest email and try again.";
  if (stage === "send" && /signups not allowed|not allowed/.test(msg)) return "New sign-ups are closed right now.";
  return "Something went wrong. Please try again.";
}

/** Step 1 — email her a 6-digit code. */
export async function startOtp(emailRaw: string): Promise<AuthResult> {
  const email = normaliseEmail(emailRaw);
  if (!validEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  if (AUTH_MODE === "none") return { ok: false, error: "Email sign-in isn't switched on yet." };
  const r = AUTH_MODE === "supabase" ? await call(`${SB_URL}/auth/v1/otp`, { email, create_user: true }, sbHeaders()) : await call(`${API}/v1/auth/code`, { email });
  return r.ok ? { ok: true, value: undefined } : { ok: false, error: explain(r.status, r.j, "send"), retryAfter: r.retryAfter };
}

/** Step 2 — check the code and start a session on this device. */
export async function verifyOtp(emailRaw: string, codeRaw: string): Promise<AuthResult<AuthSession>> {
  const email = normaliseEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  if (code.length < 6 || code.length > 10) return { ok: false, error: "Enter the code from the email." };
  if (AUTH_MODE === "none") return { ok: false, error: "Email sign-in isn't switched on yet." };
  const r = AUTH_MODE === "supabase" ? await call(`${SB_URL}/auth/v1/verify`, { type: "email", email, token: code }, sbHeaders()) : await call(`${API}/v1/auth/verify`, { email, code });
  if (!r.ok) return { ok: false, error: explain(r.status, r.j, "verify") };
  const j = r.j as { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { id?: string; email?: string }; accessToken?: string; refreshToken?: string; expiresIn?: number; userId?: string };
  const accessToken = j.access_token ?? j.accessToken;
  const userId = j.user?.id ?? j.userId;
  if (!accessToken || !userId) return { ok: false, error: "The sign-in service sent an unexpected reply." };
  const expiresIn = j.expires_in ?? j.expiresIn ?? 3600;
  const s: AuthSession = { userId, email: j.user?.email ?? email, accessToken, refreshToken: j.refresh_token ?? j.refreshToken, expiresAt: j.expires_at ? j.expires_at * 1000 : Date.now() + expiresIn * 1000 };
  setSession(s);
  return { ok: true, value: s };
}

/** Keep the session fresh (call before using the token). */
export async function freshSession(): Promise<AuthSession | null> {
  const s = getSession();
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000 || !s.refreshToken) return s;
  const r = AUTH_MODE === "supabase" ? await call(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, { refresh_token: s.refreshToken }, sbHeaders()) : AUTH_MODE === "rest" ? await call(`${API}/v1/auth/refresh`, { refreshToken: s.refreshToken }) : null;
  if (!r || !r.ok) return s.expiresAt > Date.now() ? s : null;
  const j = r.j as { access_token?: string; refresh_token?: string; expires_in?: number; accessToken?: string; refreshToken?: string; expiresIn?: number };
  const next: AuthSession = { ...s, accessToken: j.access_token ?? j.accessToken ?? s.accessToken, refreshToken: j.refresh_token ?? j.refreshToken ?? s.refreshToken, expiresAt: Date.now() + (j.expires_in ?? j.expiresIn ?? 3600) * 1000 };
  setSession(next);
  return next;
}

/** Sign out of email on this device (her space stays). */
export async function signOutEmail() {
  const s = getSession();
  setSession(null);
  if (!s) return;
  if (AUTH_MODE === "supabase") await call(`${SB_URL}/auth/v1/logout`, {}, { apikey: SB_KEY, authorization: `Bearer ${s.accessToken}` }).catch(() => null);
  else if (AUTH_MODE === "rest") await call(`${API}/v1/auth/signout`, {}, { authorization: `Bearer ${s.accessToken}` }).catch(() => null);
}
