import { store } from "../core/store";
import { derive } from "../core/derived";
import { labelFor } from "../core/bus";
import { localAnswer } from "./engine";
import type { SIAnswer, SIContext, SIMessage } from "./types";
import { noteTopic, space } from "../personal/space";
import { learn, siContext } from "../personal/patterns";
import { think, factsFor } from "../personal/mind";
import type { MindAnswer } from "../personal/mind/answer";
import { askLive, LIVE_ENDPOINT, REASON, coolDown, cooling } from "../personal/mind/live";
import { pickAgent } from "../agents/client";
import { teamById, type TeamId } from "../agents/team";
import { compose, prepare } from "../agents/engine";

/* ------------------------------------------------------------------ *
 * Provider — who answers.
 *
 * In her space (/app):
 *   1. Safety first: emergencies are answered on the device, instantly.
 *   2. OVEREO Mind answers anything her own data can answer — instantly,
 *      on the device, with "Why this?".
 *   3. Open questions (or "explain more") go to the live brain (Xevyo)
 *      with only the facts Mind chooses — checked before she sees them.
 *   4. If the live brain is unavailable or fails a check, she still gets
 *      the best on-device answer, and is told why.
 * On the public site, the original demo engine answers about Maya.
 * Set NEXT_PUBLIC_SI_LIVE=0 to stay fully on-device.
 * ------------------------------------------------------------------ */

export const siMode = LIVE_ENDPOINT ? "live" : "local";

/** Compact, de-identified context for the public demo (Maya's persona). */
export function contextPayload(ctx: SIContext) {
  const s = store.get();
  const d = derive(s.profile, s.levers);
  return {
    section: labelFor(ctx.section),
    profile: ctx.useProfile
      ? {
          sample: s.profile.isSample,
          age: s.profile.age,
          cycleDay: d.today.cycleDay,
          phase: d.today.phase,
          meanCycle: d.today.meanLength,
          ovarianClock: { markerAge: d.clock.markerAge, calendarAge: d.clock.calendarAge, band: d.clock.band },
          labs: s.profile.labs.map((l) => ({ name: l.name, unit: l.unit, latest: l.points[l.points.length - 1].value })),
        }
      : null,
    signals: ctx.useSignals ? d.signals.map((x) => ({ title: x.title, level: x.level, strength: x.strength, evidence: x.evidence })) : null,
    personal: (() => {
      const sp = space.get();
      if (!sp.ready) return null;
      const base = siContext(sp, learn(sp));
      return ctx.useProfile && sp.account?.consent.personalise !== false ? base : { language: base.language };
    })(),
  };
}

const INTENT_LABEL: Record<string, string> = {
  period_next: "your next period",
  cycle_phase: "where you are in your cycle",
  cycle_regular: "how regular your cycles are",
  fertile: "your fertile window",
  symptom: "your symptoms",
  mood: "your mood",
  sleep: "your sleep",
  tired: "your energy",
  lab: "your lab result",
  labs_all: "your lab results",
  bp: "your blood pressure",
  whatif: "a what-if",
  overview: "how you're doing",
  learned: "what OVEREO knows",
  visit: "your visit summary",
  tests: "useful tests",
};

/** Turn a Mind answer into the SI reply format. */
export function fromMind(a: MindAnswer, q: string, records: number): SIAnswer {
  return {
    title: a.title,
    summary: a.text,
    points: a.points?.filter(Boolean),
    used: a.evidence.map((e) => e.label),
    tone: a.tone ?? "info",
    source: "mind",
    intent: a.intent,
    confidence: a.confidence,
    why: a.evidence,
    mindActions: a.actions,
    followUps: a.followUps,
    outcome: a.outcome,
    question: q,
    trace: a.intent === "emergency" ? undefined : ["Understanding your question", `Reading ${records} of your records`, `Checking ${INTENT_LABEL[a.intent] ?? "your patterns"}`],
  };
}

const inPortal = () => typeof location !== "undefined" && /^\/app(\/|$)/.test(location.pathname) && !/^\/app\/(welcome|signin)/.test(location.pathname);

/**
 * Answer a question. `onText` receives streamed text (live answers).
 */
export interface AskHooks {
  /** the agent who takes the question — known instantly, before any answer */
  onAgent?: (agentId: string | null) => void;
  /** an instant answer from the device while the live brain adds detail */
  onInstant?: (a: SIAnswer) => void;
}

