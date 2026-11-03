/* =====================================================================
   The live brain (Xevyo), used carefully.

   OVEREO Mind is always first and always available. Xevyo is asked only
   for what Mind can't do well on its own — open questions, deeper
   explanations, warmer wording, reading a report's text — and every
   reply is checked before she sees it:
     - wording must keep every number and add none
     - nothing may give a dose, a diagnosis, or name another assistant
     - extracted lab values must appear in the report text
   If a check fails, or Xevyo is slow or unavailable, she gets Mind's
   answer instead, and is told so.
   ===================================================================== */

export const LIVE_ENDPOINT: string | undefined = process.env.NEXT_PUBLIC_SI_LIVE === "0" ? undefined : process.env.NEXT_PUBLIC_SI_ENDPOINT || "/api/si";

const COOL_KEY = "overeo.si.cool";
const BUDGET_KEY = "overeo.si.wordBudget";

export function cooling() {
  try {
    return Number(sessionStorage.getItem(COOL_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}
export function coolDown(ms: number) {
  try {
    sessionStorage.setItem(COOL_KEY, String(Date.now() + ms));
  } catch {}
}

export function liveReady() {
  return !!LIVE_ENDPOINT && (typeof navigator === "undefined" || navigator.onLine !== false) && !cooling();
}

export const REASON: Record<string, string> = {
  quota: "The live brain has reached its usage limit for now",
  "not-configured": "The live brain isn't connected on this server",
  auth: "The live brain refused the key",
  "rate-limited": "The live brain is busy",
  unreachable: "The live brain can't be reached",
  upstream: "The live brain had a problem",
  offline: "You're offline",
  slow: "The live brain was too slow",
  checked: "The live answer didn't pass OVEREO's safety checks",
  "bad-output": "The live brain returned something unreadable",
};

/* ------------------------------ guardrails ------------------------------ */

/** Numbers as they appear in text ("6.4", "1,000" → 1000, "22"). */
export function numbersIn(t: string): number[] {
  return (t.match(/\d+(?:[.,]\d+)*/g) ?? []).map((x) => (/^\d{1,3}(,\d{3})+$/.test(x) ? Number(x.replace(/,/g, "")) : Number(x.replace(",", ".")))).filter((n) => Number.isFinite(n));
}

const DOSE = /\b(take|taking|start|increase|decrease|double|stop|use)\b[^.]{0,40}\b\d+(?:[.,]\d+)?\s?(mg|mcg|µg|ug|g|iu|ml|units?|tablets?|pills?|capsules?)\b|\b\d+(?:[.,]\d+)?\s?(mg|mcg|µg|iu)\b[^.]{0,30}\b(a day|daily|per day|twice|once)\b/i;
const DIAGNOSIS = /\byou (definitely |clearly |probably )?(have|are suffering from|are diagnosed with)\s+(endometriosis|pcos|cancer|diabetes|hypothyroidism|hyperthyroidism|anemia|anaemia|depression|an? (infection|tumou?r|std|sti))\b/i;
const IDENTITY = /\b(nexus|xevyo|openai|chatgpt|gpt-\d|llama|anthropic|claude)\b/i;

export function checkText(out: string): string | null {
  if (!out || out.trim().length < 8) return "empty";
  if (DOSE.test(out)) return "dose";
  if (DIAGNOSIS.test(out)) return "diagnosis";
  if (IDENTITY.test(out)) return "identity";
  return null;
}

/** A rewrite may not add or drop any number. */
export function checkWording(original: string, out: string): string | null {
  const bad = checkText(out);
  if (bad) return bad;
  if (out.length > 420) return "too-long";
  const src = numbersIn(original);
  const got = numbersIn(out);
  if (got.some((n) => !src.some((s) => Math.abs(s - n) < 1e-9))) return "added-number";
  const body = numbersIn(original.split("\nWhy:")[0]);
  if (body.some((n) => !got.some((g) => Math.abs(g - n) < 1e-9))) return "dropped-number";
  return null;
}

/* --------------------------------- calls --------------------------------- */

async function post(body: unknown, timeout: number, signal?: AbortSignal) {
  if (!LIVE_ENDPOINT) return { ok: false as const, reason: "not-configured" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false as const, reason: "offline" };
  if (cooling()) return { ok: false as const, reason: "upstream" };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  signal?.addEventListener("abort", () => ac.abort());
  try {
    const res = await fetch(LIVE_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    return { ok: true as const, res };
  } catch (e) {
    if (signal?.aborted) throw e;
    coolDown(60_000);
    return { ok: false as const, reason: ac.signal.aborted ? "slow" : "unreachable" };
  } finally {
    clearTimeout(t);
  }
}

async function failed(res: Response) {
  const info = (await res.json().catch(() => ({}))) as { reason?: string };
  const reason = info.reason ?? (res.status === 404 ? "not-configured" : "upstream");
  coolDown(reason === "quota" ? 10 * 60_000 : reason === "not-configured" ? 30 * 60_000 : 2 * 60_000);
  return reason;
}

/** Stream an answer to an open question, grounded in Mind's facts. */
export async function askLive(input: { question: string; history: { role: "user" | "assistant"; content: string }[]; facts: string[]; language: string; onText: (t: string) => void; signal?: AbortSignal }): Promise<{ ok: true; text: string } | { ok: false; reason: string; partial?: string }> {
  const r = await post({ mode: "chat", messages: [...input.history.slice(-8), { role: "user", content: input.question }], facts: input.facts, language: input.language }, 25_000, input.signal);
  if (!r.ok) return r;
  if (!r.res.ok || !r.res.body) return { ok: false, reason: await failed(r.res) };
  const reader = r.res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  // a stalled stream shouldn't hang her: give up after 20 s without new text
  for (;;) {
    const next = await Promise.race([reader.read(), new Promise<"stall">((res) => setTimeout(() => res("stall"), 20_000))]);
    if (next === "stall") {
      void reader.cancel();
      return { ok: false, reason: "slow", partial: text };
    }
    if (next.done) break;
    text += dec.decode(next.value, { stream: true });
    input.onText(text);
  }
  const bad = checkText(text);
  if (bad) return { ok: false, reason: "checked", partial: text };
  return { ok: true, text: text.trim() };
}

function spendBudget(max: number) {
  try {
    const today = new Date().toDateString();
    const b = JSON.parse(localStorage.getItem(BUDGET_KEY) ?? "{}") as { day?: string; n?: number };
    const n = b.day === today ? (b.n ?? 0) : 0;
    if (n >= max) return false;
    localStorage.setItem(BUDGET_KEY, JSON.stringify({ day: today, n: n + 1 }));
    return true;
  } catch {
    return false;
  }
}

/** Warmer wording for an agent suggestion. Returns null to keep the original. */
export async function wordLive(sg: { title: string; body: string; why: string[] }, language: string): Promise<string | null> {
  if (!liveReady() || !spendBudget(12)) return null;
  const r = await post({ mode: "word", suggestion: sg, language }, 20_000);
  if (!r.ok) return null;
  if (!r.res.ok) {
    await failed(r.res);
    return null;
  }
  const j = (await r.res.json().catch(() => null)) as { text?: string } | null;
  const out = j?.text?.trim().replace(/^["“]|["”]$/g, "") ?? "";
  // only English rewrites can be number-checked against the English original reliably
  return out && !checkWording(`${sg.title}\n${sg.body}\nWhy:${sg.why.join(" ")}`, out) ? out : null;
}

export interface ExtractedRow {
  test: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
}

/** Ask the live brain to structure report text; keep only values printed in the text. */
export async function extractLive(text: string): Promise<{ collected: string | null; results: ExtractedRow[] } | null> {
  if (!liveReady()) return null;
  const r = await post({ mode: "extract", text }, 35_000);
  if (!r.ok) return null;
  if (!r.res.ok) {
    await failed(r.res);
    return null;
  }
  const j = (await r.res.json().catch(() => null)) as { collected?: unknown; results?: unknown } | null;
  if (!j || !Array.isArray(j.results)) return null;
  const printed = numbersIn(text);
  const results = (j.results as Record<string, unknown>[])
    .map((x) => ({
      test: String(x.test ?? "").trim().slice(0, 80),
      value: Number(x.value),
      unit: String(x.unit ?? "").trim().slice(0, 20),
      low: x.low == null || x.low === "" ? null : Number(x.low),
      high: x.high == null || x.high === "" ? null : Number(x.high),
    }))
    .filter((x) => x.test && Number.isFinite(x.value) && printed.some((n) => Math.abs(n - x.value) < 1e-9))
    .map((x) => ({ ...x, low: x.low != null && Number.isFinite(x.low) && printed.some((n) => Math.abs(n - x.low!) < 1e-9) ? x.low : null, high: x.high != null && Number.isFinite(x.high) && printed.some((n) => Math.abs(n - x.high!) < 1e-9) ? x.high : null }));
  const collected = typeof j.collected === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.collected) ? j.collected : null;
  return { collected, results };
}
