/* =====================================================================
   Talking to the OVEREO backend (backend/). The website forwards
   /api/v1/* to it, so cookies stay on this site. Every error comes back
   as { code, message } with a message that can be shown as it is.
   ===================================================================== */

export const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_PATH || "/api/v1").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** PIN unlock keys for family profiles, for this browser tab only */
const keys = new Map<string, string>();
export const profileKeys = {
  set(id: string, key: string | null | undefined) {
    if (key) keys.set(id, key);
    try {
      if (key) sessionStorage.setItem(`overeo.pk.${id}`, key);
    } catch {}
  },
  get(id: string) {
    if (keys.has(id)) return keys.get(id);
    try {
      const k = sessionStorage.getItem(`overeo.pk.${id}`);
      if (k) keys.set(id, k);
      return k ?? undefined;
    } catch {
      return undefined;
    }
  },
  clear() {
    keys.clear();
    try {
      for (const k of Object.keys(sessionStorage)) if (k.startsWith("overeo.pk.")) sessionStorage.removeItem(k);
    } catch {}
  },
};

export async function api<T = unknown>(method: string, path: string, body?: unknown, opts: { profileId?: string; raw?: Blob; headers?: Record<string, string>; timeout?: number; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (opts.profileId) {
    const k = profileKeys.get(opts.profileId);
    if (k) headers["x-profile-key"] = k;
  }
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      credentials: "same-origin",
      body: opts.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal: opts.signal ?? AbortSignal.timeout(opts.timeout ?? 20_000),
    });
  } catch {
    throw new ApiError(0, typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "unreachable", typeof navigator !== "undefined" && navigator.onLine === false ? "You're offline. Your changes are saved on this device." : "Can't reach OVEREO's server right now. Please try again in a moment.");
  }
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    // 404 on the whole API = the backend isn't connected to this website
    if (res.status === 404 && !e) throw new ApiError(404, "no_backend", "Accounts aren't switched on for this website yet.");
    if (res.status >= 500 && !e) throw new ApiError(res.status, "unreachable", "Can't reach OVEREO's server right now. Please try again in a moment.");
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? "Something went wrong. Please try again.", e?.fields);
  }
  return data as T;
}
