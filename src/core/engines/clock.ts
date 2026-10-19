import type { Profile } from "../persona";
import { clamp, round, sd } from "../rng";

/* ------------------------------------------------------------------ *
 * The Ovarian Clock — ILLUSTRATIVE model for the prototype.
 *
 * Idea: express a woman's reproductive markers as the age at which
 * those markers are most typical. AMH falls roughly exponentially with
 * age, so we invert a smooth median curve:
 *     median AMH(age) ≈ 4.5 · e^(−0.09 · (age − 22))   [ng/mL]
 * then nudge for FSH, cycle variability, family history and an
 * epigenetic (DNAm) age delta.
 *
 * This is NOT a diagnostic or a fertility forecast. AMH describes egg
 * quantity, not quality, and does not predict natural conception.
 * Before launch the curve must be replaced with a validated, lab- and
 * assay-specific nomogram and reviewed by OVEREO's clinicians.
 * ------------------------------------------------------------------ */

export const medianAmh = (age: number) => 4.5 * Math.exp(-0.09 * (age - 22));
export const amhAge = (amh: number) => 22 - Math.log(Math.max(0.05, amh) / 4.5) / 0.09;

export interface ClockFactor {
  label: string;
  years: number;
  why: string;
}

export interface ClockResult {
  calendarAge: number;
  markerAge: number;
  delta: number;
  band: [number, number];
  factors: ClockFactor[];
  percentile: number; // AMH percentile vs same-age median, rough
  cycleSd: number;
  verdict: string;
  /** 0..1 — how far through the reproductive span (≈ age 15 → 51) the marker age sits */
  span: number;
}

export function computeClock(p: Profile): ClockResult {
  const { amh, fsh, familyEarlyMeno, epigeneticDelta } = p.markers;
  const lengths = p.cycles.map((c) => c.length).filter((x): x is number => x != null);
  const cycleSd = sd(lengths);

  const base = clamp(amhAge(amh), 18, 56);
  const factors: ClockFactor[] = [
    {
      label: "AMH",
      years: round(base - p.age, 1),
      why: `AMH ${amh} ng/mL is most typical around age ${Math.round(base)}.`,
    },
  ];

  const fshAdj = fsh > 10 ? clamp((fsh - 10) * 0.6, 0, 4) : fsh < 6 ? -0.3 : 0;
  if (fshAdj) factors.push({ label: "FSH", years: round(fshAdj, 1), why: `Day-3 FSH ${fsh} IU/L.` });
  else factors.push({ label: "FSH", years: 0, why: `Day-3 FSH ${fsh} IU/L sits in the usual range.` });

  const varAdj = cycleSd > 4 ? 0.9 : cycleSd > 3 ? 0.4 : 0;
  factors.push({
    label: "Cycle rhythm",
    years: varAdj,
    why: `Cycle length varies by ±${round(cycleSd, 1)} days.`,
  });

  if (familyEarlyMeno)
    factors.push({ label: "Family history", years: 1.5, why: "Early menopause in a close relative." });

  const epiAdj = round(clamp(epigeneticDelta, -5, 5) * 0.35, 1);
  factors.push({
    label: "Epigenetic age",
    years: epiAdj,
    why: `DNA-methylation age runs ${epigeneticDelta >= 0 ? "+" : ""}${epigeneticDelta} y vs calendar.`,
  });

  const markerAge = round(base + fshAdj + varAdj + (familyEarlyMeno ? 1.5 : 0) + epiAdj, 1);
  const delta = round(markerAge - p.age, 1);
  const percentile = clamp(Math.round(50 * Math.exp(Math.log(amh / medianAmh(p.age)) / 0.9)), 2, 98);
  const verdict =
    Math.abs(delta) < 1.5
      ? "in step with your calendar age"
      : delta > 0
        ? `running about ${Math.abs(delta)} years ahead`
        : `running about ${Math.abs(delta)} years behind`;

  return {
    calendarAge: p.age,
    markerAge,
    delta,
    band: [round(markerAge - 3, 0), round(markerAge + 3, 0)],
    factors,
    percentile,
    cycleSd: round(cycleSd, 1),
    verdict,
    span: clamp((markerAge - 15) / (51 - 15), 0, 1),
  };
}
