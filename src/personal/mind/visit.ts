import { GOAL_LABEL } from "../patterns";
import type { MindModel } from "./model";
import { LAB_INFO } from "./knowledge";
import { dayDiff, r1 } from "./stats";

/* =====================================================================
   Visit summary — one page for her clinician, from her own records.

   Facts only, each with its count and dates. The questions are written
   from what her data actually shows, so the visit starts where it
   matters. Nothing here diagnoses.
   ===================================================================== */

export interface VisitSummary {
  months: number;
  from: Date;
  to: Date;
  about: { label: string; value: string }[];
  cycle: { label: string; value: string }[];
  starts: Date[];
  symptoms: { name: string; entries: number; days: number; severity: number; timing: string; cycles: number; trend: string }[];
  wellbeing: { label: string; value: string }[];
  labs: { name: string; latest: string; range: string; flag: string; date: Date; previous: string; note?: string }[];
  meds: { name: string; detail: string }[];
  noticed: string[];
  questions: string[];
  records: number;
}

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function visitSummary(m: MindModel, months = 6, birthYear?: number): VisitSummary {
  const to = m.now;
  const from = new Date(to.getFullYear(), to.getMonth() - months, to.getDate());
  const inRange = (d: Date) => d >= from && d <= to;
  const c = m.learned.cycle;
  const p = c.pred;

  const about = [
    ...(birthYear ? [{ label: "Age", value: `${to.getFullYear() - birthYear}` }] : []),
    ...(m.stage ? [{ label: "Life stage", value: STAGE[m.stage] ?? m.stage }] : []),
    ...(m.goals.length ? [{ label: "Her goals", value: m.goals.map((g) => GOAL_LABEL[g] ?? g).join(", ") }] : []),
  ];

  const starts = c.starts.filter(inRange);
  const cycle = c.starts.length
    ? [
        { label: "Last period started", value: fmt(c.starts[c.starts.length - 1]) },
        ...(c.lengths.length ? [{ label: "Cycle length", value: `average ${c.avg} days; last ${Math.min(6, c.lengths.length)}: ${c.lengths.slice(-6).join(", ")}` }] : []),
        ...(p.range != null ? [{ label: "Variation", value: `${p.range} days (${p.regularity}; FIGO: up to 7–9 days)` }] : []),
        ...(p.outside.length ? [{ label: "Outside 24–38 days", value: p.outside.join(", ") + " days" }] : []),
        ...(p.periodDays ? [{ label: "Bleeding", value: `about ${p.periodDays} days` }] : []),
        ...(c.nextStart ? [{ label: "Next period (estimate)", value: `${fmt(c.nextStart)} (${p.early ? fmt(p.early) : ""}–${p.late ? fmt(p.late) : ""})` }] : []),
      ]
    : [{ label: "Cycle", value: "No period dates logged yet" }];

  const symptoms = m.symptoms
    .filter((x) => inRange(x.lastAt) || x.entries >= 3)
    .slice(0, 8)
    .map((x) => ({
      name: x.name,
      entries: x.entries,
      days: x.days,
      severity: x.avgSeverity,
      timing: x.inPeriod >= 0.5 ? "During period (days 1–5)" : x.beforePeriod >= 0.4 ? "Before period" : "Across the cycle",
      cycles: x.cycles,
      trend: x.change == null ? "—" : x.change >= 1 ? `Worse (+${x.change})` : x.change <= -1 ? `Better (${x.change})` : "Stable",
    }));

  const wellbeing: VisitSummary["wellbeing"] = [];
  const md = m.metrics.mood;
  const mp = m.phase.mood;
  if (md.baseline) wellbeing.push({ label: "Mood (1–5)", value: `usual ${r1(md.baseline.mean)}${mp?.pre != null && mp.mid != null ? `; before period ${mp.pre} vs mid-cycle ${mp.mid}` : ""}` });
  const sl = m.metrics.sleep;
  const sp = m.phase.sleep;
  if (sl.baseline) wellbeing.push({ label: "Sleep", value: `usual ${r1(sl.baseline.mean)} h${sp?.pre != null && sp.mid != null ? `; before period ${sp.pre} h vs mid-cycle ${sp.mid} h` : ""}` });
  if (m.bp) wellbeing.push({ label: "Blood pressure (30 days)", value: `${m.bp.sys}/${m.bp.dia} average of ${m.bp.n} reading${m.bp.n === 1 ? "" : "s"} (${m.bp.category}, ACC/AHA 2017)` });
  const tShift = m.learned.memory.find((x) => x.id === "temp-shift");
  if (tShift) {
    const v = tShift.text.replace(/^Your waking temperature /, "");
    wellbeing.push({ label: "Waking temperature", value: v[0].toUpperCase() + v.slice(1) });
  }
  const w = m.metrics.weight;
  if (w.last) wellbeing.push({ label: "Weight", value: `${r1(w.last.v)} kg (${fmt(w.last.at)})` });
  m.links.forEach((l) => wellbeing.push({ label: "Her pattern", value: l.text }));

  const labs = m.labs.map((l) => {
    const info = LAB_INFO[l.name];
    const cd = (() => {
      const st = [...c.starts].reverse().find((s) => s <= l.at);
      const d = st ? dayDiff(l.at, st) + 1 : null;
      return d && d <= 60 ? d : null;
    })();
    return {
      name: l.name,
      latest: `${l.latest} ${l.unit}`,
      range: l.low != null || l.high != null ? `${l.low ?? ""}–${l.high ?? ""}` : "—",
      flag: l.flag ?? "",
      date: l.at,
      previous: l.points.length > 1 ? l.points.slice(0, -1).slice(-2).map((x) => `${x.v} (${x.at.toLocaleDateString(undefined, { month: "short", year: "2-digit" })})`).join(", ") : "—",
      note: info?.timing && cd ? `drawn on cycle day ${cd}` : undefined,
    };
  });

  const meds = m.meds.map((x) => ({ name: x.name, detail: `taken on ${x.days14} of the last 14 days` }));

  const noticed = [...m.insights.filter((i) => i.kind === "watch").map((i) => `${i.title}: ${i.text}`), ...m.learned.memory.filter((x) => x.kind === "learned" && !["habit-logtime"].includes(x.id)).map((x) => x.text)].slice(0, 8);

  return { months, from, to, about, cycle, starts, symptoms, wellbeing, labs, meds, noticed, questions: questionsFor(m), records: m.engagement.total };
}