export async function ask(
  q: string,
  ctx: SIContext,
  history: SIMessage[],
  onText: (t: string) => void,
  signal?: AbortSignal,
  hooks: AskHooks = {},
): Promise<{ answer: SIAnswer; remote: boolean }> {
  const sp = space.get();
  if (inPortal() && sp.ready) {
    // the agent whose job this is answers (and its persona guides the live brain)
    return askPersonal(q, ctx, history, onText, signal, hooks);
  }
  return askDemo(q, ctx, history, onText, signal);
}

/* ------------------------------ her space ------------------------------ */

async function askPersonal(raw: string, ctx: SIContext, history: SIMessage[], onText: (t: string) => void, signal?: AbortSignal, hooks: AskHooks = {}): Promise<{ answer: SIAnswer; remote: boolean }> {
  const sp = space.get();
  const explain = raw.match(/^explain more(?: about)?:\s*(.+)$/i);
  const q = explain ? explain[1] : raw;
  const { u, a: mind, m } = think(q, sp);
  const agentId = u.intent === "emergency" ? null : pickAgent(q, u.intent);
  const agent = agentId ? teamById(agentId) : undefined;
  const tag = <T extends { answer: SIAnswer; remote: boolean }>(r: T): T => ({ ...r, answer: { ...r.answer, agent: agent?.id } });
  hooks.onAgent?.(agent?.id ?? null);
  if (u.intent !== "general") noteTopic(u.intent);
  const records = m.engagement.total;
  const personalise = ctx.useProfile && sp.account?.consent.personalise !== false;

  // 1. emergencies — never wait for a network
  if (u.intent === "emergency" && mind) return { answer: fromMind(mind, q, records), remote: false };
  return tag(await answerAs());
  async function answerAs(): Promise<{ answer: SIAnswer; remote: boolean }> {

  // the site's general knowledge, without the demo persona (never about "her" sample profile)
  let siteCache: SIAnswer | null = null;
  const site = () => (siteCache ??= localAnswer(q, { ...ctx, useProfile: false, useSignals: false }));
  // interface commands ("dark mode", "calm mood") keep working; nothing may navigate her out of her space
  if (u.intent === "general") {
    const cmd = site();
    if (cmd.effects?.length && cmd.effects.every((c) => c.type === "theme" || c.type === "mood")) return { answer: { ...cmd, source: "engine" }, remote: false };
  }

  // she can switch personal context off for a question — then nothing from her data is used
  const a = personalise || ["emergency", "log", "remember", "forget", "help", "greet", "thanks", "safety"].includes(u.intent) ? mind : null;

  // 2. Mind answers what her data can answer — unless she has told us she prefers deeper answers here
  const votes = sp.mind.votes[u.intent];
  const prefersLive = !!votes && votes.down >= 2 && votes.down > votes.up;
  // in another language, the live brain re-tells Mind's grounded answer in her words
  const translate = sp.prefs.lang !== "en" && !!LIVE_ENDPOINT && !cooling() && !!a && a.personal && u.intent !== "log" && u.intent !== "remember";
  const mindFirst = a && a.personal && a.confidence >= 0.55 && !explain && !translate && !(prefersLive && LIVE_ENDPOINT && !cooling());
  if (mindFirst) return { answer: withExplain(fromMind(a, q, records)), remote: false };

  // 3. the live brain, with only the facts Mind shares
  const facts = [
    ...(personalise ? factsFor(m, u) : []),
    ...(a && a.personal ? [`OVEREO's on-device answer to this question (base your reply on it): ${a.title}. ${a.text} ${(a.points ?? []).join(" ")}`.slice(0, 900)] : []),
  ];
  const fallback = (reason: string): { answer: SIAnswer; remote: boolean } => {
    const note = `${REASON[reason] ?? REASON.upstream} — ${translate ? "shown in English, " : ""}answered on this device.`;
    if (a) return { answer: { ...fromMind(a, q, records), limits: note }, remote: false };
    // general knowledge the device has (conditions, tests, OVEREO itself)
    const g = site();
    if (!g.title.startsWith("Let me point") && !g.effects?.length) return { answer: { ...g, source: "engine", limits: [g.limits, note].filter(Boolean).join(" ") }, remote: false };
    return {
      answer: {
        title: "I can't answer that one on the device",
        summary: "That's outside what your own data can tell me, and the live brain isn't available right now. Ask me about your cycle, symptoms, mood, sleep, labs or what-ifs — or try again in a moment.",
        used: ["Your question"],
        limits: note,
        source: "mind",
        intent: "general",
        confidence: 0.2,
        followUps: ["How am I doing?", "When is my next period?", "What have you learned about me?"],
      },
      remote: false,
    };
  };
  if (!LIVE_ENDPOINT) return fallback("not-configured");

  // answer straight away from the device; the live brain adds detail after
  if (hooks.onInstant && !cooling()) {
    let now: SIAnswer | null = a ? fromMind(a, q, records) : null;
    // the agent's own knowledge (OVEREO's checked guides) when her data has nothing to say
    if (!now && agent) {
      const p = prepare(agent.id as TeamId, q, personalise ? factsFor(m, u) : []);
      const text = p.guard.ok ? compose(p) : "";
      if (text && !text.startsWith("That isn't in what I know yet"))
        now = { title: agent.name + " · " + agent.title, summary: text, used: p.sources.map((x) => x.source).slice(0, 3), source: "engine", intent: u.intent, question: q, why: [] };
    }
    if (!now) {
      const g = site();
      if (!g.title.startsWith("Let me point") && !g.effects?.length) now = { ...g, source: "engine" };
    }
    if (now) hooks.onInstant({ ...now, agent: agent?.id, limits: undefined, refining: true });
  }

  const r = await askLive({
    question: q,
    history: history.slice(-8).map((x) => ({ role: x.role === "si" ? "assistant" : "user", content: x.role === "si" ? (x.answer?.summary ?? x.text) : x.text })),
    facts,
    language: sp.prefs.lang,
    persona: agent ? { name: agent.name, title: agent.title, briefing: agent.briefing } : undefined,
    onText,
    signal,
  });
  if (!r.ok) {
    if (r.reason === "checked") coolDown(30_000);
    return fallback(r.reason);
  }
  return {
    remote: true,
    answer: {
      title: a?.title ?? "Overeo SI",
      summary: r.text,
      used: ["Live brain (Xevyo)", ...(facts.length ? [`${facts.length} facts from your data`] : ["General knowledge"])],
      source: "xevyo",
      intent: u.intent,
      confidence: a?.confidence,
      // her on-device evidence, when Mind had some; the shared facts are listed separately
      why: a?.evidence ?? [],
      mindActions: a?.actions,
      sharedFacts: facts,
      question: q,
      limits: "Written by the live brain from the facts shown. Checked for doses, diagnoses and invented numbers.",
    },
  };
}
}

