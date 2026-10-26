import { mulberry32, startOfDay, addDays, clamp, round } from "./rng";

/* ------------------------------------------------------------------ *
 * Maya — the single synthetic profile the whole experience runs on.
 * 34, Calgary, thinking about egg freezing, painful heavy periods,
 * getting more tired. Everything here is SAMPLE DATA, not a patient.
 * ------------------------------------------------------------------ */

export type Phase = "menstrual" | "follicular" | "ovulatory" | "luteal";

export interface DayLog {
  date: Date;
  cycleIndex: number; // 0 = oldest complete cycle; cycles.length-1 = current
  cycleDay: number;
  phase: Phase;
  pain: number; // 0–10
  flow: number; // 0–4
  bowelPain: boolean;
  dyspareunia: boolean;
  fatigue: number; // 0–10
  sleep: number; // hours
  energy: number; // 0–100
  rhr: number; // resting heart rate, bpm
  temp: number; // skin-temperature deviation, °C
  hrv: number; // ms
  acne: boolean;
}

export interface LabPoint {
  date: Date;
  value: number;
}

export interface Lab {
  key: string;
  name: string;
  unit: string;
  range: [number, number];
  points: LabPoint[];
  source: string;
  phaseNote?: string;
}

export interface Cycle {
  start: Date;
  length: number | null; // null = current, not finished
}

export interface Profile {
  isSample: boolean;
  name: string;
  age: number;
  city: string;
  today: Date;
  cycles: Cycle[];
  logs: DayLog[];
  labs: Lab[];
  markers: {
    amh: number; // ng/mL
    fsh: number; // IU/L, cycle day 2–4
    familyEarlyMeno: boolean;
    epigeneticDelta: number; // years, DNAm age minus calendar age
  };
  redFlags: { chestPain: boolean; breathless: boolean; jawPain: boolean };
  genome: { label: string; value: string; note: string }[];
  microbiome: { label: string; value: string }[];
  goals: string[];
}

const PAST_LENGTHS = [29, 33, 27, 36, 31, 34];
const CURRENT_DAY = 24; // Maya is in her late luteal phase today

export function phaseFor(day: number, length: number): Phase {
  const ov = Math.max(10, length - 14);
  if (day <= 5) return "menstrual";
  if (day < ov - 1) return "follicular";
  if (day <= ov + 1) return "ovulatory";
  return "luteal";
}

/**
 * The server pre-renders pages once (at build time) and the browser
 * hydrates them later, possibly on another day or in another timezone.
 * The very first render therefore uses this fixed reference day on both
 * sides; hydrateStore() then switches to the visitor's real today.
 */
export const RENDER_ANCHOR = new Date(2026, 9, 20, 12);

