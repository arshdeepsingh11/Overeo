import { usable, type SpaceState } from "../space";
import { learn, type Learned } from "../patterns";
import type { AnyRecord, HealthRecord, MeasurementType } from "../types";
import { addDays, correlation, dayDiff, dayKey, linreg, mean, r1, sd, startOfDay } from "./stats";

/* =====================================================================
   OVEREO Mind — her personal model.

   Built only from her confirmed, active records, on her device. It knows
   her normal (baselines), how she changes across her cycle, which of her
   own measures move together, what is unusual right now, and what is
   likely to come next. Every conclusion carries its evidence and how sure
   it is, so the app can always answer "why?".

   Population guidance used for context (never instead of her data):
   - Sleep: adults need 7 h or more (AASM/SRS consensus, 2015).
   - Blood pressure categories: ACC/AHA 2017.
   - Fever: 38.0 °C or higher.
   - Cycle normal ranges: FIGO 2018 (see cycle.ts).
   ===================================================================== */

export type MetricKey = "mood" | "sleep" | "temp" | "sys" | "dia" | "pulse" | "weight" | "pain";

export interface Evidence {
  label: string;
  detail?: string;
  href?: string;
}

export interface Point {
  at: Date;
  v: number;
  id: string;
}

export interface MetricStat {
  key: MetricKey;
  label: string;
  unit: string;
  n: number;
  series: Point[];
  last: Point | null;
  /** her normal: 90 days, excluding the last 3 days */
  baseline: { mean: number; sd: number; n: number } | null;
  /** last 3 days */
  recent: { mean: number; n: number } | null;
  /** how far recent sits from her normal, in her own standard deviations */
  z: number | null;
  /** change per week over the last 6 weeks (only when clear) */
  trend: { perWeek: number; p: number; n: number } | null;
}

export interface PhaseStat {
  /** mean on cycle days 1–5 */
  menstrual: number | null;
  /** days 6 → 6 days before the period */
  mid: number | null;
  /** the 5 days before the period */
  pre: number | null;
  n: { menstrual: number; mid: number; pre: number };
}

export interface SymptomStat {
  name: string;
  entries: number;
  days: number;
  avgSeverity: number;
  /** share of entries in cycle days 1–5 / in the 5 days before */
  inPeriod: number;
  beforePeriod: number;
  cycles: number;
  lastAt: Date;
  /** average severity: last two cycles vs the ones before */
  change: number | null;
}

export interface Link {
  id: string;
  from: MetricKey;
  to: MetricKey;
  text: string;
  r: number;
  p: number;
  n: number;
  /** change in `to` per unit of `from` */
  slope: number;
  slopeSe: number;
}

export interface LabStat {
  name: string;
  unit: string;
  latest: number;
  at: Date;
  low?: number;
  high?: number;
  flag: "low" | "high" | null;
  points: { at: Date; v: number }[];
  /** relative change from the first to the latest result */
  change: number | null;
  daysSince: number;
}

export interface Insight {
  id: string;
  area: "cycle" | "mood" | "sleep" | "body" | "labs" | "heart" | "habits" | "meds";
  kind: "watch" | "heads-up" | "good" | "info";
  title: string;
  text: string;
  evidence: Evidence[];
  confidence: number;
  /** sort key — higher first */
  priority: number;
  action?: { label: string; href?: string; ask?: string };
}

export interface MindModel {
  now: Date;
  learned: Learned;
  name: string;
  goals: string[];
  stage: string | null;
  metrics: Record<MetricKey, MetricStat>;
  phase: Partial<Record<MetricKey, PhaseStat>>;
  symptoms: SymptomStat[];
  links: Link[];
  labs: LabStat[];
  meds: { name: string; days14: number; lastAt: Date }[];
  bp: { sys: number; dia: number; n: number; category: BpCategory } | null;
  engagement: { daysLogged30: number; streak: number; bestHour: number | null; total: number };
  insights: Insight[];
  /** what she has asked about most (from her questions) */
  interests: string[];
  /** how much there is to learn from, 0–1 */
  depth: number;
}

