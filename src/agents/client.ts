import { space } from "../personal/space";
import { factsFor, model, think } from "../personal/mind";
import { cooling, coolDown, REASON } from "../personal/mind/live";
import { compose, guarded, plan, prepare, scoreAgents, type AgentReply, type Source } from "./engine";
import { teamById, type TeamId } from "./team";
import { verifyNotes } from "./validate";

/* =====================================================================
   The team, from her device.

   talk()     one agent:
                1. the guard runs here first (instant, no network)
                2. her own data → OVEREO Mind answers instantly ("device")
                3. otherwise the live brain via /api/agents/chat ("live")
                4. if that's off or fails → OVEREO's passages ("demo"/"fallback")
   runTeam()  several agents on one request, streamed; if the server can't
              run it, the same plan runs on the device and says "demo".
   ===================================================================== */

export type ReplyMode = AgentReply["mode"] | "device" | "instant" | "guides";
export type Reply = Omit<AgentReply, "mode"> & { mode: ReplyMode };

const LIVE = process.env.NEXT_PUBLIC_SI_LIVE !== "0";

/** Mind intents each agent owns — so LUNA answers cycle questions from her data. */
const OWNS: Record<string, TeamId[]> = {
  period_next: ["cycle"],
  cycle_phase: ["cycle"],
  cycle_regular: ["cycle"],
  symptom: ["cycle", "meno", "visit"],
  fertile: ["fertility", "cycle"],
  pregnant: ["fertility", "cycle"],
  mood: ["mood"],
  sleep: ["mood"],
  tired: ["mood", "labs"],
  whatif: ["mood"],
  lab: ["labs", "fertility"],
  labs_all: ["labs"],
  tests: ["labs"],
  bp: ["visit"],
  visit: ["visit"],
  meds: ["meds"],
  overview: ["cycle", "mood", "labs", "visit", "reminders", "meds", "fertility", "meno"],
  learned: ["cycle", "mood", "labs", "visit", "reminders", "meds", "fertility", "meno"],
};

/**
 * Who should answer this? The agent whose job it is: first from what
 * OVEREO Mind understood, then from the words she used. null = nobody
 * in particular (Overeo SI answers).
 */
export function pickAgent(q: string, intent?: string): TeamId | null {
  // asking for a reminder is always PIP's job, whatever it's about
  if (/^\s*(please\s+)?(remind me|set (a|up a) reminder|nudge me)\b/i.test(q)) return "reminders";
  const ranked = scoreAgents(q);
  const top = ranked[0];
  const owners = intent ? OWNS[intent] : undefined;
  if (owners && owners.length <= 3) {
    // the owner the words agree with most, else the first owner
    const best = owners.map((id) => ({ id, s: ranked.find((x) => x.a.id === id)?.s ?? 0 })).sort((a, b) => b.s - a.s)[0];
    if (top && top.s >= best.s + 2) return top.a.id;
    return best.id;
  }
  return top && top.s >= 1 ? top.a.id : null;
}

function context(q: string) {
  const s = space.get();
  const personalise = s.account?.consent.personalise !== false;
  const { u, a, m } = think(q, s);
  return { facts: personalise ? factsFor(m, u) : [], mind: personalise ? a : null, intent: u.intent, lang: s.prefs.lang };
}

/**
 * In a live chat: should someone else take this question? Stays with the
 * current agent unless the question is clearly another agent's job.
 */
export function routeTo(q: string, current: TeamId): TeamId {
  if (!q.trim() || teamById(current)?.networkOnly) return current;
  let intent: string | undefined;
  try {
    intent = context(q).intent;
  } catch {}
  if (intent === "emergency") return current;
  const next = pickAgent(q, intent);
  if (!next || next === current) return current;
  if (next === "reminders") return next;
  const owners = intent ? OWNS[intent] : undefined;
  // her data question belongs first to its owner (fertile window → BLOOM)
  if (owners && owners.length <= 3 && owners[0] === next) return next;
  const ranked = scoreAgents(q);
  const mine = ranked.find((x) => x.a.id === current)?.s ?? 0;
  const theirs = ranked.find((x) => x.a.id === next)?.s ?? 0;
  // otherwise a clear win only — follow-ups like "why?" stay put
  return theirs >= Math.max(1, mine + 1) ? next : current;
}