function withExplain(a: SIAnswer): SIAnswer {
  if (!LIVE_ENDPOINT || a.intent === "emergency" || a.intent === "log" || a.intent === "remember") return a;
  return { ...a, followUps: [...(a.followUps ?? []), `Explain more: ${a.question}`].slice(0, 4) };
}

/* ------------------------------ public demo ------------------------------ */

async function askDemo(q: string, ctx: SIContext, history: SIMessage[], onText: (t: string) => void, signal?: AbortSignal): Promise<{ answer: SIAnswer; remote: boolean }> {
  const local = { ...localAnswer(q, ctx), source: "engine" as const };
  const isCommand = !!local.effects?.length;
  if (!LIVE_ENDPOINT || isCommand || local.tone === "alert") return { answer: local, remote: false };
  const fallback = (reason: string) => ({
    answer: { ...local, limits: [local.limits, `${REASON[reason] ?? REASON.upstream} — answered on this device.`].filter(Boolean).join(" ") },
    remote: false,
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) return fallback("offline");
  if (cooling()) return fallback("upstream");
  try {
    const res = await fetch(LIVE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [...history.slice(-8).map((m) => ({ role: m.role === "si" ? "assistant" : "user", content: m.role === "si" ? (m.answer?.summary ?? m.text) : m.text })), { role: "user", content: q }],
        context: contextPayload(ctx),
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      const info = (await res.json().catch(() => ({}))) as { reason?: string };
      const reason = info.reason ?? (res.status === 404 ? "not-configured" : "upstream");
      coolDown(reason === "quota" ? 10 * 60_000 : 2 * 60_000);
      return fallback(reason);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      onText(text);
    }
    return {
      remote: true,
      answer: { ...local, title: local.title.startsWith("Let me point") ? "Overeo SI" : local.title, summary: text.trim(), points: undefined, used: [...new Set(["Live brain (Xevyo)", ...local.used])], missing: undefined, source: "xevyo" },
    };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    coolDown(2 * 60_000);
    return fallback("unreachable");
  }
}
