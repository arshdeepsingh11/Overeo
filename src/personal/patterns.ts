import { phaseFor, type Phase } from "../core/persona";
import { usable, type SpaceState } from "./space";
import type { AnyRecord, HealthRecord, MemoryItem } from "./types";

/* =====================================================================
   What OVEREO has learned about HER — computed only from her confirmed,
   active records. Deterministic: the system calculates, SI explains.
   Every learned item says how sure it is and what it is based on.
   ===================================================================== */

const DAY = 86_400_000;
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// calendar days between local dates — DST-safe
export const dayDiff = (a: Date, b: Date) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / DAY);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sd = (xs: number[]) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface CycleState {
  starts: Date[];
  lengths: number[];
  avg: number | null;
  sd: number | null;
  day: number | null;
  nextStart: Date | null;
  daysUntil: number | null;
  phase: Phase | null;
  /** cycles still needed before predictions are personal */
  needed: number;
}

export interface Learned {
  cycle: CycleState;
  memory: MemoryItem[];
  progress: { score: number; steps: { label: string; done: boolean }[]; next: string };
  latestLabs: { name: string; value: number; unit: string; low?: number; high?: number; first: number; at: Date; flag: "low" | "high" | null }[];
  week: WeekSummary;
}

export interface WeekSummary {
  daysLogged: number;
  entries: number;
  moodAvg: number | null;
  moodPrev: number | null;
  sleepAvg: number | null;
  sleepPrev: number | null;
  symptoms: { name: string; days: number }[];
  bp: { sys: number; dia: number } | null;
}

function byType<K extends AnyRecord["type"]>(rs: AnyRecord[], t: K) {
  return rs.filter((r) => r.type === t) as unknown as HealthRecord<K>[];
}

