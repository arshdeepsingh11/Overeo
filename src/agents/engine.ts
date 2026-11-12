import { SPECIALISTS, SHARED_LIMITS, SITE_MAP, TEAM, allowedRoute, teamById, type TeamAgent, type TeamId } from "./team";
import { guard, type GuardResult } from "./guard";
import { factPassages, retrieve, tokens } from "./retrieval";
import type { Passage } from "./corpus";

/* =====================================================================
   Shared engine — the same steps run on the server (live) and on her
   device (demo / fallback), so both behave alike:

     guard → retrieve (her facts + OVEREO passages) → prompt or compose
       → validate → answer { text, mode, sources, actions, handoff }
   ===================================================================== */

export type Mode = "live" | "demo" | "fallback" | "guarded";

export interface Source {
  source: string;
  href?: string;
}

export interface AgentReply {
  agent: TeamId;
  text: string;
  mode: Mode;
  sources: Source[];
  actions: { label: string; route: string }[];
  handoff?: { id: TeamId; name: string; title: string };
  flags: { unverified: number[] };
  /** why the live brain wasn't used, in plain words */
  note?: string;
  guard?: string;
}

export interface Prepared {
  agent: TeamAgent;
  question: string;
  guard: GuardResult;
  passages: Passage[];
  context: string;
  sources: Source[];
  actions: { label: string; route: string }[];
  handoff?: AgentReply["handoff"];
}

/* ------------------------------ planner ------------------------------ */

/** How well each specialist matches a request (keyword hits + area words). */
export function scoreAgents(text: string): { a: TeamAgent; s: number }[] {
  const low = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
  const toks = new Set(tokens(text));
  return SPECIALISTS.map((a) => {
    let s = 0;
    for (const k of a.keys) {
      if (k.includes(" ") ? low.includes(` ${k} `) : low.includes(` ${k} `) || toks.has(k)) s += k.includes(" ") ? 2 : 1;
    }
    return { a, s };
  }).sort((x, y) => y.s - x.s);
}

export function plan(request: string, max = 3): TeamId[] {
  const ranked = scoreAgents(request).filter((x) => x.s > 0);
  const picked = ranked.length ? ranked.filter((x, i) => i === 0 || x.s >= Math.max(1, ranked[0].s * 0.3)).slice(0, max).map((x) => x.a.id) : (["visit"] as TeamId[]);
  return [...picked, "ora", "si"];
}

/* ------------------------------ prepare ------------------------------ */

const ROUTE_HINTS: [RegExp, string][] = [
  [/\b(period|cycle|late)\b/, "/app/track?t=period_start"],
  [/\b(symptom|pain|cramp|headache|bloat)/, "/app/track?t=symptom"],
  [/\b(mood|sad|low|anxious|stress)/, "/app/track?t=mood"],
  [/\b(sleep|tired|insomnia)/, "/app/track?t=sleep_duration"],
  [/\b(blood pressure|bp)\b/, "/app/track?t=blood_pressure"],
  [/\b(lab|result|ferritin|vitamin|amh|tsh|test)/, "/app/track?t=lab_result"],
  [/\b(doctor|visit|appointment|specialist|clinician)/, "/app/visit"],
  [/\b(medicine|medication|pill|pharmacist)/, "/app/track?t=medication"],
];

