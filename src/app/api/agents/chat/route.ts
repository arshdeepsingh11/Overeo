import { complete, limited, LANG_NAME } from "@/server/xevyo";
import { cleanAgent, cleanFacts, cleanMessages, json } from "@/server/agent-input";
import { guarded, prepare, systemPrompt, type AgentReply } from "@/agents/engine";
import { checkAnswer, verifyNotes } from "@/agents/validate";

/* =====================================================================
   POST /api/agents/chat — talk to one agent.
   Body: { agentId, messages:[{role, content}], facts?: string[], language? }
     guard (no model call) → retrieve → Xevyo → validate → reply
   503 { fallback: true, reason } → the device answers in demo mode.
   ===================================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 40_000) return json({ error: "too-large" }, 413);
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(raw);
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  const agentId = cleanAgent(b.agentId);
  const messages = cleanMessages(b.messages);
  if (!agentId || !messages) return json({ error: "bad-request" }, 400);
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(`agents:${ip}`, 24)) return json({ fallback: true, reason: "rate-limited" }, 429);

  const question = messages[messages.length - 1].content;
  const p = prepare(agentId, question, cleanFacts(b.facts));
  if (!p.guard.ok) return json(guarded(p));

  const language = LANG_NAME[typeof b.language === "string" ? b.language : "en"] ?? "English";
  const r = await complete([{ role: "system", content: systemPrompt(p.agent, p.context, language) }, ...messages], { maxTokens: 380, name: p.agent.name });
  if (!r.ok) return json({ fallback: true, reason: r.reason }, 503);

  const ctx = `${p.context}\n${question}`;
  const check = checkAnswer(r.text, ctx);
  if (check.banned) return json({ fallback: true, reason: "checked" }, 503);
  // a sentence with a figure OVEREO can't back up is removed, and she's told
  const v = check.unverified.length ? verifyNotes(r.text, ctx) : { kept: r.text, removed: [] };
  if (!v.kept.trim()) return json({ fallback: true, reason: "checked" }, 503);
  const reply: AgentReply = { agent: agentId, text: v.kept, mode: "live", sources: p.sources, actions: p.actions, handoff: p.handoff, flags: { unverified: check.unverified } };
  return json(reply);
}