export type BpCategory = "normal" | "elevated" | "stage 1" | "stage 2" | "crisis";

export function bpCategory(sys: number, dia: number): BpCategory {
  if (sys > 180 || dia > 120) return "crisis";
  if (sys >= 140 || dia >= 90) return "stage 2";
  if (sys >= 130 || dia >= 80) return "stage 1";
  if (sys >= 120) return "elevated";
  return "normal";
}

const LABEL: Record<MetricKey, [string, string]> = {
  mood: ["Mood", "/5"],
  sleep: ["Sleep", "h"],
  temp: ["Waking temperature", "°C"],
  sys: ["Systolic blood pressure", "mmHg"],
  dia: ["Diastolic blood pressure", "mmHg"],
  pulse: ["Pulse", "bpm"],
  weight: ["Weight", "kg"],
  pain: ["Pain", "/10"],
};

function byType<K extends MeasurementType>(rs: AnyRecord[], t: K) {
  return rs.filter((r) => r.type === t) as unknown as HealthRecord<K>[];
}

const fmtD = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ----------------------------------------------------------------------- */

export function buildModel(s: SpaceState, now = new Date(), interests: Record<string, number> = {}): MindModel {
  const learned = learn(s, now);
  const rs = s.records.filter(usable);
  const starts = learned.cycle.starts;
  const pred = learned.cycle.pred;

  // where a date sits in her cycle: day of cycle, and days before the next start
  const position = (d: Date) => {
    let i = -1;
    for (let k = 0; k < starts.length; k++) if (starts[k] <= d) i = k;
    if (i < 0) return null;
    const next = starts[i + 1] ?? (i === starts.length - 1 ? pred.next : null);
    return { cd: dayDiff(d, starts[i]) + 1, before: next ? dayDiff(next, d) : null, cycle: i, completed: !!starts[i + 1] };
  };

  /* ---------------- series ---------------- */
  const pt = (r: AnyRecord, v: number): Point => ({ at: new Date(r.observedAt), v, id: r.id });
  const series: Record<MetricKey, Point[]> = {
    mood: byType(rs, "mood").map((r) => pt(r, r.value.score)),
    sleep: byType(rs, "sleep_duration").map((r) => pt(r, r.value.minutes / 60)),
    temp: byType(rs, "morning_temperature").map((r) => pt(r, r.value.celsius)),
    sys: byType(rs, "blood_pressure").map((r) => pt(r, r.value.systolic)),
    dia: byType(rs, "blood_pressure").map((r) => pt(r, r.value.diastolic)),
    pulse: byType(rs, "blood_pressure")
      .filter((r) => r.value.pulse)
      .map((r) => pt(r, r.value.pulse!)),
    weight: byType(rs, "weight").map((r) => pt(r, r.value.kg)),
    pain: [],
  };
  // pain: the worst symptom each day she checked in (0 on check-in days without symptoms)
  const symByDay = new Map<string, number>();
  byType(rs, "symptom").forEach((r) => {
    const k = dayKey(new Date(r.observedAt));
    symByDay.set(k, Math.max(symByDay.get(k) ?? 0, r.value.severity));
  });
  const checkinDays = new Map<string, Date>();
  [...series.mood, ...series.sleep].forEach((p) => checkinDays.set(dayKey(p.at), p.at));
  byType(rs, "symptom").forEach((r) => checkinDays.set(dayKey(new Date(r.observedAt)), new Date(r.observedAt)));
  series.pain = [...checkinDays.entries()].map(([k, at]) => ({ at, v: symByDay.get(k) ?? 0, id: `pain-${k}` }));
  (Object.keys(series) as MetricKey[]).forEach((k) => series[k].sort((a, b) => a.at.getTime() - b.at.getTime()));

  const metrics = Object.fromEntries((Object.keys(series) as MetricKey[]).map((k) => [k, metricStat(k, series[k], now)])) as Record<MetricKey, MetricStat>;

  /* ---------------- cycle-phase profiles ---------------- */
  const phase: Partial<Record<MetricKey, PhaseStat>> = {};
  for (const k of ["mood", "sleep", "pain", "temp"] as MetricKey[]) {
    const m: number[] = [];
    const mid: number[] = [];
    const pre: number[] = [];
    for (const p of series[k]) {
      const pos = position(p.at);
      if (!pos || !pos.completed) continue;
      if (pos.cd <= 5) m.push(p.v);
      else if (pos.before != null && pos.before >= 1 && pos.before <= 5) pre.push(p.v);
      else if (pos.before != null && pos.before > 5) mid.push(p.v);
    }
    phase[k] = { menstrual: m.length >= 4 ? r1(mean(m)) : null, mid: mid.length >= 6 ? r1(mean(mid)) : null, pre: pre.length >= 4 ? r1(mean(pre)) : null, n: { menstrual: m.length, mid: mid.length, pre: pre.length } };
  }

  /* ---------------- symptoms ---------------- */
  const sym = byType(rs, "symptom");
  const symptoms: SymptomStat[] = [...new Set(sym.map((x) => x.value.name))]
    .map((name) => {
      const xs = sym.filter((x) => x.value.name === name);
      const pos = xs.map((x) => ({ x, p: position(new Date(x.observedAt)) }));
      const inPeriod = pos.filter((q) => q.p && q.p.cd <= 5).length / xs.length;
      const beforePeriod = pos.filter((q) => q.p?.before != null && q.p.before >= 1 && q.p.before <= 5).length / xs.length;
      const byCycle = new Map<number, number[]>();
      pos.forEach((q) => {
        if (!q.p) return;
        byCycle.set(q.p.cycle, [...(byCycle.get(q.p.cycle) ?? []), q.x.value.severity]);
      });
      const cyc = [...byCycle.keys()].sort((a, b) => a - b);
      const lastTwo = cyc.slice(-2).flatMap((c) => byCycle.get(c)!);
      const before = cyc.slice(0, -2).flatMap((c) => byCycle.get(c)!);
      return {
        name,
        entries: xs.length,
        days: new Set(xs.map((x) => dayKey(new Date(x.observedAt)))).size,
        avgSeverity: r1(mean(xs.map((x) => x.value.severity))),
        inPeriod,
        beforePeriod,
        cycles: byCycle.size,
        lastAt: new Date(Math.max(...xs.map((x) => new Date(x.observedAt).getTime()))),
        change: lastTwo.length >= 2 && before.length >= 3 ? r1(mean(lastTwo) - mean(before)) : null,
      };
    })
    .sort((a, b) => b.entries - a.entries);

  /* ---------------- her own links (same day) ---------------- */
  const links: Link[] = [];
  const pair = (from: MetricKey, to: MetricKey, text: (slope: number) => string) => {
    const a = new Map(series[from].map((p) => [dayKey(p.at), p.v]));
    const xs: number[] = [];
    const ys: number[] = [];
    series[to].forEach((p) => {
      const x = a.get(dayKey(p.at));
      if (x != null) {
        xs.push(x);
        ys.push(p.v);
      }
    });
    if (xs.length < 14) return;
    const c = correlation(xs, ys);
    const fit = linreg(xs, ys);
    if (!c || !fit || c.p >= 0.05 || Math.abs(c.r) < 0.25) return;
    links.push({ id: `${from}->${to}`, from, to, r: Math.round(c.r * 100) / 100, p: c.p, n: c.n, slope: fit.slope, slopeSe: fit.se, text: text(fit.slope) });
  };
  pair("sleep", "mood", (b) => `On days after you sleep an hour more, your mood is about ${r1(Math.abs(b))} point${Math.abs(b) >= 1.05 ? "s" : ""} ${b > 0 ? "higher" : "lower"}.`);
  pair("sleep", "pain", (b) => `On days after shorter sleep, your pain is ${b < 0 ? "higher" : "lower"} — about ${r1(Math.abs(b))} point${Math.abs(b) >= 1.05 ? "s" : ""} per hour.`);
  pair("pain", "mood", (b) => `On higher-pain days your mood is lower — about ${r1(Math.abs(b))} point per pain point.`);

  /* ---------------- labs ---------------- */
  const labRecs = byType(rs, "lab_result");
  const labs: LabStat[] = [...new Set(labRecs.map((l) => l.value.testName))].map((name) => {
    const xs = labRecs.filter((l) => l.value.testName === name).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const L = xs[xs.length - 1].value;
    const at = new Date(xs[xs.length - 1].observedAt);
    const first = xs[0].value.value;
    return {
      name,
      unit: L.unit,
      latest: L.value,
      at,
      low: L.low,
      high: L.high,
      flag: L.low != null && L.value < L.low ? "low" : L.high != null && L.value > L.high ? "high" : null,
      points: xs.map((x) => ({ at: new Date(x.observedAt), v: x.value.value })),
      change: xs.length > 1 && first !== 0 ? (L.value - first) / Math.abs(first) : null,
      daysSince: dayDiff(now, at),
    };
  });

  /* ---------------- medicines ---------------- */
  const medRecs = byType(rs, "medication");
  const meds = [...new Set(medRecs.map((m) => m.value.name))].map((name) => {
    const xs = medRecs.filter((m) => m.value.name === name);
    return {
      name,
      days14: new Set(xs.filter((m) => m.value.taken && dayDiff(now, new Date(m.observedAt)) < 14).map((m) => dayKey(new Date(m.observedAt)))).size,
      lastAt: new Date(Math.max(...xs.map((m) => new Date(m.observedAt).getTime()))),
    };
  });

  /* ---------------- blood pressure (last 30 days) ---------------- */
  const bpRecent = byType(rs, "blood_pressure").filter((r) => dayDiff(now, new Date(r.observedAt)) <= 30);
  const bp = bpRecent.length
    ? (() => {
        const sys = Math.round(mean(bpRecent.map((r) => r.value.systolic)));
        const dia = Math.round(mean(bpRecent.map((r) => r.value.diastolic)));
        return { sys, dia, n: bpRecent.length, category: bpCategory(sys, dia) };
      })()
    : null;

  /* ---------------- engagement ---------------- */
  const manual = s.records.filter((r) => r.source.origin === "manual" || r.source.origin === "sample");
  const hours = manual.map((r) => new Date(r.createdAt).getHours());
  const bucket = new Map<number, number>();
  hours.forEach((h) => bucket.set(h, (bucket.get(h) ?? 0) + 1));
  const bestHour = hours.length >= 8 ? [...bucket.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  const dayset = new Set(rs.map((r) => dayKey(new Date(r.observedAt))));
  let streak = 0;
  for (let d = startOfDay(now); dayset.has(dayKey(d)); d = addDays(d, -1)) streak++;
  const daysLogged30 = [...dayset].filter((k) => {
    const [y, m, dd] = k.split("-").map(Number);
    const dd0 = dayDiff(now, new Date(y, m - 1, dd));
    return dd0 >= 0 && dd0 < 30;
  }).length;

  const model: MindModel = {
    now,
    learned,
    name: s.account?.name ?? "you",
    goals: s.account?.goals ?? [],
    stage: s.account?.stage ?? null,
    metrics,
    phase,
    symptoms,
    links,
    labs,
    meds,
    bp,
    engagement: { daysLogged30, streak, bestHour, total: rs.length },
    insights: [],
    interests: Object.entries(interests)
      .sort((a, b) => b[1] - a[1])
      .filter(([, n]) => n >= 2)
      .map(([k]) => k),
    depth: Math.min(1, rs.length / 300),
  };
  model.insights = insightsFor(model, position);
  return model;
}

function metricStat(key: MetricKey, xs: Point[], now: Date): MetricStat {
  const [label, unit] = LABEL[key];
  const recentPts = xs.filter((p) => dayDiff(now, p.at) >= 0 && dayDiff(now, p.at) < 3);
  const basePts = xs.filter((p) => dayDiff(now, p.at) >= 3 && dayDiff(now, p.at) <= 90);
  const baseline = basePts.length >= 7 ? { mean: mean(basePts.map((p) => p.v)), sd: sd(basePts.map((p) => p.v)), n: basePts.length } : null;
  const recent = recentPts.length ? { mean: mean(recentPts.map((p) => p.v)), n: recentPts.length } : null;
  const z = baseline && recent && baseline.sd > 0 ? (recent.mean - baseline.mean) / baseline.sd : null;
  const six = xs.filter((p) => dayDiff(now, p.at) >= 0 && dayDiff(now, p.at) <= 42);
  let trend: MetricStat["trend"] = null;
  if (six.length >= 10) {
    const t0 = six[0].at.getTime();
    const fit = linreg(
      six.map((p) => (p.at.getTime() - t0) / (7 * 86_400_000)),
      six.map((p) => p.v),
    );
    const c = correlation(
      six.map((p) => p.at.getTime()),
      six.map((p) => p.v),
    );
    if (fit && c && c.p < 0.05) trend = { perWeek: fit.slope, p: c.p, n: six.length };
  }
  return { key, label, unit, n: xs.length, series: xs, last: xs[xs.length - 1] ?? null, baseline, recent, z, trend };
}

/* ======================================================================
   Insights: what matters for her today. Watch-outs first, then
   heads-ups about the next days, then good news.
   ====================================================================== */

type PositionFn = (d: Date) => { cd: number; before: number | null; cycle: number; completed: boolean } | null;

function insightsFor(m: MindModel, position: PositionFn): Insight[] {
  const out: Insight[] = [];
  const c = m.learned.cycle;
  const p = c.pred;
  const now = m.now;
  const tomorrow = addDays(startOfDay(now), 1);

  /* ---------- watch-outs ---------- */
  const lastBp = m.metrics.sys.last && m.metrics.dia.last ? { sys: m.metrics.sys.last.v, dia: m.metrics.dia.last.v, at: m.metrics.sys.last.at } : null;
  if (lastBp && dayDiff(now, lastBp.at) <= 7) {
    const cat = bpCategory(lastBp.sys, lastBp.dia);
    if (cat === "crisis")
      out.push({
        id: "bp-crisis",
        area: "heart",
        kind: "watch",
        title: "Your last blood pressure was very high",
        text: `${lastBp.sys}/${lastBp.dia} on ${fmtD(lastBp.at)}. Rest 5 minutes and measure again. If it stays above 180/120, or you have chest pain, shortness of breath, weakness, vision or speech changes, call emergency services now.`,
        evidence: [{ label: "Your reading", detail: `${lastBp.sys}/${lastBp.dia} mmHg` }, { label: "ACC/AHA 2017", detail: "Above 180/120 needs urgent attention" }],
        confidence: 0.95,
        priority: 100,
        action: { label: "Re-check now", href: "/app/track?t=blood_pressure" },
      });
    else if (cat === "stage 2")
      out.push({
        id: "bp-high",
        area: "heart",
        kind: "watch",
        title: "Blood pressure above 140/90",
        text: `Your last reading was ${lastBp.sys}/${lastBp.dia}. One reading isn't a diagnosis — re-check at rest on a few days, and share the readings with your clinician.`,
        evidence: [{ label: "Your reading", detail: `${lastBp.sys}/${lastBp.dia} mmHg on ${fmtD(lastBp.at)}` }, { label: "ACC/AHA 2017", detail: "140/90 or higher is stage 2" }],
        confidence: 0.85,
        priority: 80,
        action: { label: "Log another reading", href: "/app/track?t=blood_pressure" },
      });
  }

  const t = m.metrics.temp.last;
  if (t && t.v >= 38 && dayDiff(now, t.at) <= 2)
    out.push({
      id: "fever",
      area: "body",
      kind: "watch",
      title: "You logged a fever",
      text: `${r1(t.v)} °C on ${fmtD(t.at)}. Rest and fluids help; contact a clinician if it lasts more than 3 days, goes above 39.5 °C, or you feel very unwell.`,
      evidence: [{ label: "Your temperature", detail: `${r1(t.v)} °C` }],
      confidence: 0.9,
      priority: 85,
    });

  const sl = m.metrics.sleep;
  if (sl.recent && sl.baseline && sl.recent.n >= 2 && sl.baseline.mean - sl.recent.mean >= Math.max(0.75, sl.baseline.sd)) {
    const explained = c.daysUntil != null && c.daysUntil >= 0 && c.daysUntil <= 5 && m.phase.sleep?.pre != null && m.phase.sleep.mid != null && m.phase.sleep.mid - m.phase.sleep.pre >= 0.4;
    out.push({
      id: "sleep-short",
      area: "sleep",
      kind: "watch",
      title: "You've been sleeping less than usual",
      text: `${r1(sl.recent.mean)} h a night lately, versus your usual ${r1(sl.baseline.mean)} h.${explained ? " This often happens to you in the days before your period." : ""}`,
      evidence: [
        { label: "Last nights", detail: `${sl.recent.n} logged, average ${r1(sl.recent.mean)} h` },
        { label: "Your normal", detail: `${r1(sl.baseline.mean)} h over ${sl.baseline.n} nights` },
        ...(explained ? [{ label: "Your pattern", detail: `${m.phase.sleep!.pre} h before your period vs ${m.phase.sleep!.mid} h mid-cycle` }] : []),
      ],
      confidence: 0.75,
      priority: 60,
      action: { label: "What if I sleep more?", ask: "What if I sleep 1 hour more?" },
    });
  }

  const md = m.metrics.mood;
  if (md.recent && md.baseline && md.recent.n >= 2 && md.baseline.mean - md.recent.mean >= 1) {
    const lows = md.series.filter((x) => dayDiff(now, x.at) < 14 && x.v <= 1).length;
    out.push({
      id: "mood-low",
      area: "mood",
      kind: "watch",
      title: "Your mood has been lower than usual",
      text:
        lows >= 7
          ? "You've logged low moods on many days lately. You don't have to manage this alone — talking to someone you trust or a clinician can really help. If you ever feel unsafe, call your local emergency number."
          : `Around ${r1(md.recent.mean)}/5 lately, versus your usual ${r1(md.baseline.mean)}/5.`,
      evidence: [
        { label: "Recent check-ins", detail: `${md.recent.n}, average ${r1(md.recent.mean)}/5` },
        { label: "Your normal", detail: `${r1(md.baseline.mean)}/5 over ${md.baseline.n} check-ins` },
      ],
      confidence: 0.7,
      priority: lows >= 7 ? 90 : 55,
    });
  }

  if (c.daysUntil != null && p.late && c.nextStart && dayDiff(now, p.late) > 0)
    out.push({
      id: "period-late",
      area: "cycle",
      kind: "watch",
      title: `Your period is ${-c.daysUntil} days later than expected`,
      text: `Expected around ${fmtD(c.nextStart)} (your usual range is up to ${fmtD(p.late)}). Stress, illness, travel or pregnancy can delay it. If it started, log it — it keeps predictions accurate.`,
      evidence: [{ label: "Your cycles", detail: `${p.basis}, usually ${p.length} days ±${p.spread}` }],
      confidence: p.confidence,
      priority: 70,
      action: { label: "Log period", href: "/app/track?t=period_start" },
    });

  if (p.outside.length >= 2)
    out.push({
      id: "cycle-outside",
      area: "cycle",
      kind: "watch",
      title: "Some of your cycles are outside the usual range",
      text: `${p.outside.length} of your recent cycles were ${p.outside.map((x) => `${x} days`).join(", ")}. Cycles are usually 24–38 days; this is worth mentioning to a clinician.`,
      evidence: [{ label: "Your cycle lengths", detail: c.lengths.slice(-6).join(", ") + " days" }, { label: "FIGO 2018", detail: "Normal frequency 24–38 days" }],
      confidence: 0.8,
      priority: 50,
      action: { label: "Prepare a visit summary", href: "/app/visit" },
    });
  else if (p.regularity === "irregular")
    out.push({
      id: "cycle-irregular",
      area: "cycle",
      kind: "watch",
      title: "Your cycle length varies a lot",
      text: `Your last cycles ranged ${p.range} days from shortest to longest. A difference of more than 7–9 days is worth mentioning to a clinician.`,
      evidence: [{ label: "Your cycle lengths", detail: c.lengths.slice(-6).join(", ") + " days" }, { label: "FIGO 2018", detail: "Normal variation up to 7–9 days" }],
      confidence: 0.75,
      priority: 45,
    });

  for (const lab of m.labs.filter((x) => x.flag))
    out.push({
      id: `lab-${lab.name}`,
      area: "labs",
      kind: "watch",
      title: `${lab.name} is ${lab.flag}`,
      text: `${lab.latest} ${lab.unit} on ${fmtD(lab.at)} (range ${lab.low ?? "?"}–${lab.high ?? "?"})${lab.change != null && Math.abs(lab.change) >= 0.1 ? `, ${lab.change > 0 ? "up" : "down"} ${Math.round(Math.abs(lab.change) * 100)}% from your first result` : ""}.`,
      evidence: [{ label: "Your results", detail: lab.points.map((x) => `${x.v} (${fmtD(x.at)})`).join(" → ") }],
      confidence: 0.9,
      priority: 40,
      action: { label: `Ask about ${lab.name}`, ask: `What does my ${lab.name} mean?` },
    });

  /* ---------- heads-ups for the coming days ---------- */
  if (c.nextStart && c.daysUntil != null && c.daysUntil >= 0 && c.daysUntil <= 7)
    out.push({
      id: "period-soon",
      area: "cycle",
      kind: "heads-up",
      title: c.daysUntil === 0 ? "Your period is likely today" : `Your period is likely in ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}`,
      text: `Most likely ${fmtD(c.nextStart)}, between ${fmtD(p.early!)} and ${fmtD(p.late!)}.`,
      evidence: [
        { label: "Your cycles", detail: `${p.basis}: ${c.lengths.slice(-6).join(", ") || "—"} days` },
        { label: "Last period", detail: fmtD(c.starts[c.starts.length - 1]) },
      ],
      confidence: p.confidence,
      priority: 35,
    });

  // tomorrow, from how she usually feels at this point of her cycle
  const pos = position(tomorrow);
  if (pos) {
    const before = c.daysUntil != null ? c.daysUntil - 1 : null;
    const similar = (k: MetricKey) => {
      const xs: number[] = [];
      const rest: number[] = [];
      for (const q of m.metrics[k].series) {
        const qp = position(q.at);
        if (!qp || !qp.completed) continue;
        const match = before != null && before >= 1 && before <= 7 ? qp.before != null && Math.abs(qp.before - before) <= 1 : Math.abs(qp.cd - pos.cd) <= 1;
        (match ? xs : rest).push(q.v);
      }
      return xs.length >= 4 && rest.length >= 10 ? { here: mean(xs), rest: mean(rest), n: xs.length } : null;
    };
    const mood = similar("mood");
    if (mood && mood.rest - mood.here >= 0.5)
      out.push({
        id: "tomorrow-mood",
        area: "mood",
        kind: "heads-up",
        title: "Tomorrow is often a harder day for you",
        text: `At this point in your cycle your mood has averaged ${r1(mood.here)}/5, versus ${r1(mood.rest)}/5 on other days. A lighter plan and an earlier night may help.`,
        evidence: [{ label: "Same point in past cycles", detail: `${mood.n} check-ins` }],
        confidence: Math.min(0.85, 0.4 + mood.n / 30),
        priority: 30,
      });
    const pain = similar("pain");
    if (pain && pain.here - pain.rest >= 1.5)
      out.push({
        id: "tomorrow-pain",
        area: "body",
        kind: "heads-up",
        title: "Pain often shows up around now",
        text: `At this point in your cycle your pain has averaged ${r1(pain.here)}/10, versus ${r1(pain.rest)}/10 on other days. Keep what helps you close by.`,
        evidence: [{ label: "Same point in past cycles", detail: `${pain.n} days` }],
        confidence: Math.min(0.85, 0.4 + pain.n / 30),
        priority: 28,
      });
  }

  const wantsFertility = m.goals.some((g) => g === "pregnancy" || g === "fertility") && (m.stage === "cycling" || m.stage === "trying");
  if (wantsFertility && p.fertile && c.lengths.length >= 3) {
    const until = dayDiff(p.fertile.from, now);
    const inWindow = dayDiff(now, p.fertile.from) >= 0 && dayDiff(p.fertile.to, now) >= 0;
    if (inWindow || (until > 0 && until <= 7))
      out.push({
        id: "fertile",
        area: "cycle",
        kind: "heads-up",
        title: inWindow ? "You're likely in your fertile window" : `Your fertile window likely starts in ${until} day${until === 1 ? "" : "s"}`,
        text: `Estimated ${fmtD(p.fertile.from)}–${fmtD(p.fertile.to)}, with ovulation around ${fmtD(p.ovulation!)}. It's an estimate from your cycle lengths — ovulation tests or temperature make it sharper. Not a method of contraception.`,
        evidence: [{ label: "Your cycles", detail: `${p.basis}, usually ${p.length} days` }, { label: "Wilcox et al., 1995", detail: "Fertile days: the 5 before ovulation and the day of" }],
        confidence: Math.max(0.3, p.confidence - 0.15),
        priority: 32,
      });
  }

  const recurring = m.symptoms.find((x) => x.cycles >= 3 && x.inPeriod >= 0.6);
  if (recurring && c.daysUntil != null && c.daysUntil >= 0 && c.daysUntil <= 3)
    out.push({
      id: "symptom-coming",
      area: "body",
      kind: "heads-up",
      title: `${recurring.name} usually comes with your period`,
      text: `In ${recurring.cycles} cycles it showed up in the first days of your period, averaging ${recurring.avgSeverity}/10. Having a plan ready (heat, rest, what your clinician advised) can make those days easier.`,
      evidence: [{ label: "Your symptom log", detail: `${recurring.entries} entries over ${recurring.cycles} cycles` }],
      confidence: 0.75,
      priority: 26,
    });

  /* ---------- good news ---------- */
  if (sl.trend && sl.trend.perWeek >= 0.1)
    out.push({ id: "sleep-up", area: "sleep", kind: "good", title: "Your sleep is improving", text: `Up about ${r1(sl.trend.perWeek * 60)} minutes a night each week over the last six weeks.`, evidence: [{ label: "Nights logged", detail: `${sl.trend.n}` }], confidence: 0.7, priority: 15 });
  if (md.trend && md.trend.perWeek >= 0.1)
    out.push({ id: "mood-up", area: "mood", kind: "good", title: "Your mood is trending up", text: "Your check-ins have been rising over the last six weeks.", evidence: [{ label: "Check-ins", detail: `${md.trend.n}` }], confidence: 0.65, priority: 14 });
  const worse = m.symptoms.find((x) => x.change != null && x.change <= -1.5 && x.cycles >= 4);
  if (worse)
    out.push({ id: `sym-better-${worse.name}`, area: "body", kind: "good", title: `${worse.name} is easing`, text: `About ${Math.abs(worse.change!)} points lower in your last two cycles than before.`, evidence: [{ label: "Your symptom log", detail: `${worse.entries} entries` }], confidence: 0.6, priority: 12 });

  // one link she may not know about
  const link = m.links.find((l) => l.from === "sleep");
  if (link)
    out.push({
      id: `link-${link.id}`,
      area: "sleep",
      kind: "info",
      title: "Your sleep and how you feel are connected",
      text: link.text,
      evidence: [{ label: "Days compared", detail: `${link.n}` }, { label: "Strength", detail: `r = ${link.r}` }],
      confidence: Math.min(0.85, 0.35 + link.n / 120),
      priority: 10,
      action: { label: "Try a what-if", ask: "What if I sleep 1 hour more?" },
    });

  return out.sort((a, b) => b.priority - a.priority);
}