export function createPersona(ref: Date = new Date()): Profile {
  const rnd = mulberry32(20261018);
  const today = startOfDay(ref);

  // Lay cycles backwards from today.
  const currentStart = addDays(today, -(CURRENT_DAY - 1));
  const cycles: Cycle[] = [];
  let cursor = currentStart;
  for (let i = PAST_LENGTHS.length - 1; i >= 0; i--) {
    cursor = addDays(cursor, -PAST_LENGTHS[i]);
    cycles.unshift({ start: cursor, length: PAST_LENGTHS[i] });
  }
  cycles.push({ start: currentStart, length: null });

  // Which past cycles carry the strongest pattern (5 of 6 heavy, 4 of 6 bowel pain).
  const heavy = [true, true, false, true, true, true, true];
  const bowel = [true, false, true, true, false, true, true];
  const highPain = [true, true, true, false, true, true, true];

  const logs: DayLog[] = [];
  const first = cycles[0].start;
  const total = Math.round((today.getTime() - first.getTime()) / 86_400_000) + 1;

  for (let i = 0; i < total; i++) {
    const date = addDays(first, i);
    let ci = 0;
    for (let c = 0; c < cycles.length; c++) if (cycles[c].start <= date) ci = c;
    const cyc = cycles[ci];
    const len = cyc.length ?? 31;
    const day = Math.round((date.getTime() - cyc.start.getTime()) / 86_400_000) + 1;
    const phase = phaseFor(day, len);
    const ov = Math.max(10, len - 14);
    const lateLuteal = phase === "luteal" && day > len - 5;
    const progress = i / total; // 0 → 1 across six months (ferritin falling)
    const n = () => rnd() - 0.5;

    let pain = 0;
    if (day === 1) pain = highPain[ci] ? 8 : 5;
    else if (day === 2) pain = highPain[ci] ? 7 : 4;
    else if (day === 3) pain = highPain[ci] ? 6 : 3;
    else if (day === 4) pain = 3;
    else if (Math.abs(day - ov) <= 0) pain = 3;
    else if (lateLuteal) pain = 2;
    else pain = rnd() < 0.15 ? 1 : 0;
    pain = clamp(Math.round(pain + n() * 1.4), 0, 10);

    const flowCurve = heavy[ci] ? [4, 4, 3, 2, 1] : [3, 2, 2, 1, 0];
    const flow = day <= 5 ? flowCurve[day - 1] : 0;

    const tempBase =
      phase === "luteal" ? 0.26 : phase === "ovulatory" ? 0.08 : phase === "menstrual" ? 0.02 : -0.1;
    const temp = round(tempBase + n() * 0.12, 2);

    const rhr = round(
      59 + (phase === "luteal" ? 2.6 : phase === "menstrual" ? 1.2 : 0) + progress * 1.8 + n() * 2.2,
      0,
    );
    const sleep = round(
      7.3 - (lateLuteal ? 0.9 : 0) - (phase === "menstrual" ? 0.45 : 0) + n() * 0.9,
      1,
    );
    const energy = clamp(
      Math.round(
        76 - (phase === "menstrual" ? 20 : 0) - (lateLuteal ? 11 : 0) - progress * 9 + n() * 10,
      ),
      8,
      100,
    );
    const hrv = Math.round(52 - (phase === "luteal" ? 6 : 0) - progress * 4 + n() * 9);

    logs.push({
      date,
      cycleIndex: ci,
      cycleDay: day,
      phase,
      pain,
      flow,
      bowelPain: bowel[ci] && day <= 2,
      dyspareunia: phase === "luteal" && day % 9 === 0 && ci % 2 === 1,
      fatigue: clamp(Math.round((100 - energy) / 10), 0, 10),
      sleep,
      energy,
      rhr,
      temp,
      hrv,
      acne: lateLuteal && rnd() < 0.3,
    });
  }

  const d = (n: number) => addDays(today, -n);
  const labs: Lab[] = [
    {
      key: "ferritin",
      name: "Ferritin",
      unit: "ng/mL",
      range: [15, 150],
      points: [
        { date: d(430), value: 41 },
        { date: d(245), value: 29 },
        { date: d(74), value: 22 },
      ],
      source: "BioAro Labs · venous",
      phaseNote: "Not strongly cycle-dependent, but heavy bleeding drains iron stores month after month.",
    },
    {
      key: "hb",
      name: "Hemoglobin",
      unit: "g/L",
      range: [120, 160],
      points: [
        { date: d(430), value: 129 },
        { date: d(245), value: 125 },
        { date: d(74), value: 121 },
      ],
      source: "BioAro Labs · venous",
    },
    {
      key: "amh",
      name: "AMH",
      unit: "ng/mL",
      range: [1.0, 4.0],
      points: [{ date: d(74), value: 1.3 }],
      source: "BioAro Labs · venous",
      phaseNote: "Relatively stable across the cycle, so it can be drawn on any day.",
    },
    {
      key: "fsh",
      name: "FSH (day 3)",
      unit: "IU/L",
      range: [3.5, 12.5],
      points: [{ date: d(74), value: 9.1 }],
      source: "BioAro Labs · venous",
      phaseNote: "Only interpretable on cycle days 2–4. Drawn on the wrong day it can mislead.",
    },
    {
      key: "e2",
      name: "Estradiol (day 3)",
      unit: "pg/mL",
      range: [20, 80],
      points: [{ date: d(74), value: 48 }],
      source: "BioAro Labs · venous",
      phaseNote: "Varies more than tenfold across a cycle — a value means little without the cycle day.",
    },
    {
      key: "tsh",
      name: "TSH",
      unit: "mIU/L",
      range: [0.4, 4.0],
      points: [
        { date: d(430), value: 1.9 },
        { date: d(74), value: 2.1 },
      ],
      source: "BioAro Labs · venous",
    },
    {
      key: "vitd",
      name: "Vitamin D",
      unit: "nmol/L",
      range: [75, 250],
      points: [
        { date: d(430), value: 52 },
        { date: d(245), value: 68 },
        { date: d(74), value: 61 },
      ],
      source: "BioAro Labs · venous",
    },
    {
      key: "hba1c",
      name: "HbA1c",
      unit: "%",
      range: [4.0, 5.9],
      points: [{ date: d(74), value: 5.3 }],
      source: "BioAro Labs · venous",
    },
  ];

  return {
    isSample: true,
    name: "Maya",
    age: 34,
    city: "Calgary",
    today,
    cycles,
    logs,
    labs,
    markers: { amh: 1.3, fsh: 9.1, familyEarlyMeno: false, epigeneticDelta: 0.8 },
    redFlags: { chestPain: false, breathless: false, jawPain: false },
    genome: [
      { label: "CYP2C19", value: "Intermediate metaboliser", note: "Affects how some medicines are processed." },
      { label: "Menopause timing", value: "Average polygenic estimate", note: "Population-level signal, not a prediction." },
      { label: "BRCA1/2", value: "Not tested", note: "Needs its own explicit consent." },
    ],
    microbiome: [
      { label: "Vaginal", value: "Lactobacillus crispatus–dominant" },
      { label: "Gut", value: "Moderate diversity" },
    ],
    goals: ["Understand my fertility timeline", "Find out why periods are so painful", "Get my energy back"],
  };
}

/** Add or replace today's log (used by quick-log controls in Space mode). */
export function withTodayLog(p: Profile, patch: Partial<DayLog>): Profile {
  const logs = p.logs.slice();
  const last = logs[logs.length - 1];
  logs[logs.length - 1] = { ...last, ...patch };
  return { ...p, logs };
}

export function latest(lab: Lab) {
  return lab.points[lab.points.length - 1];
}
