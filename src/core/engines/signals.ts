import type { Profile } from "../persona";
import { latest } from "../persona";
import { clamp, round, sd, mean } from "../rng";

/* ------------------------------------------------------------------ *
 * Silent Signal engine — looks across months of entries for patterns
 * that research shows are commonly recognised late in women.
 *
 * It does not diagnose. "Strength" describes how consistently a pattern
 * appears in the entries — not the probability of any condition.
 * Every pattern routes to a person on the in-house care team.
 * ------------------------------------------------------------------ */

export type SignalLevel = "watch" | "emerging" | "strong" | "urgent";

export interface Signal {
  id: string;
  title: string;
  short: string;
  strength: number; // 0..1
  level: SignalLevel;
  evidence: string[];
  context: string; // research context
  route: { team: string; via: string };
  questions: string[];
  nextSteps: string[];
  angle: number; // radar placement, degrees
}

const level = (s: number): SignalLevel => (s >= 0.66 ? "strong" : s >= 0.4 ? "emerging" : "watch");

export function computeSignals(p: Profile): Signal[] {
  const out: Signal[] = [];
  const byCycle = new Map<number, typeof p.logs>();
  for (const l of p.logs) {
    if (!byCycle.has(l.cycleIndex)) byCycle.set(l.cycleIndex, []);
    byCycle.get(l.cycleIndex)!.push(l);
  }
  const complete = [...byCycle.entries()].filter(([i]) => p.cycles[i]?.length != null).map(([, v]) => v);
  const n = Math.max(1, complete.length);

  // Cardiac red flag — not a pattern to watch, a reason to act now.
  const rf = p.redFlags;
  if (rf.chestPain && (rf.breathless || rf.jawPain)) {
    out.push({
      id: "cardiac",
      title: "Possible heart symptoms",
      short: "Seek care now",
      strength: 1,
      level: "urgent",
      evidence: [
        "Chest discomfort logged together with breathlessness or jaw / arm pain.",
        "Women more often have symptoms beyond classic chest pain.",
      ],
      context:
        "Heart attacks are more often misdiagnosed in women. Don't wait for a pattern — call emergency services if symptoms are happening now.",
      route: { team: "Emergency services (911)", via: "Then: Advanced Cardiology follow-up" },
      questions: [],
      nextSteps: ["Call 911 if symptoms are present now", "Do not drive yourself"],
      angle: 0,
    });
  }

  // 1) Endometriosis-like pain pattern
  const painfulCycles = complete.filter((c) => c.some((l) => l.cycleDay <= 3 && l.pain >= 7)).length;
  const bowelCycles = complete.filter((c) => c.some((l) => l.bowelPain)).length;
  const dysp = p.logs.filter((l) => l.dyspareunia).length;
  const endo = clamp(
    (painfulCycles / n) * 0.55 + (bowelCycles / n) * 0.3 + Math.min(dysp, 3) * 0.05,
    0,
    1,
  );
  if (endo > 0.15)
    out.push({
      id: "endo",
      title: "Cyclical pelvic pain pattern",
      short: "Endometriosis-like pattern",
      strength: round(endo, 2),
      level: level(endo),
      evidence: [
        `Pain ≥ 7/10 in the first days of ${painfulCycles} of ${n} cycles`,
        `Bowel pain during periods in ${bowelCycles} of ${n} cycles`,
        dysp ? `Pain with sex logged ${dysp} times` : "No pain with sex logged",
      ],
      context:
        "Endometriosis takes on average about 10 years to diagnose. Recognising a consistent pattern early can shorten that.",
      route: { team: "OVEREO women's health clinician", via: "NEYU Virtual Care → pelvic ultrasound via NEYU Diagnostics" },
      questions: [
        "Could my period pain pattern be endometriosis or adenomyosis?",
        "Would a specialist pelvic ultrasound be useful for me?",
        "What are the options if I want to protect my fertility as well?",
      ],
      nextSteps: ["Share the dossier with a clinician", "Keep logging pain on days 1–3"],
      angle: 38,
    });

  // 2) Iron depletion pattern
  const ferr = p.labs.find((l) => l.key === "ferritin");
  const ferrPts = ferr?.points ?? [];
  const ferrDrop = ferrPts.length > 1 ? ferrPts[0].value - ferrPts[ferrPts.length - 1].value : 0;
  const heavyCycles = complete.filter((c) => c.filter((l) => l.flow >= 3).length >= 3).length;
  const early = mean(p.logs.slice(0, 45).map((l) => l.energy));
  const recent = mean(p.logs.slice(-45).map((l) => l.energy));
  const energyDrop = early - recent;
  const iron = clamp(
    (heavyCycles / n) * 0.4 + clamp(ferrDrop / 25, 0, 1) * 0.4 + clamp(energyDrop / 15, 0, 1) * 0.2,
    0,
    1,
  );
  if (iron > 0.15 && ferr)
    out.push({
      id: "iron",
      title: "Iron running down",
      short: "Heavy flow + falling ferritin",
      strength: round(iron, 2),
      level: level(iron),
      evidence: [
        `Heavy flow (3+ heavy days) in ${heavyCycles} of ${n} cycles`,
        `Ferritin ${ferrPts[0]?.value} → ${latest(ferr).value} ${ferr.unit} across ${ferrPts.length} tests`,
        `Average energy down ${Math.round(energyDrop)} points over six months`,
      ],
      context:
        "Heavy menstrual bleeding is a common, under-recognised cause of low iron, which can drive fatigue well before anaemia shows.",
      route: { team: "NEYU internal medicine", via: "Repeat ferritin + CBC through BioAro Labs at-home collection" },
      questions: [
        "Is my ferritin low enough to treat, given my symptoms?",
        "Should we look at why my periods are so heavy?",
      ],
      nextSteps: ["Repeat ferritin in 8–12 weeks", "Track energy daily"],
      angle: 128,
    });

  // 3) Cycle rhythm / PCOS-like screen
  const lengths = p.cycles.map((c) => c.length).filter((x): x is number => x != null);
  const cs = sd(lengths);
  const long = lengths.filter((x) => x > 35).length;
  const acneDays = p.logs.filter((l) => l.acne).length;
  const rhythm = clamp((cs / 8) * 0.6 + (long / Math.max(1, lengths.length)) * 0.6 + Math.min(acneDays, 10) * 0.012, 0, 1);
  out.push({
    id: "rhythm",
    title: "Cycle rhythm",
    short: rhythm > 0.55 ? "Irregular cycles — PCOS screen worth discussing" : "Some variation — keep watching",
    strength: round(rhythm, 2),
    level: level(rhythm),
    evidence: [
      `Cycle lengths ${Math.min(...lengths)}–${Math.max(...lengths)} days (±${round(cs, 1)})`,
      `${long} cycle(s) longer than 35 days`,
      `Breakouts logged on ${acneDays} days, clustered late in the cycle`,
    ],
    context:
      "PCOS is common and often found late. One irregular cycle means little; the pattern over months matters.",
    route: { team: "Endocrinology (Advanced Cardiology clinic)", via: "If the pattern grows: androgen panel via BioAro Labs" },
    questions: ["Is my cycle variation within the normal range?", "When would PCOS testing make sense?"],
    nextSteps: ["Keep logging period start dates"],
    angle: 222,
  });

  // 4) Late-luteal sleep & mood
  const ll = p.logs.filter((l) => l.phase === "luteal" && l.cycleDay > (p.cycles[l.cycleIndex].length ?? 31) - 5);
  const rest = p.logs.filter((l) => !ll.includes(l));
  const sleepGap = mean(rest.map((l) => l.sleep)) - mean(ll.map((l) => l.sleep));
  const lut = clamp(sleepGap / 1.6, 0, 1);
  out.push({
    id: "luteal",
    title: "Pre-period sleep dip",
    short: "Sleep drops before each period",
    strength: round(lut, 2),
    level: level(lut),
    evidence: [`Sleep ${round(sleepGap, 1)} h shorter in the 5 days before a period`, "Repeats across cycles"],
    context: "Hormone shifts in the late luteal phase affect sleep for many women. Timing support to the cycle can help.",
    route: { team: "BioMynd sleep & mood", via: "Cycle-timed sleep plan" },
    questions: ["Could my sleep changes be cycle-related?", "What can help in the days before my period?"],
    nextSteps: ["Turn on cycle-timed sleep reminders"],
    angle: 300,
  });

  // Perimenopause-like transition (appears only if age/markers fit)
  if (p.age >= 40 && (p.markers.fsh > 12 || cs > 6)) {
    const peri = clamp((p.age - 38) / 10 + (p.markers.fsh - 10) / 20, 0, 1);
    out.push({
      id: "peri",
      title: "Possible perimenopause transition",
      short: "Cycle and hormone changes",
      strength: round(peri, 2),
      level: level(peri),
      evidence: [`Age ${p.age}`, `FSH ${p.markers.fsh} IU/L`, `Cycle variation ±${round(cs, 1)} days`],
      context: "Over 80% of women with menopause symptoms don't seek care. Naming the transition early opens options.",
      route: { team: "OVEREO menopause clinician", via: "NEYU Virtual Care" },
      questions: ["Am I in perimenopause?", "What are my evidence-based options?"],
      nextSteps: ["Log hot flushes and night sweats"],
      angle: 175,
    });
  }

  return out.sort((a, b) => b.strength - a.strength);
}

export const levelLabel: Record<SignalLevel, string> = {
  watch: "Watch",
  emerging: "Emerging",
  strong: "Strong pattern",
  urgent: "Act now",
};
