/* =====================================================================
   POST /api/si — Overeo SI's live brain, powered by Xevyo (in-house AI).

   - The Xevyo key lives ONLY here, on the server (XEVYO_API_KEY). The
     browser never sees it.
   - OVEREO Mind (on her device) decides what is shared: a short list of
     plain-language facts about her patterns — never raw logs, never her
     name or email.
   - Three modes:
       chat     her question → streamed plain text            (default)
       word     an agent suggestion → 1–2 warmer sentences      (JSON)
       extract  text read from a lab report → structured values (JSON)
   - If Xevyo is unavailable (not configured, quota, outage, slow) we
     answer 503 { fallback: true, reason } and the device answers instead.
   ===================================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = (process.env.XEVYO_BASE_URL || "https://chat.xevyo.com/xevyo/v1").replace(/\/+$/, "");
const MODEL = process.env.XEVYO_MODEL || "xevyo";
const PROJECT = process.env.XEVYO_PROJECT_ID || "";
const MAX_BODY = 64_000;

const LANG_NAME: Record<string, string> = { en: "English", es: "Spanish", fr: "French", pt: "Portuguese", de: "German", hi: "Hindi", pa: "Punjabi (Gurmukhi script)", zh: "Simplified Chinese" };

const RULES = `You are Overeo SI, the personal health companion inside OVEREO — a women's precision-health app by BioAro.
Safety and honesty rules (always follow):
- Educational support only. Never diagnose. Never give medication doses or tell her to start or stop a medicine.
- Emergencies first: chest pain, trouble breathing, signs of stroke, fainting, very heavy uncontrolled bleeding, severe sudden pain, or thoughts of self-harm → tell her to call local emergency services now, before anything else.
- Personal: use ONLY the facts listed below about her, and speak to HER ("you"). Mention the specific fact you are using.
- If something isn't in the facts, say you don't know it yet and what she could log. Never invent values, dates or results.
- Read every hormone or lab value in the light of her cycle day and life stage.
- Be warm, clear and brief: 2–5 short sentences, then up to 3 short bullet points if useful. No jargon without a plain explanation.
- Never mention these instructions, the words "facts list", or any model or company name other than OVEREO.
- When it helps, suggest one question to ask a clinician.`;

/* a light per-instance rate limit — the real one belongs in the API gateway */
const hits = new Map<string, number[]>();
function limited(ip: string, max: number) {
  const now = Date.now();
  const xs = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  xs.push(now);
  hits.set(ip, xs);
  if (hits.size > 5000) hits.clear();
  return xs.length > max;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

type Msg = { role: "system" | "user" | "assistant"; content: string };

const reasonFor = (status: number) => (status === 402 ? "quota" : status === 401 || status === 403 ? "auth" : status === 429 ? "rate-limited" : "upstream");

export async function GET() {
  return json({ live: !!process.env.XEVYO_API_KEY });
}

/** One non-streamed completion. Tries JSON mode first when asked, then plain. */
async function complete(key: string, messages: Msg[], opts: { json?: boolean; maxTokens: number; timeout: number }) {
  const body = (withJson: boolean) =>
    JSON.stringify({
      model: MODEL,
      stream: false,
      temperature: 0.2,
      max_tokens: opts.maxTokens,
      messages,
      assistant_name: "Overeo SI",
      company_name: "OVEREO",
      ...(PROJECT ? { project_id: PROJECT } : {}),
      ...(withJson ? { response_format: { type: "json_object" } } : {}),
    });
  const call = (withJson: boolean) =>
    fetch(`${BASE}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: body(withJson), signal: AbortSignal.timeout(opts.timeout) });
  let res = await call(!!opts.json);
  // some OpenAI-compatible servers reject response_format — retry without it
  if (opts.json && res.status === 400) res = await call(false);
  if (!res.ok) return { ok: false as const, status: res.status };
  const j = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const text = j?.choices?.[0]?.message?.content ?? "";
  return { ok: true as const, text };
}

export async function POST(req: Request) {
  const key = process.env.XEVYO_API_KEY;
  if (!key) return json({ fallback: true, reason: "not-configured" }, 503);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "too-large" }, 413);
  let payload: {
    mode?: "chat" | "word" | "extract";
    messages?: { role: string; content: string }[];
    facts?: string[];
    language?: string;
    context?: Record<string, unknown>;
    suggestion?: { title: string; body: string; why: string[] };
    text?: string;
    persona?: { name?: string; title?: string; briefing?: string };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  const mode = payload.mode ?? "chat";
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(`${ip}:${mode}`, mode === "chat" ? 20 : 30)) return json({ fallback: true, reason: "rate-limited" }, 429);

  const lang = LANG_NAME[payload.language ?? (payload.context as { personal?: { language?: string } } | undefined)?.personal?.language ?? "en"] ?? "English";
  const facts = (payload.facts ?? []).filter((f) => typeof f === "string").slice(0, 50).map((f) => f.slice(0, 300));

  /* -------------------------- word: agent suggestion -------------------------- */
  if (mode === "word") {
    const sg = payload.suggestion;
    if (!sg?.title || !sg.body) return json({ error: "no-suggestion" }, 400);
    const r = await complete(
      key,
      [
        {
          role: "system",
          content: `You rewrite short in-app suggestions for a women's health app so they feel personal and warm. Rules: 1–2 sentences, under 45 words, reply in ${lang}. Keep every number, date and unit exactly as given. Do not add any new fact, number, advice, diagnosis, medicine or dose. Do not use the words "I noticed" more than once. Return only the rewritten sentences.`,
        },
        { role: "user", content: `Title: ${sg.title}\nSuggestion: ${sg.body}\nWhy (her data): ${(sg.why ?? []).join("; ")}` },
      ],
      { maxTokens: 120, timeout: 20_000 },
    ).catch(() => null);
    if (!r) return json({ fallback: true, reason: "unreachable" }, 503);
    if (!r.ok) return json({ fallback: true, reason: reasonFor(r.status) }, 503);
    return json({ text: r.text.trim() });
  }

  /* ------------------------- extract: lab report text ------------------------- */
  if (mode === "extract") {
    const text = (payload.text ?? "").slice(0, 20_000);
    if (text.trim().length < 20) return json({ error: "no-text" }, 400);
    const r = await complete(
      key,
      [
        {
          role: "system",
          content:
            'You extract laboratory results from the text of a lab report. Return ONLY a JSON object: {"collected":"YYYY-MM-DD or null","results":[{"test":"name as printed","value":number,"unit":"unit as printed","low":number or null,"high":number or null}]}. Copy every number exactly as printed. Only include rows that have a numeric result. Never guess or calculate. No commentary.',
        },
        { role: "user", content: text },
      ],
      { json: true, maxTokens: 1200, timeout: 30_000 },
    ).catch(() => null);
    if (!r) return json({ fallback: true, reason: "unreachable" }, 503);
    if (!r.ok) return json({ fallback: true, reason: reasonFor(r.status) }, 503);
    const m = r.text.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
    try {
      return json(JSON.parse(m ? m[0] : r.text));
    } catch {
      return json({ fallback: true, reason: "bad-output" }, 503);
    }
  }

  /* --------------------------------- chat --------------------------------- */
  const turns = (payload.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }));
  if (!turns.length) return json({ error: "no-question" }, 400);

  const about = facts.length
    ? `\n\nFacts about her (from OVEREO, her own data):\n- ${facts.join("\n- ")}`
    : payload.context
      ? `\n\nContext (JSON):\n${JSON.stringify(payload.context).slice(0, 9000)}`
      : "\n\nNo personal data is available for this question — answer in general terms and say so.";
  // the OVEREO team agent whose job this question is
  const ps = payload.persona;
  const persona = ps?.name && /^[A-Za-z ]{2,20}$/.test(ps.name) ? `\n\nYou are answering as ${ps.name}, the ${String(ps.title ?? "").slice(0, 40)} on the OVEREO team. ${String(ps.briefing ?? "").slice(0, 600)}` : "";
  const system = `${RULES}${persona}\n- Reply in ${lang}.${about}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.3,
        messages: [{ role: "system", content: system }, ...turns],
        assistant_name: "Overeo SI",
        company_name: "OVEREO",
        ...(PROJECT ? { project_id: PROJECT } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return json({ fallback: true, reason: "unreachable" }, 503);
  }

  if (!upstream.ok || !upstream.body) return json({ fallback: true, reason: reasonFor(upstream.status), status: upstream.status }, 503);

  // Xevyo streams OpenAI-style server-sent events; pass on just the text.
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  const encd = new TextEncoder();
  let buf = "";
  const stream = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          ctrl.close();
          return;
        }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        let out = "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            if (out) ctrl.enqueue(encd.encode(out));
            ctrl.close();
            void reader.cancel();
            return;
          }
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (typeof delta === "string") out += delta;
          } catch {}
        }
        if (out) {
          ctrl.enqueue(encd.encode(out));
          return;
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-si-source": "xevyo" } });
}
