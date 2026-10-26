import type { IconName } from "../ui/Icon";
import type { Learned } from "./patterns";
import type { SpaceState } from "./space";
import type { AgentId, AgentSettings, Suggestion } from "./types";

/* =====================================================================
   Her agents. Each has ONE job. They never act on their own:
   they propose → she approves (or edits, or dismisses) → it happens →
   the diary records it. Triggers are deterministic code; SI (Xevyo)
   only words things and answers questions.

   Training:
     - her settings (may / never / how often / quiet hours)
     - her "never" rules, matched against every suggestion
     - her reactions: dismissing the same kind twice as "not relevant"
       stops that kind from that agent
   ===================================================================== */

export interface AgentDef {
  id: AgentId;
  name: string;
  icon: IconName;
  job: string;
  hue: number;
  /** shown only when relevant to her goals / stage */
  relevant?: (s: SpaceState) => boolean;
}

export const AGENTS: AgentDef[] = [
  { id: "cycle", name: "Cycle agent", icon: "cycle", hue: 340, job: "Learns your rhythm, predicts your period and gives you a heads-up." },
  { id: "labs", name: "Lab report agent", icon: "flask", hue: 25, job: "Reads your results with you, flags what's out of range and plans retests." },
  { id: "visit", name: "Visit prep agent", icon: "doc", hue: 300, job: "Turns repeating patterns into a one-page summary and questions for your doctor." },
  { id: "reminders", name: "Reminder agent", icon: "bell", hue: 315, job: "Keeps your reminders, at the times you actually check in." },
  { id: "meds", name: "Medicine agent", icon: "pill", hue: 290, job: "Tracks what you take and checks it against your genes and labs." },
  { id: "mood", name: "Mood & sleep agent", icon: "smile", hue: 320, job: "Spots the days that are usually harder for you, before they arrive." },
  {
    id: "fertility",
    name: "Fertility & egg-freezing planner",
    icon: "clock",
    hue: 330,
    job: "Walks you through tests, timing and the questions to ask a clinic.",
    relevant: (s) => !!s.account?.goals.some((g) => g === "fertility" || g === "egg-freezing" || g === "pregnancy"),
  },
  {
    id: "meno",
    name: "Menopause coach",
    icon: "waves",
    hue: 20,
    job: "Tracks hot flashes, sleep and cycle changes, and prepares what to discuss.",
    relevant: (s) => s.account?.stage === "peri" || s.account?.stage === "post" || !!s.account?.goals.includes("menopause"),
  },
];

export const agentById = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

export function defaultAgents(): Record<AgentId, AgentSettings> {
  const base = (on = true): AgentSettings => ({ enabled: on, may: { remind: true, suggestTests: true, summaries: true, notify: true }, never: [], frequency: "important", quiet: { from: 22, to: 7 } });
  return { cycle: base(), labs: base(), visit: base(), reminders: base(), meds: base(), mood: base(), fertility: base(), meno: base() };
}

const DAY = 86_400_000;
const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const at = (d: Date, h: number) => {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return x;
};

type Draft = Omit<Suggestion, "id" | "createdAt" | "status">;