export function learn(s: SpaceState, now = new Date()): Learned {
  const rs = s.records.filter(usable);
  const memory: MemoryItem[] = [];
  const push = (m: MemoryItem) => memory.push(m);

  /* ---------------- cycle ---------------- */
  const starts = [...new Set(byType(rs, "period_start").map((r) => startOf(new Date(r.observedAt)).getTime()))]
    .sort((a, b) => a - b)
    .map((t) => new Date(t));
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const L = dayDiff(starts[i], starts[i - 1]);
    if (L >= 15 && L <= 60) lengths.push(L);
  }
  const fallback = s.account?.typicalCycle ?? null;
  const avg = lengths.length >= 2 ? r1(mean(lengths.slice(-6))) : lengths.length === 1 ? lengths[0] : fallback;
  const last = starts[starts.length - 1] ?? null;
  const day = last ? dayDiff(now, last) + 1 : null;
  const nextStart = last && avg ? new Date(last.getFullYear(), last.getMonth(), last.getDate() + Math.round(avg)) : null;
  const cycle: CycleState = {
    starts,
    lengths,
    avg,
    sd: lengths.length >= 3 ? r1(sd(lengths.slice(-6))) : null,
    day,
    nextStart,
    daysUntil: nextStart ? dayDiff(nextStart, now) : null,
    phase: day && avg && day <= avg + 10 ? phaseFor(day, Math.round(avg)) : null,
    needed: Math.max(0, 3 - lengths.length),
  };
  if (lengths.length >= 2)
    push({
      id: "cycle-length",
      area: "cycle",
      kind: "learned",
      text: `Your cycle averages ${avg} days${cycle.sd != null ? ` (usually within ±${cycle.sd})` : ""} — not the textbook 28.`,
      confidence: Math.min(0.95, 0.4 + lengths.length * 0.1),
      evidence: `${lengths.length} complete cycles you logged`,
    });

  // cycle day → for each record, its position relative to its cycle
  const position = (d: Date) => {
    let st: Date | null = null;
    let nx: Date | null = null;
    for (let i = 0; i < starts.length; i++) {
      if (starts[i] <= d) {
        st = starts[i];
        nx = starts[i + 1] ?? null;
      }
    }
    if (!st) return null;
    return { cd: dayDiff(d, st) + 1, before: nx ? dayDiff(nx, d) : null };
  };

  /* ---------------- mood before period ---------------- */
  const moods = byType(rs, "mood").map((r) => ({ v: r.value.score, p: position(new Date(r.observedAt)) }));
  const pre = moods.filter((m) => m.p?.before != null && m.p.before >= 1 && m.p.before <= 4).map((m) => m.v);
  const rest = moods.filter((m) => m.p?.before != null && m.p.before > 6).map((m) => m.v);
  if (pre.length >= 6 && rest.length >= 10 && mean(rest) - mean(pre) >= 0.5)
    push({
      id: "mood-premenstrual",
      area: "mood",
      kind: "learned",
      text: `Your mood tends to dip in the 4 days before your period (${r1(mean(pre))} vs ${r1(mean(rest))} out of 5 the rest of the cycle).`,
      confidence: Math.min(0.9, 0.35 + pre.length / 40),
      evidence: `${pre.length} mood check-ins before periods`,
    });

  /* ---------------- sleep ---------------- */
  const sleeps = byType(rs, "sleep_duration").map((r) => ({ h: r.value.minutes / 60, p: position(new Date(r.observedAt)) }));
  const sPre = sleeps.filter((x) => x.p?.before != null && x.p.before >= 1 && x.p.before <= 5).map((x) => x.h);
  const sMid = sleeps.filter((x) => x.p && x.p.cd >= 6 && x.p.cd <= 12).map((x) => x.h);
  if (sPre.length >= 6 && sMid.length >= 6 && mean(sMid) - mean(sPre) >= 0.4)
    push({
      id: "sleep-luteal",
      area: "sleep",
      kind: "learned",
      text: `You sleep less before your period — about ${r1(mean(sPre))} h, versus ${r1(mean(sMid))} h early in your cycle.`,
      confidence: Math.min(0.9, 0.35 + sPre.length / 40),
      evidence: `${sPre.length + sMid.length} nights you logged`,
    });

  /* ---------------- temperature shift ---------------- */
  const temps = byType(rs, "morning_temperature").map((r) => ({ c: r.value.celsius, p: position(new Date(r.observedAt)) }));
  const tLate = temps.filter((x) => x.p?.before != null && x.p.before >= 2 && x.p.before <= 10).map((x) => x.c);
  const tEarly = temps.filter((x) => x.p && x.p.cd >= 5 && x.p.cd <= 11).map((x) => x.c);
  if (tLate.length >= 8 && tEarly.length >= 8 && mean(tLate) - mean(tEarly) >= 0.2)
    push({
      id: "temp-shift",
      area: "body",
      kind: "learned",
      text: `Your waking temperature rises about ${r1(mean(tLate) - mean(tEarly))} °C in the second half of your cycle — a sign you're ovulating.`,
      confidence: 0.75,
      evidence: `${tLate.length + tEarly.length} morning temperatures`,
    });

  /* ---------------- recurring symptoms ---------------- */
  const sym = byType(rs, "symptom");
  const names = [...new Set(sym.map((x) => x.value.name))];
  for (const name of names) {
    const xs = sym.filter((x) => x.value.name === name).map((x) => ({ sev: x.value.severity, p: position(new Date(x.observedAt)) }));
    const early = xs.filter((x) => x.p && x.p.cd <= 3);
    // in how many different cycles did it show up in the first three days?
    const cyclesWith = new Set(
      sym
        .filter((x) => x.value.name === name)
        .filter((x) => (position(new Date(x.observedAt))?.cd ?? 99) <= 3)
        .map((x) => starts.filter((st) => st <= new Date(x.observedAt)).length),
    ).size;
    if (early.length >= 3 && cyclesWith >= 3)
      push({
        id: `sym-${name.toLowerCase().replace(/\W+/g, "-")}`,
        area: "body",
        kind: "learned",
        text: `${name} shows up in the first days of your period (average ${r1(mean(early.map((x) => x.sev)))}/10), across ${cyclesWith} cycles.`,
        confidence: Math.min(0.9, 0.4 + cyclesWith * 0.08),
        evidence: `${xs.length} symptom entries`,
      });
  }

  /* ---------------- labs ---------------- */
  const labs = byType(rs, "lab_result");
  const testNames = [...new Set(labs.map((l) => l.value.testName))];
  const latestLabs = testNames.map((nm) => {
    const xs = labs.filter((l) => l.value.testName === nm).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const l = xs[xs.length - 1].value;
    const flag = l.low != null && l.value < l.low ? "low" : l.high != null && l.value > l.high ? "high" : null;
    return { name: nm, value: l.value, unit: l.unit, low: l.low, high: l.high, first: xs[0].value.value, at: new Date(xs[xs.length - 1].observedAt), flag: flag as "low" | "high" | null };
  });
  const ferr = latestLabs.find((l) => /ferritin/i.test(l.name));
  if (ferr && ferr.value < 30)
    push({
      id: "lab-ferritin",
      area: "labs",
      kind: "learned",
      text: `Your iron stores are low (ferritin ${ferr.value} ${ferr.unit}${ferr.first !== ferr.value ? `, down from ${ferr.first}` : ""}).`,
      confidence: 0.9,
      evidence: "Your lab results",
    });

  /* ---------------- habits ---------------- */
  const manual = s.records.filter((r) => r.source.origin === "manual" || r.source.origin === "sample");
  if (manual.length >= 10) {
    const hours = manual.map((r) => new Date(r.createdAt).getHours());
    const evening = hours.filter((h) => h >= 18).length / hours.length;
    const morning = hours.filter((h) => h < 11).length / hours.length;
    if (evening > 0.5 || morning > 0.5)
      push({
        id: "habit-logtime",
        area: "habits",
        kind: "learned",
        text: evening > morning ? "You usually check in in the evening, so reminders arrive then." : "You usually check in in the morning, so reminders arrive then.",
        confidence: 0.6,
        evidence: `${manual.length} entries`,
      });
  }

  /* ---------------- preferences from her reactions ---------------- */
  for (const [key, count] of Object.entries(s.feedback))
    if (count >= 2) {
      const [agent, kind] = key.split(":");
      push({ id: `pref-${key}`, area: "preferences", kind: "preference", text: `You don't want ${kind} suggestions from the ${agent} agent — it has stopped sending them.`, confidence: 0.8, evidence: `You dismissed ${count}` });
    }

  /* ---------------- goals ---------------- */
  if (s.account?.goals.length)
    push({ id: "goals", area: "goals", kind: "told", text: `Your focus: ${s.account.goals.map((g) => GOAL_LABEL[g] ?? g).join(", ")}.`, confidence: 1, evidence: "You chose these" });

  /* ---------------- her overrides ---------------- */
  const out = [...memory, ...s.told]
    .filter((m) => !s.overrides.some((o) => o.id === m.id && o.action === "forget"))
    .map((m) => {
      const c = s.overrides.find((o) => o.id === m.id && o.action === "correct");
      return c ? { ...m, text: c.text ?? m.text, kind: "told" as const, evidence: "You corrected this", confidence: 1 } : m;
    });

  /* ---------------- learning progress ---------------- */
  const last30 = rs.filter((r) => dayDiff(now, new Date(r.observedAt)) <= 30);
  const daysLogged = new Set(last30.map((r) => startOf(new Date(r.observedAt)).getTime())).size;
  const steps = [
    { label: "Your goals", done: !!s.account?.goals.length, w: 10 },
    { label: "2 period dates", done: starts.length >= 2, w: 20 },
    { label: "3 full cycles", done: lengths.length >= 3, w: 20 },
    { label: "14 days of check-ins", done: daysLogged >= 14, w: 20 },
    { label: "A lab result", done: labs.length > 0, w: 15 },
    { label: "Mood & sleep for 2 weeks", done: byType(rs, "mood").length >= 14 && byType(rs, "sleep_duration").length >= 14, w: 15 },
  ];
  // completed steps, plus partial credit for recent check-ins
  const score = Math.min(100, Math.round(steps.reduce((a, x) => a + (x.done ? x.w : 0), 0) + (daysLogged >= 14 ? 0 : (daysLogged / 14) * 20 * 0.5)));
  const firstTodo = steps.find((x) => !x.done);
  const next = !firstTodo
    ? "OVEREO knows your rhythm well. Keep logging and it keeps getting sharper."
    : firstTodo.label === "2 period dates"
      ? "Add the start dates of your last two periods — that's all OVEREO needs to start predicting."
      : firstTodo.label === "3 full cycles"
        ? `Keep logging your period — ${cycle.needed} more cycle${cycle.needed === 1 ? "" : "s"} and predictions become fully personal.`
        : firstTodo.label === "A lab result"
          ? "Snap or add one lab result, like ferritin or vitamin D."
          : firstTodo.label === "Your goals"
            ? "Tell OVEREO what you'd like help with."
            : "A 20-second check-in each day teaches OVEREO your patterns.";

  return { cycle, memory: out, progress: { score, steps: steps.map(({ label, done }) => ({ label, done })), next }, latestLabs, week: weekSummary(rs, now) };
}

