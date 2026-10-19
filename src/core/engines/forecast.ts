import type { Profile, Phase, DayLog } from "../persona";
import { phaseFor } from "../persona";
import { addDays, mean, sd, round, daysBetween } from "../rng";

/* ------------------------------------------------------------------ *
 * Forecast engine — learns Maya's own cycle "shape" from her history
 * and projects it forward. Predictions carry an uncertainty cone that
 * widens with distance and with cycle variability.
 * ------------------------------------------------------------------ */

export type Metric = "rhr" | "temp" | "sleep" | "energy";

export const METRICS: Record<Metric, { label: string; unit: string; fmt: (v: number) => string }> = {
  temp: { label: "Skin temperature", unit: "°C", fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}` },
  rhr: { label: "Resting heart rate", unit: "bpm", fmt: (v) => v.toFixed(0) },
  sleep: { label: "Sleep", unit: "h", fmt: (v) => v.toFixed(1) },
  energy: { label: "Energy", unit: "/100", fmt: (v) => v.toFixed(0) },
};

export interface Today {
  cycleDay: number;
  phase: Phase;
  meanLength: number;
  sdLength: number;
  nextStart: Date;
  daysUntil: number;
  fertile: [Date, Date];
  confidence: number; // 0..1
}

export function cycleToday(p: Profile): Today {
  const lengths = p.cycles.map((c) => c.length).filter((x): x is number => x != null);
  const recent = lengths.slice(-6);
  // weight recent cycles more
  const w = recent.map((_, i) => i + 1);
  const meanLength = recent.reduce((a, x, i) => a + x * w[i], 0) / w.reduce((a, b) => a + b, 0);
  const sdLength = sd(recent);
  const current = p.cycles[p.cycles.length - 1];
  const cycleDay = daysBetween(current.start, p.today) + 1;
  const nextStart = addDays(current.start, Math.round(meanLength));
  const ov = Math.round(meanLength) - 14;
  return {
    cycleDay,
    phase: phaseFor(cycleDay, Math.round(meanLength)),
    meanLength: round(meanLength, 1),
    sdLength: round(sdLength, 1),
    nextStart,
    daysUntil: Math.max(0, daysBetween(p.today, nextStart)),
    fertile: [addDays(current.start, ov - 5), addDays(current.start, ov + 1)],
    confidence: Math.max(0.35, 1 - sdLength / 10),
  };
}

export interface SeriesPoint {
  date: Date;
  v: number;
  phase: Phase;
  predicted?: boolean;
  lo?: number;
  hi?: number;
}

/** Average value of a metric at each normalised cycle position (20 bins). */
function learnShape(logs: DayLog[], p: Profile, metric: Metric) {
  const bins: number[][] = Array.from({ length: 20 }, () => []);
  for (const l of logs) {
    const len = p.cycles[l.cycleIndex].length;
    if (!len) continue;
    const pos = Math.min(19, Math.floor(((l.cycleDay - 1) / len) * 20));
    bins[pos].push(l[metric]);
  }
  const all = logs.map((l) => l[metric]);
  const fallback = mean(all);
  return { shape: bins.map((b) => (b.length ? mean(b) : fallback)), spread: sd(all) };
}

export function metricSeries(p: Profile, metric: Metric, pastDays = 90, futureDays = 35): SeriesPoint[] {
  const past = p.logs.slice(-pastDays).map((l) => ({ date: l.date, v: l[metric], phase: l.phase }));
  const { shape, spread } = learnShape(p.logs, p, metric);
  const t = cycleToday(p);
  const len = Math.round(t.meanLength);
  const current = p.cycles[p.cycles.length - 1];
  const out: SeriesPoint[] = [...past];
  for (let i = 1; i <= futureDays; i++) {
    const date = addDays(p.today, i);
    let day = daysBetween(current.start, date) + 1;
    while (day > len) day -= len;
    const pos = Math.min(19, Math.floor(((day - 1) / len) * 20));
    const cone = spread * (0.35 + (i / futureDays) * 0.9) * (1 + t.sdLength / 8);
    const v = shape[pos];
    out.push({ date, v, phase: phaseFor(day, len), predicted: true, lo: v - cone, hi: v + cone });
  }
  return out;
}

export const PHASE_META: Record<Phase, { label: string; hue: number; color: string; desc: string }> = {
  menstrual: { label: "Menstrual", hue: 345, color: "#EAA6BC", desc: "Bleeding; oestrogen and progesterone at their lowest." },
  follicular: { label: "Follicular", hue: 28, color: "#E8CBA8", desc: "Oestrogen rising as a follicle matures." },
  ovulatory: { label: "Ovulatory", hue: 300, color: "#B982A1", desc: "LH surge and ovulation; a short window." },
  luteal: { label: "Luteal", hue: 320, color: "#8A5A77", desc: "Progesterone rises; temperature and heart rate lift." },
};
