import type { Levers } from "../store";
import { clamp, round } from "../rng";

/* ------------------------------------------------------------------ *
 * Future Self simulator — ILLUSTRATIVE trajectories, not predictions.
 * Three indices (0–100) from today's age to 80. Path A = current
 * habits; Path B = the levers she switches on. Menopause (≈51) adds an
 * inflection for bone and cardiometabolic health, which is when most
 * women's risk curves change shape.
 * ------------------------------------------------------------------ */

export interface FuturePoint {
  age: number;
  bone: number;
  heart: number;
  energy: number;
}

export interface FutureResult {
  a: FuturePoint[];
  b: FuturePoint[];
  healthspanA: number;
  healthspanB: number;
  gain: number;
}

const MENO = 51;

function curve(age0: number, l: Levers | null, ironLow: boolean): FuturePoint[] {
  const pts: FuturePoint[] = [];
  for (let age = age0; age <= 80; age++) {
    const t = age - age0;
    const post = Math.max(0, age - MENO);
    const lever = (k: keyof Levers) => (l && l[k] ? 1 : 0);

    // Bone: slow loss, accelerated in the first post-menopausal decade.
    const boneLoss = 0.25 * t + 1.4 * Math.min(post, 8) + 0.45 * Math.max(0, post - 8);
    const boneGain = lever("strength") * (6 + 0.18 * t) + lever("menoCare") * Math.min(post, 10) * 0.75 + lever("nutrition") * 2;
    const bone = 92 - boneLoss + boneGain;

    // Heart / metabolic: steady, steeper after menopause.
    const heartLoss = 0.32 * t + 0.9 * post;
    const heartGain =
      lever("sleep") * (3 + 0.08 * t) + lever("nutrition") * (3 + 0.12 * t) + lever("strength") * (2 + 0.1 * t) + lever("menoCare") * post * 0.25;
    const heart = 90 - heartLoss + heartGain;

    // Energy: hit now by low iron; sleep and iron repletion recover it.
    const ironPenalty = ironLow && !lever("iron") ? 9 : 0;
    const energy =
      84 - 0.35 * t - 0.5 * Math.min(post, 6) - ironPenalty + lever("iron") * 2 + lever("sleep") * 5 + lever("strength") * 3;

    pts.push({
      age,
      bone: clamp(round(bone, 1), 5, 100),
      heart: clamp(round(heart, 1), 5, 100),
      energy: clamp(round(energy, 1), 5, 100),
    });
  }
  return pts;
}

/** Healthspan here = last age at which the average index stays ≥ 60. */
function healthspan(pts: FuturePoint[]) {
  let last = pts[0].age;
  for (const p of pts) if ((p.bone + p.heart + p.energy) / 3 >= 60) last = p.age;
  // interpolate a fraction for smoother numbers
  return last;
}

export function simulate(age: number, levers: Levers, ironLow: boolean): FutureResult {
  const a = curve(age, null, ironLow);
  const b = curve(age, levers, ironLow);
  const healthspanA = healthspan(a);
  const healthspanB = healthspan(b);
  return { a, b, healthspanA, healthspanB, gain: healthspanB - healthspanA };
}

export const LEVERS: { key: keyof Levers; label: string; detail: string }[] = [
  { key: "strength", label: "Strength training 3×/week", detail: "Loads bone and muscle — the biggest lever for bone after 40." },
  { key: "iron", label: "Treat low iron", detail: "With a clinician: replete stores and address heavy bleeding." },
  { key: "sleep", label: "7.5 h sleep, cycle-timed", detail: "Protect sleep in the pre-period window." },
  { key: "nutrition", label: "Mediterranean-style eating", detail: "Fibre, olive oil, legumes, fish; fewer ultra-processed foods." },
  { key: "menoCare", label: "Plan menopause care early", detail: "Discuss evidence-based options with a clinician before symptoms peak." },
];
