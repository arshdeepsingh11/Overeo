/* =====================================================================
   POST /api/si — Overeo SI's live brain, powered by Xevyo (in-house AI).

   - The Xevyo key lives ONLY here, on the server (XEVYO_API_KEY). The
     browser never sees it.
   - The browser sends her question, the last few turns and a compact,
     de-identified summary of what OVEREO has learned (patterns, not raw
     logs). We add OVEREO's safety rules and her language, stream Xevyo's
     reply back as plain text.
   - If Xevyo is unavailable (not configured, quota, outage) we answer 503
     with { fallback: true, reason } and SI answers on the device instead.
   ===================================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = (process.env.XEVYO_BASE_URL || "https://chat.xevyo.com/xevyo/v1").replace(/\/+$/, "");
const MODEL = process.env.XEVYO_MODEL || "xevyo";
const PROJECT = process.env.XEVYO_PROJECT_ID || "";
const MAX_BODY = 48_000;

const LANG_NAME: Record<string, string> = { en: "English", es: "Spanish", fr: "French", pt: "Portuguese", de: "German", hi: "Hindi", pa: "Punjabi (Gurmukhi script)", zh: "Simplified Chinese" };

const RULES = `You are Overeo SI, the personal health companion inside OVEREO — a women's precision-health app by BioAro.
Safety and honesty rules (always follow):
- Educational support only. Never diagnose. Never give medication doses or tell her to start or stop a medicine.
- Emergencies first: chest pain, trouble breathing, signs of stroke, fainting, very heavy uncontrolled bleeding, severe sudden pain, or thoughts of self-harm → tell her to call local emergency services now, before anything else.
- Personal: use the personal context below — her patterns, cycle, labs and goals — and speak to HER ("you"). Mention the specific pattern you are using.
- If something isn't in the context, say you don't know it yet and what she could log. Never invent values or dates.
- Read every hormone or lab value in the light of her cycle day and life stage.
- Be warm, clear and brief: 2–5 short sentences, then up to 3 short bullet points if useful. No jargon without a plain explanation.
- When it helps, suggest one question to ask a clinician and which OVEREO team could help (NEYU Health, BioAro Labs, Advanced Cardiology, NEA, Biongevity).`;

/* a light per-instance rate limit — the real one belongs in the API gateway */
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const xs = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  xs.push(now);
  hits.set(ip, xs);
  return xs.length > 20;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function GET() {
  return json({ live: !!process.env.XEVYO_API_KEY });
}

export async function POST(req: Request) {
  const key = process.env.XEVYO_API_KEY;
  if (!key) return json({ fallback: true, reason: "not-configured" }, 503);

  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(ip)) return json({ fallback: true, reason: "rate-limited" }, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "too-large" }, 413);
  let payload: { messages?: { role: string; content: string }[]; context?: Record<string, unknown> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "bad-json" }, 400);
  }

  const turns = (payload.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!turns.length) return json({ error: "no-question" }, 400);

  const ctx = payload.context ?? {};
  const personal = (ctx as { personal?: { language?: string } }).personal;
  const lang = LANG_NAME[personal?.language ?? "en"] ?? "English";
  const system = `${RULES}\n- Reply in ${lang}.\n\nContext (JSON):\n${JSON.stringify(ctx).slice(0, 9000)}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
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

  if (!upstream.ok || !upstream.body) {
    const reason = upstream.status === 402 ? "quota" : upstream.status === 401 || upstream.status === 403 ? "auth" : upstream.status === 429 ? "rate-limited" : "upstream";
    return json({ fallback: true, reason, status: upstream.status }, 503);
  }

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