export const GOAL_LABEL: Record<string, string> = {
  periods: "periods & pain",
  fertility: "fertility timeline",
  "egg-freezing": "egg freezing",
  pregnancy: "trying to conceive",
  menopause: "perimenopause & menopause",
  energy: "energy",
  general: "overall health",
};

function weekSummary(rs: AnyRecord[], now: Date): WeekSummary {
  const inRange = (r: AnyRecord, from: number, to: number) => {
    const d = dayDiff(now, new Date(r.observedAt));
    return d >= from && d < to;
  };
  const wk = rs.filter((r) => inRange(r, 0, 7));
  const prev = rs.filter((r) => inRange(r, 7, 14));
  const avgOf = <K extends AnyRecord["type"]>(xs: AnyRecord[], t: K, f: (r: HealthRecord<K>) => number) => {
    const v = byType(xs, t).map(f);
    return v.length ? r1(mean(v)) : null;
  };
  const symMap = new Map<string, Set<number>>();
  byType(wk, "symptom").forEach((r) => {
    const k = r.value.name;
    if (!symMap.has(k)) symMap.set(k, new Set());
    symMap.get(k)!.add(startOf(new Date(r.observedAt)).getTime());
  });
  const bps = byType(wk, "blood_pressure");
  return {
    daysLogged: new Set(wk.map((r) => startOf(new Date(r.observedAt)).getTime())).size,
    entries: wk.length,
    moodAvg: avgOf(wk, "mood", (r) => r.value.score),
    moodPrev: avgOf(prev, "mood", (r) => r.value.score),
    sleepAvg: avgOf(wk, "sleep_duration", (r) => r.value.minutes / 60),
    sleepPrev: avgOf(prev, "sleep_duration", (r) => r.value.minutes / 60),
    symptoms: [...symMap.entries()].map(([name, d]) => ({ name, days: d.size })).sort((a, b) => b.days - a.days),
    bp: bps.length ? { sys: Math.round(mean(bps.map((b) => b.value.systolic))), dia: Math.round(mean(bps.map((b) => b.value.diastolic))) } : null,
  };
}

/** A compact, de-identified summary for SI (Xevyo) — patterns, not raw logs. */
export function siContext(s: SpaceState, l: Learned) {
  return {
    space: s.mode,
    name: s.account?.name ?? null,
    stage: s.account?.stage ?? null,
    goals: s.account?.goals ?? [],
    cycle: l.cycle.avg ? { day: l.cycle.day, phase: l.cycle.phase, averageLength: l.cycle.avg, nextPeriodInDays: l.cycle.daysUntil } : null,
    learned: l.memory.map((m) => m.text),
    labs: l.latestLabs.map((x) => `${x.name} ${x.value} ${x.unit}${x.flag ? ` (${x.flag})` : ""}`),
    thisWeek: l.week,
    language: s.prefs.lang,
  };
}