/** What each agent would like to propose right now. */
function propose(s: SpaceState, l: Learned, now: Date): Draft[] {
  const out: Draft[] = [];
  const c = l.cycle;
  const eveningHour = l.memory.some((m) => m.id === "habit-logtime" && m.text.includes("morning")) ? 9 : 20;

  /* cycle */
  if (c.starts.length < 2)
    out.push({ key: "cycle:first-dates", agent: "cycle", kind: "log", title: "Add your last two period dates", body: "That's all I need to start learning your rhythm and predicting your next period.", why: ["No period dates yet — predictions use averages until then"], href: "/app/track?t=period_start" });
  if (c.daysUntil != null && c.daysUntil >= 0 && c.daysUntil <= 3 && c.nextStart) {
    const remind = at(new Date(c.nextStart.getTime() - DAY), eveningHour);
    out.push({
      key: `cycle:heads-up:${c.nextStart.toDateString()}`,
      agent: "cycle",
      kind: "reminder",
      title: c.daysUntil === 0 ? "Your period is likely today" : `Your period is likely in ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}`,
      body: `Around ${fmt(c.nextStart)}. Want a reminder the evening before?`,
      why: [`Your cycles average ${c.avg} days`, `Last period started ${fmt(c.starts[c.starts.length - 1])}`],
      due: (remind > now ? remind : at(now, eveningHour)).toISOString(),
    });
  }
  if (c.daysUntil != null && c.avg && c.daysUntil < -Math.max(3, Math.round((c.sd ?? 2) * 2)))
    out.push({ key: `cycle:late:${c.nextStart?.toDateString()}`, agent: "cycle", kind: "log", title: "Did your period start?", body: `It's ${-c.daysUntil} days past my estimate. Log it, or tell me it hasn't come — both help me learn.`, why: [`Expected around ${c.nextStart ? fmt(c.nextStart) : "now"}`], href: "/app/track?t=period_start" });

  /* labs */
  const unconfirmed = s.records.filter((r) => r.status === "active" && r.confirmationStatus === "unconfirmed");
  if (unconfirmed.length)
    out.push({ key: `labs:confirm:${unconfirmed.length}`, agent: "labs", kind: "log", title: `Confirm ${unconfirmed.length} value${unconfirmed.length === 1 ? "" : "s"} from your report`, body: "Nothing from a report counts until you've checked it.", why: ["Values waiting for your confirmation"], href: "/app/track?review=1" });
  for (const lab of l.latestLabs.filter((x) => x.flag)) {
    const retestDays = /ferritin|vitamin d/i.test(lab.name) ? 84 : 90;
    const due = at(new Date(lab.at.getTime() + retestDays * DAY), 9);
    out.push({
      key: `labs:retest:${lab.name}:${lab.at.toDateString()}`,
      agent: "labs",
      kind: "reminder",
      title: `${lab.name} is ${lab.flag} — plan a retest`,
      body: `${lab.name} ${lab.value} ${lab.unit} (range ${lab.low ?? "?"}–${lab.high ?? "?"}). Worth discussing with your clinician. I can remind you to retest around ${fmt(due < now ? new Date(now.getTime() + 7 * DAY) : due)}.`,
      why: [`Your result from ${fmt(lab.at)}`, lab.first !== lab.value ? `Was ${lab.first} before` : "First result on file"],
      due: (due < now ? new Date(now.getTime() + 7 * DAY) : due).toISOString(),
    });
  }

  /* visit prep */
  const strongSymptom = l.memory.find((m) => m.id.startsWith("sym-") && m.confidence >= 0.6);
  if (strongSymptom)
    out.push({ key: `visit:${strongSymptom.id}`, agent: "visit", kind: "summary", title: "Prepare a visit summary", body: `${strongSymptom.text} I can turn this into a one-page summary with three questions for your doctor.`, why: [strongSymptom.evidence, "Repeating patterns are easier to act on with dates"], href: "/signals?tab=route" });

  /* meds */
  const meds = s.records.filter((r) => r.type === "medication" && r.status === "active");
  const names = [...new Set(meds.map((m) => (m.value as { name: string }).name))];
  const hasRem = (t: string) => s.reminders.some((r) => !r.done && r.title.toLowerCase().includes(t.toLowerCase()));
  for (const nm of names.filter((x) => !hasRem(x)).slice(0, 2))
    out.push({ key: `meds:remind:${nm}`, agent: "meds", kind: "reminder", title: `Daily reminder for ${nm}?`, body: "A gentle reminder at the time you usually check in. I never suggest doses — that stays with your prescriber.", why: [`You logged ${nm}`], due: at(new Date(now.getTime() + DAY), eveningHour).toISOString() });

  /* mood & sleep */
  const dip = l.memory.find((m) => m.id === "mood-premenstrual");
  if (dip && c.daysUntil != null && c.daysUntil >= 1 && c.daysUntil <= 5)
    out.push({ key: `mood:dip:${c.nextStart?.toDateString()}`, agent: "mood", kind: "plan", title: "The next few days are usually harder for you", body: "Plan a lighter few days — earlier nights, fewer late plans. I'll keep watching.", why: [dip.text] });
  const lastMood = s.records.filter((r) => r.type === "mood" && r.status === "active").map((r) => new Date(r.observedAt).getTime()).sort((a, b) => b - a)[0];
  if (s.mode === "real" && (!lastMood || now.getTime() - lastMood > 3 * DAY))
    out.push({ key: `mood:checkin:${now.toDateString()}`, agent: "mood", kind: "log", title: "20-second check-in?", body: "Mood and sleep for today — this is how I learn your patterns.", why: ["No mood check-in for 3 days"], href: "/app/track?t=mood" });

  /* fertility planner */
  const amh = l.latestLabs.find((x) => /amh/i.test(x.name));
  if (s.account?.goals.some((g) => g === "fertility" || g === "egg-freezing"))
    out.push(
      amh
        ? { key: "fertility:questions", agent: "fertility", kind: "summary", title: "Questions for a fertility clinic", body: `Your AMH is ${amh.value} ${amh.unit}. It shows egg quantity, not quality or your chance of pregnancy. I've prepared the questions worth asking.`, why: ["Your fertility goal", "AMH on file"], href: "/clock?tab=planning" }
        : { key: "fertility:amh", agent: "fertility", kind: "test", title: "AMH — when you're ready", body: "AMH helps plan egg freezing. It can be drawn on any cycle day. It doesn't predict natural fertility on its own.", why: ["Your fertility goal", "No AMH on file"], href: "/tests?tab=catalog" },
    );

  /* menopause coach */
  if (agentById("meno").relevant?.(s))
    out.push({ key: "meno:track", agent: "meno", kind: "log", title: "Track hot flashes & sleep for 2 weeks", body: "Two weeks of notes makes a perimenopause conversation far more useful.", why: ["Your life stage"], href: "/app/track?t=symptom" });

  /* weekly recap (Mondays, or after a week of use) */
  if (now.getDay() === 1 || s.mode === "sample")
    out.push({ key: `recap:${weekKey(now)}`, agent: "reminders", kind: "info", title: "Your weekly recap is ready", body: "A two-minute look at your week — what changed and what's coming.", why: ["Every week"], href: "/app/recap" });

  return out;
}