export async function talk(agentId: TeamId, history: { role: "user" | "assistant"; content: string }[], opts: { deeper?: boolean; signal?: AbortSignal; onInstant?: (r: Reply) => void } = {}): Promise<Reply> {
  const q = history[history.length - 1].content;
  const { facts, mind, intent, lang } = context(q);
  const p = prepare(agentId, q, facts);
  if (!p.guard.ok) return guarded(p);

  // her own data, answered on the device
  const owns = OWNS[intent]?.includes(agentId);
  if (!opts.deeper && mind && mind.personal && mind.confidence >= 0.55 && owns && lang === "en")
    return { agent: agentId, text: compose(p, { mind }), mode: "device", sources: [{ source: "Your data" }, ...p.sources.filter((x) => x.source !== "Your data").slice(0, 2)], actions: p.actions, handoff: p.handoff, flags: { unverified: [] } };

  const offline = (reason: string): Reply => ({
    agent: agentId,
    text: compose(p, { mind: owns && mind?.personal ? mind : null }),
    mode: reason === "not-configured" ? "demo" : "fallback",
    sources: p.sources,
    actions: p.actions,
    handoff: p.handoff,
    flags: { unverified: [] },
    note: reason === "not-configured" ? "Demo — answered from OVEREO's own content on this device." : `${REASON[reason] ?? REASON.upstream} — answered from OVEREO's own content on this device.`,
  });
  if (!LIVE) return offline("not-configured");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return offline("offline");
  if (cooling()) return offline("upstream");
  // answer straight away from OVEREO's guides; the live brain's fuller answer replaces it when ready
  if (opts.onInstant) {
    const now = offline("upstream");
    if (!now.text.startsWith("That isn't in what I know yet")) opts.onInstant({ ...now, mode: "instant", note: undefined });
  }
  try {
    const res = await fetch("/api/agents/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agentId, messages: history.slice(-8), facts, language: lang }), signal: opts.signal ?? AbortSignal.timeout(15_000) });
    const j = (await res.json().catch(() => ({}))) as Partial<AgentReply> & { fallback?: boolean; reason?: string };
    if (!res.ok || j.fallback || typeof j.text !== "string") {
      const reason = j.reason ?? (res.status === 404 || res.status === 405 ? "not-configured" : "upstream");
      if (reason !== "checked") coolDown(reason === "quota" ? 10 * 60_000 : reason === "not-configured" ? 30 * 60_000 : 60_000);
      return offline(reason);
    }
    return j as Reply;
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    return offline("unreachable");
  }
}

/* ------------------------------ team runs ------------------------------ */

export type TeamEvent =
  | { type: "plan"; stages: TeamId[] }
  | { type: "stage_start"; agent: TeamId }
  | { type: "stage_done"; agent: TeamId; summary: string; sources?: Source[] }
  | { type: "verify"; kept: number; removed: number; removedText?: string[]; notes?: { agent: TeamId; text: string }[] }
  | { type: "final"; text: string; mode: ReplyMode; sources: Source[]; flags: { unverified: number[] }; note?: string; guard?: string }
  | { type: "error"; reason: string; agent?: TeamId };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runTeam(request: string, on: (e: TeamEvent) => void, signal?: AbortSignal): Promise<void> {
  const { facts, lang } = context(request);
  if (LIVE && !cooling() && (typeof navigator === "undefined" || navigator.onLine !== false)) {
    try {
      const res = await fetch("/api/agents/network", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request, facts, language: lang }), signal });
      if (res.ok && res.body && /ndjson/.test(res.headers.get("content-type") ?? "")) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let error: string | null = null;
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.trim()) continue;
            const e = JSON.parse(l) as TeamEvent;
            if (e.type === "error") error = e.reason;
            else on(e);
            if (e.type === "final") finished = true;
          }
        }
        if (finished) return;
        // a stage failed: say so, then let the device finish the job
        coolDown(error === "quota" ? 10 * 60_000 : 60_000);
        return demoTeam(request, on, `${REASON[error ?? "upstream"] ?? REASON.upstream} — the team finished on this device.`);
      }
      const j = (await res.json().catch(() => ({}))) as { reason?: string };
      const reason = j.reason ?? (res.status === 404 || res.status === 405 ? "not-configured" : "upstream");
      coolDown(reason === "not-configured" ? 30 * 60_000 : 60_000);
      return demoTeam(request, on, reason === "not-configured" ? undefined : `${REASON[reason] ?? REASON.upstream} — the team worked on this device.`);
    } catch (e) {
      if (signal?.aborted) return;
      void e;
      return demoTeam(request, on, `${REASON.unreachable} — the team worked on this device.`);
    }
  }
  return demoTeam(request, on);
}

