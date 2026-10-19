// =====================================================================
// Overeo SI — optional live-model proxy (zero dependencies, Node 18+).
//
// The frontend works fully without this: Overeo SI answers on-device.
// Run this when you want open-ended answers from a live model:
//
//   ANTHROPIC_API_KEY=sk-... npm run si-proxy
//   NEXT_PUBLIC_SI_ENDPOINT=http://localhost:8787/si npm run dev
//
// The API key stays on the server. The browser sends the question plus a
// small, de-identified context (section, cycle day, markers, signals);
// this proxy streams plain text back. Replace with your backend later.
// =====================================================================

import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.SI_MODEL || "claude-sonnet-5-5";
const ORIGIN = process.env.SI_ALLOW_ORIGIN || "*";

const SYSTEM = `You are Overeo SI ("Symbiotic Intelligence"), the assistant inside OVEREO, a women's precision-health platform built with BioAro Labs and NEYU Health.
Rules:
- Educational only. Never diagnose, never give medication doses, never promise outcomes.
- Safety first: if someone describes chest pain, trouble breathing, stroke signs, heavy uncontrolled bleeding or thoughts of self-harm, tell them to contact emergency services (911 in Canada/US) now.
- Read every value in the context of cycle phase and life stage, and say when a result needs the cycle day to be interpreted.
- Be warm, plain-spoken and brief: 2–5 sentences, then at most 3 short bullet points if useful.
- When relevant, suggest one or two questions to ask a clinician, and route to the in-house team (NEYU Virtual Care, BioAro Labs, Advanced Cardiology/endocrinology, BioMynd, NEA, Biongevity).
- Use only the context provided about the person; if something is missing, say what you'd need.`;

if (!KEY) {
  console.error("Set ANTHROPIC_API_KEY to run the Overeo SI proxy.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.end();
  if (req.method !== "POST" || !req.url?.startsWith("/si")) {
    res.statusCode = 404;
    return res.end("Not found");
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64_000) {
      res.statusCode = 413;
      return res.end("Too large");
    }
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.statusCode = 400;
    return res.end("Bad JSON");
  }
  const messages = (payload.messages || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10);
  const context = JSON.stringify(payload.context ?? {}, null, 0).slice(0, 6000);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      stream: true,
      system: `${SYSTEM}\n\nCurrent OVEREO context (sample data unless stated): ${context}`,
      messages,
    }),
  }).catch((e) => ({ ok: false, status: 502, text: async () => String(e) }));

  if (!upstream.ok || !upstream.body) {
    res.statusCode = 502;
    return res.end(`Upstream error: ${upstream.status}`);
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
  // Translate the SSE stream into plain text deltas.
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") res.write(ev.delta.text);
      } catch {}
    }
  }
  res.end();
});

server.listen(PORT, () => console.log(`Overeo SI proxy on http://localhost:${PORT}/si (model ${MODEL})`));