const STAGE: Record<string, string> = { cycling: "Cycling", trying: "Trying to conceive", pregnant: "Pregnant", postpartum: "Postpartum", peri: "Perimenopause", post: "Postmenopause" };

/** Questions written from what her data shows — the most important first. */
export function questionsFor(m: MindModel): string[] {
  const q: { t: string; w: number }[] = [];
  const c = m.learned.cycle;
  const p = c.pred;
  const pain = m.symptoms.find((x) => /pain|cramp/i.test(x.name) && x.inPeriod >= 0.5 && x.cycles >= 3);
  const deep = m.symptoms.some((x) => /bowel|sex/i.test(x.name) && x.cycles >= 2);
  if (pain && (pain.avgSeverity >= 5 || deep))
    q.push({ t: `My period pain averages ${pain.avgSeverity}/10 over ${pain.cycles} cycles${deep ? ", with pain during bowel movements or sex" : ""}. Could this be endometriosis, and how would we find out?`, w: 10 });
  const ferr = m.labs.find((l) => /ferritin/i.test(l.name));
  if (ferr && ferr.latest < 30) q.push({ t: `My ferritin is ${ferr.latest} ${ferr.unit}${ferr.points.length > 1 ? ` (was ${ferr.points[0].v})` : ""}. Should we treat low iron stores, and when should I recheck?`, w: 9 });
  if (p.regularity === "irregular" || p.outside.length) q.push({ t: `My cycles range from ${Math.min(...c.lengths.slice(-6))} to ${Math.max(...c.lengths.slice(-6))} days. Should we check hormones, thyroid or PCOS?`, w: 8 });
  if (m.bp && (m.bp.category === "stage 1" || m.bp.category === "stage 2")) q.push({ t: `My readings average ${m.bp.sys}/${m.bp.dia}. What should my target be, and should we confirm with home or 24-hour monitoring?`, w: 8 });
  const mp = m.phase.mood;
  if (mp?.pre != null && mp.mid != null && mp.mid - mp.pre >= 0.8) q.push({ t: `My mood drops before my period every cycle (${mp.pre}/5 vs ${mp.mid}/5). Could this be PMS or PMDD, and what helps?`, w: 7 });
  for (const l of m.labs.filter((x) => x.flag && !/ferritin/i.test(x.name)).slice(0, 2)) q.push({ t: `My ${l.name} is ${l.flag} (${l.latest} ${l.unit}). What does it mean for me, and do we need to repeat it?`, w: 6 });
  const amh = m.labs.find((l) => /amh/i.test(l.name));
  if (amh && m.goals.some((g) => g === "fertility" || g === "egg-freezing")) q.push({ t: `With an AMH of ${amh.latest} ${amh.unit}, what timeline would you suggest if I want to freeze eggs or try to conceive?`, w: 6 });
  if (m.metrics.sleep.baseline && m.metrics.sleep.baseline.mean < 6.5) q.push({ t: `I average ${r1(m.metrics.sleep.baseline.mean)} hours of sleep. What could help?`, w: 4 });
  if (!q.length) q.push({ t: "Is there anything in these patterns you'd like me to track more closely?", w: 1 });
  return q.sort((a, b) => b.w - a.w).slice(0, 5).map((x) => x.t);
}