/** The same plan, run on her device from OVEREO's content and her data. */
export async function demoTeam(request: string, on: (e: TeamEvent) => void, note?: string) {
  const { facts, mind, intent } = context(request);
  const s0 = prepare("si", request, facts);
  if (!s0.guard.ok) {
    const g = guarded(s0);
    on({ type: "final", text: g.text, mode: "guarded", sources: [], flags: { unverified: [] }, guard: g.guard });
    return;
  }
  const stages = plan(request);
  on({ type: "plan", stages });
  const specialists = stages.filter((x) => x !== "ora" && x !== "si");
  const notes: { agent: TeamId; text: string; context: string; sources: Source[] }[] = [];
  for (const a of specialists) {
    on({ type: "stage_start", agent: a });
    await wait(260);
    const p = prepare(a, request, facts);
    const own = OWNS[intent]?.includes(a) && mind?.personal ? mind : null;
    const text = compose(p, { mind: own });
    notes.push({ agent: a, text, context: `${p.context}\n${own ? `${own.text} ${(own.points ?? []).join(" ")}` : ""}`, sources: p.sources });
    on({ type: "stage_done", agent: a, summary: "Notes sent to ORA for checking.", sources: p.sources });
  }
  on({ type: "stage_start", agent: "ora" });
  await wait(220);
  let removed = 0;
  const verified = notes.map((n) => {
    const v = verifyNotes(n.text, `${n.context}\n${request}`);
    removed += v.removed.length;
    return { ...n, text: v.kept };
  });
  on({ type: "verify", kept: verified.length, removed, notes: verified.map((n) => ({ agent: n.agent, text: n.text.slice(0, 500) })) });
  on({ type: "stage_done", agent: "ora", summary: removed ? `Removed ${removed} unsupported statement${removed === 1 ? "" : "s"}.` : "Every statement checked out." });
  on({ type: "stage_start", agent: "si" });
  await wait(200);
  const text = verified
    .filter((n) => n.text)
    .map((n) => `${teamById(n.agent)!.name} — ${n.text}`)
    .join("\n\n");
  const seen = new Set<string>();
  const sources = verified.flatMap((n) => n.sources).filter((x) => (seen.has(x.source) ? false : (seen.add(x.source), true))).slice(0, 6);
  on({ type: "stage_done", agent: "si", summary: "Answer ready." });
  on({ type: "final", text: text || "That isn't in what the team knows yet.", mode: note ? "fallback" : "demo", sources, flags: { unverified: [] }, note: note ?? "Demo — the team worked from OVEREO's own content and your data, on this device." });
}

/** Facts the team would share about her right now (for transparency in the UI). */
export const sharedFacts = () => (space.get().account?.consent.personalise === false ? [] : factsFor(model()));