export function prepare(agentId: TeamId, question: string, facts: string[] = []): Prepared {
  const agent = teamById(agentId) ?? TEAM[0];
  const g = guard(question, agent);
  const hits = g.ok ? retrieve(question, 6, { boostTags: agent.tags, extra: factPassages(facts) }) : [];
  // a couple of her facts always ride along (cycle day, goals) when nothing about her matched
  const mine = hits.filter((h) => h.p.id.startsWith("you")).map((h) => h.p);
  const facts0 = mine.length ? [] : factPassages(facts).slice(0, 2);
  // her facts lead the context, then OVEREO's passages
  const passages = [...mine, ...facts0, ...hits.filter((h) => !h.p.id.startsWith("you")).map((h) => h.p)];
  const context = passages.map((p, i) => `[${i + 1}] (${p.source}) ${p.text}`).join("\n");
  const seen = new Set<string>();
  const sources = passages
    .filter((p) => p.source !== "Your data")
    .filter((p) => (seen.has(p.source) ? false : (seen.add(p.source), true)))
    .slice(0, 4)
    .map((p): Source => ({ source: p.source, href: p.href }));
  if (mine.length || facts0.length) sources.unshift({ source: "Your data" });

  // buttons: only routes from the site map
  const low = question.toLowerCase();
  const routes = new Set<string>();
  ROUTE_HINTS.forEach(([re, r]) => re.test(low) && routes.add(r));
  passages.forEach((p) => p.href && allowedRoute(p.href) && routes.add(p.href));
  const actions = [...routes].slice(0, 3).map((r) => ({ route: r, label: SITE_MAP.find((x) => x.route === r)!.label }));

  // hand-off: a teammate clearly fits better
  const ranked = scoreAgents(question);
  const top = ranked[0];
  const mineScore = ranked.find((x) => x.a.id === agent.id)?.s ?? 0;
  const handoff = top && top.a.id !== agent.id && top.s >= 2 && top.s >= mineScore + 2 ? { id: top.a.id, name: top.a.name, title: top.a.title } : undefined;

  return { agent, question, guard: g, passages, context, sources, actions, handoff };
}

/* ------------------------------ prompt ------------------------------ */

export function systemPrompt(agent: TeamAgent, context: string, language = "English") {
  const roster = SPECIALISTS.filter((a) => a.id !== agent.id)
    .map((a) => `- ${a.name} (${a.title}): ${a.does.slice(0, 3).join(", ")}`)
    .join("\n");
  return [
    `You are ${agent.name}, the ${agent.title} on OVEREO, a women's health app. Personality: ${agent.personality}`,
    `Your job: ${agent.role} You cover: ${agent.does.join("; ")}. Not yours: ${agent.doesNot.join("; ")}.`,
    agent.briefing,
    `Rules:\n- ${SHARED_LIMITS.join("\n- ")}`,
    `Your teammates:\n${roster}`,
    `Reply in ${language}. Speak to her as "you".`,
    `Context (the only things you may state as fact; "Your data" lines are about her):\n${context || "(nothing relevant found)"}`,
  ].join("\n\n");
}

/* ------------------------------ compose (no model) ------------------------------ */

const firstSentences = (t: string, n: number) => (t.match(/[^.!?]+[.!?]+/g) ?? [t]).slice(0, n).join(" ").trim();

/** An answer built only from the passages — used when the live brain is off or fails. */
export function compose(p: Prepared, opts: { mind?: { title: string; text: string; points?: string[] } | null } = {}): string {
  if (opts.mind) {
    const pts = (opts.mind.points ?? []).slice(0, 3);
    return [opts.mind.text, ...pts.map((x) => `• ${x}`)].join("\n");
  }
  const own = p.passages.filter((x) => x.source !== "Your data");
  if (!own.length) return `That isn't in what I know yet. ${p.handoff ? `${p.handoff.name}, your ${p.handoff.title.toLowerCase()}, may know more.` : `I can help with ${p.agent.does.slice(0, 2).join(" or ")}.`}`;
  const lines = own.slice(0, 2).map((x) => firstSentences(x.text, 2));
  return lines.join("\n\n");
}

export function guarded(p: Prepared): AgentReply {
  const g = p.guard as Extract<GuardResult, { ok: false }>;
  return {
    agent: p.agent.id,
    text: g.reply,
    mode: "guarded",
    sources: [],
    actions: (g.routes ?? []).filter(allowedRoute).map((r) => ({ route: r, label: SITE_MAP.find((x) => x.route === r)!.label })),
    flags: { unverified: [] },
    guard: g.category,
  };
}
