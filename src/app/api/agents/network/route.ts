import { complete, limited, LANG_NAME } from "@/server/xevyo";
import { cleanFacts, json } from "@/server/agent-input";
import { plan, prepare, systemPrompt, type Source } from "@/agents/engine";
import { teamById, type TeamId } from "@/agents/team";
import { guard } from "@/agents/guard";
import { checkAnswer, verifyNotes } from "@/agents/validate";

/* =====================================================================
   POST /api/agents/network — the team works on one request together.
   Body: { request, facts?: string[], language? }   → NDJSON stream:
     {type:"plan", stages}            who will work, in order
     {type:"stage_start", agent}      an agent starts
     {type:"stage_done", agent, summary, sources}
     {type:"verify", kept, removed}   ORA's check (in code)
     {type:"final", text, mode, sources, flags}
     {type:"error", reason, agent?}   a stage failed → the run stops and says so
   Specialists work in parallel (faster); ORA verifies; SI presents.
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
  const request = typeof b.request === "string" ? b.request.trim().slice(0, 1200) : "";
  if (request.length < 3) return json({ error: "bad-request" }, 400);
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(`network:${ip}`, 6)) return json({ fallback: true, reason: "rate-limited" }, 429);

  const facts = cleanFacts(b.facts);
  const language = LANG_NAME[typeof b.language === "string" ? b.language : "en"] ?? "English";
  const g = guard(request, teamById("si")!);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (e: Record<string, unknown>) => ctrl.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
      try {
        if (!g.ok) {
          send({ type: "final", text: g.reply, mode: "guarded", sources: [], flags: { unverified: [] }, guard: g.category });
          return;
        }
        const stages = plan(request);
        send({ type: "plan", stages });
        const specialists = stages.filter((s) => s !== "ora" && s !== "si") as TeamId[];

        // 1. specialists, in parallel — each sees only its own slice of knowledge
        let failed: { agent: TeamId; reason: string } | null = null;
        const notes: { agent: TeamId; text: string; context: string; sources: Source[] }[] = [];
        specialists.forEach((a) => send({ type: "stage_start", agent: a }));
        await Promise.all(
          specialists.map(async (a) => {
            const p = prepare(a, request, facts);
            const r = await complete(
              [
                { role: "system", content: `${systemPrompt(p.agent, p.context, "English")}\n\nYou are one stage of a team run. Write 2–4 short factual notes for the presenter about YOUR part of the request only, from the context. No greeting.` },
                { role: "user", content: request },
              ],
              { maxTokens: 260, temperature: 0.2, name: p.agent.name },
            );
            if (!r.ok) {
              failed ??= { agent: a, reason: r.reason };
              return;
            }
            notes.push({ agent: a, text: r.text, context: p.context, sources: p.sources });
            // her view shows each note only after ORA has checked it
            send({ type: "stage_done", agent: a, summary: "Notes sent to ORA for checking.", sources: p.sources });
          }),
        );
        if (failed) {
          send({ type: "error", ...(failed as { agent: TeamId; reason: string }) });
          return;
        }

        // 2. ORA verifies every note against what that agent was given
        send({ type: "stage_start", agent: "ora" });
        let removed: string[] = [];
        const verified = notes.map((n) => {
          const v = verifyNotes(n.text, `${n.context}\n${request}`);
          removed = removed.concat(v.removed);
          return { ...n, text: v.kept };
        });
        send({ type: "verify", kept: verified.reduce((a, n) => a + (n.text ? 1 : 0), 0), removed: removed.length, removedText: removed.slice(0, 5), notes: verified.map((n) => ({ agent: n.agent, text: n.text.slice(0, 500) })) });
        send({ type: "stage_done", agent: "ora", summary: removed.length ? `Removed ${removed.length} unsupported statement${removed.length === 1 ? "" : "s"}.` : "Every statement checked out." });

        // 3. SI presents — from the verified notes only
        send({ type: "stage_start", agent: "si" });
        const noteText = verified.map((n) => `${teamById(n.agent)!.name}: ${n.text || "(nothing verified)"}`).join("\n");
        // the presenter may only use what ORA verified
        const allContext = `${noteText}\n${request}`;
        const r = await complete(
          [
            { role: "system", content: `${systemPrompt(teamById("si")!, noteText, language)}\n\nWrite one answer for her from these verified team notes only. Name the teammate when you use their note. 3–6 sentences, then up to 3 bullet points.` },
            { role: "user", content: request },
          ],
          { maxTokens: 420, temperature: 0.25 },
        );
        const sources = dedupe(verified.flatMap((n) => n.sources));
        if (!r.ok) {
          send({ type: "final", text: noteText, mode: "fallback", sources, flags: { unverified: [] }, note: r.reason });
          return;
        }
        const check = checkAnswer(r.text, allContext);
        if (check.banned) {
          send({ type: "final", text: noteText, mode: "fallback", sources, flags: { unverified: [] }, note: "checked" });
          return;
        }
        // ORA's last pass: anything the verified notes don't support is removed
        const last = check.unverified.length ? verifyNotes(r.text, allContext) : { kept: r.text, removed: [] };
        send({ type: "stage_done", agent: "si", summary: "Answer ready." });
        send({ type: "final", text: last.kept.trim() || noteText, mode: last.kept.trim() ? "live" : "fallback", sources, flags: { unverified: check.unverified } });
      } catch {
        send({ type: "error", reason: "upstream" });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

function dedupe(xs: Source[]) {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.source) ? false : (seen.add(x.source), true))).slice(0, 6);
}