const weekKey = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toDateString();
};

/** Her "never" rules, in her own words, matched against the suggestion text. */
function breaksRule(d: Draft, rules: string[]) {
  const text = `${d.title} ${d.body}`.toLowerCase();
  return rules.some((rule) => {
    const words = rule
      .toLowerCase()
      .replace(/\b(never|don't|do not|mention|talk about|suggest|about|me|any|the|a|an|to)\b/g, " ")
      .split(/\W+/)
      .filter((w) => w.length > 3);
    return words.some((w) => text.includes(w.replace(/s$/, "")));
  });
}

const kindAllowed = (d: Draft, a: AgentSettings) =>
  (d.kind !== "reminder" || a.may.remind) && (d.kind !== "test" || a.may.suggestTests) && (d.kind !== "summary" || a.may.summaries);

/**
 * Reconcile: keep live suggestions, add new ones she hasn't already acted
 * on, drop ones that no longer apply. Returns the new inbox.
 */
export function reconcile(s: SpaceState, l: Learned, now = new Date()): Suggestion[] {
  const drafts = propose(s, l, now).filter((d) => {
    const a = s.agents[d.agent];
    if (!a?.enabled) return false;
    const def = agentById(d.agent);
    if (def.relevant && !def.relevant(s)) return false;
    if (!kindAllowed(d, a)) return false;
    if (breaksRule(d, a.never)) return false;
    if ((s.feedback[`${d.agent}:${d.kind}`] ?? 0) >= 2) return false;
    return true;
  });
  const keys = new Set(drafts.map((d) => d.key));
  const kept = s.inbox.filter((x) => x.status !== "pending" || keys.has(x.key));
  const known = new Set(kept.map((x) => x.key));
  const fresh: Suggestion[] = [];
  for (const d of drafts) {
    if (known.has(d.key)) continue;
    const a = s.agents[d.agent];
    // "weekly" agents speak at most once a week; "daily" once a day
    const lastFromAgent = kept.filter((x) => x.agent === d.agent).map((x) => new Date(x.createdAt).getTime()).sort((p, q) => q - p)[0];
    const gap = a.frequency === "weekly" ? 7 * DAY : a.frequency === "daily" ? DAY : 0;
    if (gap && lastFromAgent && now.getTime() - lastFromAgent < gap) continue;
    fresh.push({ ...d, id: `sg_${Math.random().toString(36).slice(2, 10)}`, createdAt: now.toISOString(), status: "pending" });
  }
  return [...fresh, ...kept].slice(0, 80);
}

/** Inside her quiet hours? (Notifications wait; the inbox still fills.) */
export function isQuiet(a: AgentSettings, d = new Date()) {
  const h = d.getHours();
  return a.quiet.from > a.quiet.to ? h >= a.quiet.from || h < a.quiet.to : h >= a.quiet.from && h < a.quiet.to;
}
