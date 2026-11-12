/* =====================================================================
   Xevyo provider (server only) — one small interface the agent team
   uses. Xevyo is OpenAI-compatible, so another provider can be added
   behind the same `complete()` without touching the agents.
   ===================================================================== */

const BASE = (process.env.XEVYO_BASE_URL || "https://chat.xevyo.com/xevyo/v1").replace(/\/+$/, "");
const MODEL = process.env.XEVYO_MODEL || "xevyo";
const PROJECT = process.env.XEVYO_PROJECT_ID || "";

export type Msg = { role: "system" | "user" | "assistant"; content: string };
export type Completion = { ok: true; text: string } | { ok: false; reason: string; status?: number };

export const xevyoConfigured = () => !!process.env.XEVYO_API_KEY;

const reasonFor = (status: number) => (status === 402 ? "quota" : status === 401 || status === 403 ? "auth" : status === 429 ? "rate-limited" : "upstream");

export async function complete(messages: Msg[], opts: { maxTokens?: number; timeout?: number; temperature?: number; name?: string } = {}): Promise<Completion> {
  const key = process.env.XEVYO_API_KEY;
  if (!key) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        temperature: opts.temperature ?? 0.25,
        max_tokens: opts.maxTokens ?? 420,
        messages,
        assistant_name: opts.name ?? "Overeo SI",
        company_name: "OVEREO",
        ...(PROJECT ? { project_id: PROJECT } : {}),
      }),
      signal: AbortSignal.timeout(opts.timeout ?? 30_000),
    });
    if (!res.ok) return { ok: false, reason: reasonFor(res.status), status: res.status };
    const j = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const text = (j?.choices?.[0]?.message?.content ?? "").trim();
    return text ? { ok: true, text } : { ok: false, reason: "bad-output" };
  } catch (e) {
    return { ok: false, reason: (e as Error).name === "TimeoutError" ? "slow" : "unreachable" };
  }
}

/* a light per-instance rate limit — the real one belongs in the API gateway */
const hits = new Map<string, number[]>();
export function limited(key: string, max: number) {
  const now = Date.now();
  const xs = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  xs.push(now);
  hits.set(key, xs);
  if (hits.size > 5000) hits.clear();
  return xs.length > max;
}

export const LANG_NAME: Record<string, string> = { en: "English", es: "Spanish", fr: "French", pt: "Portuguese", de: "German", hi: "Hindi", pa: "Punjabi (Gurmukhi script)", zh: "Simplified Chinese" };