/** The summary as plain text — for copying into a message or a patient portal. */
export function visitText(v: VisitSummary, name: string, sample: boolean): string {
  const L: string[] = [];
  L.push(`OVEREO visit summary — ${name}${sample ? " (SAMPLE DATA)" : ""}`);
  L.push(`${fmt(v.from)} – ${fmt(v.to)} · from ${v.records} records she logged`);
  if (v.about.length) L.push("", ...v.about.map((x) => `${x.label}: ${x.value}`));
  L.push("", "CYCLE", ...v.cycle.map((x) => `- ${x.label}: ${x.value}`));
  if (v.symptoms.length) L.push("", "SYMPTOMS", ...v.symptoms.map((x) => `- ${x.name}: ${x.entries} entries on ${x.days} days, avg ${x.severity}/10, ${x.timing.toLowerCase()}, ${x.cycles} cycles, ${x.trend.toLowerCase()}`));
  if (v.wellbeing.length) L.push("", "MOOD, SLEEP, VITALS", ...v.wellbeing.map((x) => `- ${x.label}: ${x.value}`));
  if (v.labs.length) L.push("", "LABS", ...v.labs.map((x) => `- ${x.name}: ${x.latest}${x.flag ? ` (${x.flag.toUpperCase()})` : ""}, range ${x.range}, ${fmt(x.date)}${x.previous !== "—" ? `; before: ${x.previous}` : ""}${x.note ? `; ${x.note}` : ""}`));
  if (v.meds.length) L.push("", "MEDICINES", ...v.meds.map((x) => `- ${x.name}: ${x.detail}`));
  if (v.noticed.length) L.push("", "PATTERNS IN HER DATA", ...v.noticed.map((x) => `- ${x}`));
  L.push("", "QUESTIONS", ...v.questions.map((x, i) => `${i + 1}. ${x}`));
  L.push("", "Prepared by OVEREO from her own entries. Educational — not a diagnosis.");
  return L.join("\n");
}
