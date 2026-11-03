import { addDays, clamp, dayDiff, ewMean, mean, r1, sd, shrink } from "./stats";

/* =====================================================================
   Her cycle, predicted from HER history.

   - Next period: a recency-weighted average of her last six cycles,
     gently pulled toward her own estimate (or 28 days) while there are
     only one or two cycles to learn from.
   - The window around it comes from her own variability.
   - Ovulation is estimated ~14 days before the next period (the luteal
     phase is the steadier half of the cycle); the fertile window is the
     five days before ovulation plus the day after (Wilcox et al., NEJM
     1995).
   - "Normal" uses FIGO's 2018 definitions: cycles every 24–38 days,
     varying by no more than 7–9 days, bleeding up to 8 days.
   ===================================================================== */

export type Regularity = "regular" | "variable" | "irregular" | "unknown";

export interface CyclePrediction {
  /** cycle length used for the prediction */
  length: number;
  /** her variability (days) */
  spread: number;
  next: Date | null;
  early: Date | null;
  late: Date | null;
  ovulation: Date | null;
  fertile: { from: Date; to: Date } | null;
  regularity: Regularity;
  /** last-6 range (max − min) */
  range: number | null;
  /** cycles outside FIGO's 24–38 day frequency */
  outside: number[];
  /** average bleeding days, when she logs period ends */
  periodDays: number | null;
  /** 0–1 */
  confidence: number;
  basis: string;
}

export function predictCycle(starts: Date[], lengths: number[], opts: { typical?: number | null; ends?: Date[] } = {}): CyclePrediction {
  const recent = lengths.slice(-6);
  const prior = opts.typical && opts.typical >= 18 && opts.typical <= 60 ? opts.typical : 28;
  const n = recent.length;
  const raw = n ? ewMean(recent, 3) : prior;
  const length = r1(n >= 3 ? raw : shrink(raw, n, prior, 1.5));
  const spread = n >= 3 ? r1(Math.max(1, sd(recent))) : 2.5;
  const range = n >= 2 ? Math.max(...recent) - Math.min(...recent) : null;
  const regularity: Regularity = range == null || n < 3 ? "unknown" : range <= 7 ? "regular" : range <= 9 ? "variable" : "irregular";
  const last = starts[starts.length - 1] ?? null;
  const next = last ? addDays(last, Math.round(length)) : null;
  const w = clamp(Math.round(spread), 1, 7);
  const ovulation = next ? addDays(next, -14) : null;
  const fertile = ovulation && regularity !== "irregular" ? { from: addDays(ovulation, -5), to: addDays(ovulation, 1) } : null;

  // bleeding length from logged ends (end must fall 2–15 days after a start)
  const days: number[] = [];
  for (const e of opts.ends ?? []) {
    const st = [...starts].reverse().find((s) => s <= e);
    if (!st) continue;
    const d = dayDiff(e, st) + 1;
    if (d >= 2 && d <= 15) days.push(d);
  }

  const confidence = clamp((n === 0 ? 0.25 : n === 1 ? 0.4 : n === 2 ? 0.5 : n < 6 ? 0.62 : 0.8) - (regularity === "irregular" ? 0.2 : regularity === "variable" ? 0.08 : 0), 0.15, 0.9);

  return {
    length,
    spread,
    next,
    early: next ? addDays(next, -w) : null,
    late: next ? addDays(next, w) : null,
    ovulation,
    fertile,
    regularity,
    range,
    outside: recent.filter((L) => L < 24 || L > 38),
    periodDays: days.length ? r1(mean(days.slice(-6))) : null,
    confidence,
    basis: n === 0 ? (opts.typical ? "your own estimate" : "a typical 28-day cycle") : `${n} cycle${n === 1 ? "" : "s"} you logged`,
  };
}
