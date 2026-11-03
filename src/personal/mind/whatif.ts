import type { MindModel } from "./model";
import type { Evidence } from "./model";
import { clamp, dayKey, linreg, mean, r1, shrink } from "./stats";

/* =====================================================================
   What-if — "what if I sleep an hour more?", answered from HER data.

   We fit how her own mood (and pain) move with her own sleep, then pull
   that estimate toward a cautious general prior while there is little
   data. The answer always shows a range and how sure it is, and never
   goes beyond what her data can support.
   ===================================================================== */

export interface WhatIf {
  ok: boolean;
  title: string;
  text: string;
  points: string[];
  evidence: Evidence[];
  confidence: number;
  /** for the slider card */
  outcome?: { label: string; unit: string; now: number; then: number; low: number; high: number; min: number; max: number };
}

/** Cautious general priors (per extra hour of sleep). Small on purpose. */
const PRIOR = { mood: 0.15, pain: -0.2 };
const PRIOR_WEIGHT = 25;

function paired(m: MindModel, to: "mood" | "pain") {
  const sleep = new Map(m.metrics.sleep.series.map((p) => [dayKey(p.at), p.v]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of m.metrics[to].series) {
    const s = sleep.get(dayKey(p.at));
    if (s != null) {
      xs.push(s);
      ys.push(p.v);
    }
  }
  return { xs, ys };
}

export function sleepWhatIf(m: MindModel, delta: number, to: "mood" | "pain" = "mood"): WhatIf {
  const d = clamp(delta, -3, 3);
  const { xs, ys } = paired(m, to);
  const scale = to === "mood" ? { min: 1, max: 5, unit: "/5", label: "Mood" } : { min: 0, max: 10, unit: "/10", label: "Pain" };
  if (xs.length < 10)
    return {
      ok: false,
      title: "Not enough to go on yet",
      text: `I need about two weeks of sleep and ${to} check-ins on the same days to answer this from your own data. You have ${xs.length} so far.`,
      points: [],
      evidence: [{ label: "Days with both logged", detail: String(xs.length) }],
      confidence: 0.2,
    };
  const fit = linreg(xs, ys);
  const own = fit?.slope ?? 0;
  const slope = shrink(own, xs.length, PRIOR[to], PRIOR_WEIGHT);
  const se = fit && Number.isFinite(fit.se) ? fit.se * Math.sqrt(xs.length / (xs.length + PRIOR_WEIGHT)) : Math.abs(slope);
  const recentSleep = m.metrics.sleep.recent?.mean ?? m.metrics.sleep.baseline?.mean ?? mean(xs);
  const nowV = m.metrics[to].baseline?.mean ?? mean(ys);
  const then = clamp(nowV + slope * d, scale.min, scale.max);
  const spread = Math.abs(1.96 * se * d);
  const low = clamp(Math.min(then - spread, then + spread), scale.min, scale.max);
  const high = clamp(Math.max(then - spread, then + spread), scale.min, scale.max);
  const target = recentSleep + d;
  const seen = { lo: Math.min(...xs), hi: Math.max(...xs) };
  const beyond = target < seen.lo - 0.25 || target > seen.hi + 0.25;
  const weak = Math.abs(slope * d) < 0.15;
  const confidence = clamp(0.25 + Math.min(0.45, xs.length / 200) + (fit && Math.abs(fit.r) >= 0.3 ? 0.15 : 0) - (beyond ? 0.2 : 0), 0.15, 0.85);
  const verb = d >= 0 ? `sleep ${r1(Math.abs(d))} h more` : `sleep ${r1(Math.abs(d))} h less`;
  const text = weak
    ? `In your data, ${to} barely changes with sleep — if you ${verb}, expect about the same (${r1(nowV)}${scale.unit}).`
    : `If you ${verb} (about ${r1(target)} h a night), your ${to} would likely be around ${r1(then)}${scale.unit} instead of ${r1(nowV)}${scale.unit} — somewhere between ${r1(low)} and ${r1(high)}.`;
  return {
    ok: true,
    title: `What if you ${verb}?`,
    text,
    points: [
      `Based on ${xs.length} days where you logged both sleep and ${to}.`,
      `Your data: ${r1(Math.abs(own))} ${to === "mood" ? "mood points" : "pain points"} ${own >= 0 ? "higher" : "lower"} per extra hour${xs.length < 60 ? ", blended with a cautious general estimate because there isn't much data yet" : ""}.`,
      ...(beyond ? [`${r1(target)} h is outside the range you've actually slept (${r1(seen.lo)}–${r1(seen.hi)} h), so treat this as a rough guide.`] : []),
      "This shows how your own measures move together — not proof that one causes the other.",
    ],
    evidence: [
      { label: "Days compared", detail: String(xs.length) },
      { label: "Your usual sleep", detail: `${r1(recentSleep)} h` },
      { label: `Your usual ${to}`, detail: `${r1(nowV)}${scale.unit}` },
      ...(fit ? [{ label: "How closely they move", detail: `r = ${Math.round(fit.r * 100) / 100}` }] : []),
    ],
    confidence,
    outcome: { label: scale.label, unit: scale.unit, now: r1(nowV), then: r1(then), low: r1(low), high: r1(high), min: scale.min, max: scale.max },
  };
}

export function whatIf(m: MindModel, metric: "sleep" | "mood" | "pain" | "weight" | "bp" | null, delta: number | null, text: string): WhatIf {
  if (metric === "sleep" || /\bsleep|bed|nap\b/.test(text)) {
    const d = delta ?? (/\bless|fewer|later\b/.test(text) ? -1 : 1);
    const mood = sleepWhatIf(m, d, "mood");
    const pain = m.links.some((l) => l.id === "sleep->pain") ? sleepWhatIf(m, d, "pain") : null;
    if (pain?.ok && mood.ok) return { ...mood, points: [pain.text, ...mood.points] };
    return mood;
  }
  if (metric === "bp" || /\bsalt|sodium|blood pressure|bp\b/.test(text))
    return {
      ok: true,
      title: "What could lower your blood pressure",
      text: m.bp
        ? `Your recent average is ${m.bp.sys}/${m.bp.dia} (${m.bp.category}). For most people, eating less sodium, regular activity, limiting alcohol and keeping a healthy weight all lower blood pressure — the American Heart Association notes that cutting even 1,000 mg of sodium a day helps.`
        : "Log a few readings first, and I can show you where you stand. For most people, less sodium, regular activity, less alcohol and a healthy weight lower blood pressure.",
      points: ["I can't predict your exact change — re-check at rest after a few weeks and compare.", "Never stop or change a blood-pressure medicine without your prescriber."],
      evidence: m.bp ? [{ label: "Your readings (30 days)", detail: `${m.bp.n}, average ${m.bp.sys}/${m.bp.dia}` }, { label: "American Heart Association", detail: "Sodium and blood pressure guidance" }] : [{ label: "American Heart Association", detail: "Sodium and blood pressure guidance" }],
      confidence: 0.5,
    };
  return {
    ok: false,
    title: "I can run what-ifs on sleep today",
    text: "I can answer from your own data for sleep (and how it moves with your mood and pain). Try “What if I sleep an hour more?” As you log more, more what-ifs open up.",
    points: [],
    evidence: [],
    confidence: 0.3,
  };
}
