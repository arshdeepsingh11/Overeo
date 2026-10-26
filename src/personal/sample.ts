import { createPersona } from "../core/persona";
import { SCHEMA_VERSION, type Account, type AnyRecord, type DiaryEntry, type MeasurementType, type Reminder, type ValueMap } from "./types";

/* ------------------------------------------------------------------ *
 * Maya's sample space — built from the same synthetic persona the rest
 * of the site uses, converted into the personal record contract. Every
 * record is marked isSimulated and labelled "Sample data".
 * ------------------------------------------------------------------ */

export const MAYA_ACCOUNT: Account = {
  id: "sample-maya",
  name: "Maya",
  createdAt: "2026-04-01T00:00:00.000Z",
  goals: ["fertility", "periods", "energy"],
  stage: "cycling",
  typicalCycle: 31,
  birthYear: 1992,
  consent: { personalise: true, genetics: false, notifications: false, research: false },
};

let n = 0;
function rec<K extends MeasurementType>(type: K, value: ValueMap[K], at: Date): AnyRecord {
  const iso = at.toISOString();
  return {
    id: `s_${(n++).toString(36)}`,
    scope: { mode: "sample", namespaceId: "sample" },
    type,
    value,
    observedAt: iso,
    createdAt: iso,
    updatedAt: iso,
    source: { origin: "sample", label: "Sample data" },
    confirmationStatus: "confirmed",
    status: "active",
    history: [{ revisionNumber: 1, changedAt: iso, changedBy: "system", reason: "created" }],
    isSimulated: true,
    schemaVersion: SCHEMA_VERSION,
  } as AnyRecord;
}

const at = (d: Date, h: number) => {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return x;
};

const MOOD_LABEL = ["", "Low", "Flat", "Okay", "Good", "Great"];

export function buildSampleSpace() {
  n = 0;
  const p = createPersona();
  const records: AnyRecord[] = [];

  p.cycles.forEach((c) => records.push(rec("period_start", { flow: 4 }, at(c.start, 8))));
  for (const l of p.logs) {
    if (l.cycleDay === 5) records.push(rec("period_end", {}, at(l.date, 20)));
    if (l.pain >= 3) records.push(rec("symptom", { name: "Pelvic pain", severity: l.pain }, at(l.date, 21)));
    if (l.bowelPain) records.push(rec("symptom", { name: "Painful bowel movements", severity: 6 }, at(l.date, 21)));
    if (l.dyspareunia) records.push(rec("symptom", { name: "Pain with sex", severity: 5 }, at(l.date, 22)));
    const score = (l.energy >= 72 ? 4 : l.energy >= 58 ? 3 : l.energy >= 45 ? 2 : 1) as 1 | 2 | 3 | 4;
    records.push(rec("mood", { score, label: MOOD_LABEL[score] }, at(l.date, 21)));
    records.push(rec("sleep_duration", { minutes: Math.round(l.sleep * 60), quality: l.sleep >= 7 ? 3 : l.sleep >= 6.3 ? 2 : 1 }, at(l.date, 7)));
    records.push(rec("morning_temperature", { celsius: Math.round((36.45 + l.temp) * 100) / 100 }, at(l.date, 7)));
  }
  // a blood-pressure reading roughly every two weeks
  p.logs.filter((_, i) => i % 14 === 3).forEach((l, i) => records.push(rec("blood_pressure", { systolic: 112 + (i % 3) * 2, diastolic: 72 + (i % 2) * 2, pulse: l.rhr }, at(l.date, 8))));
  p.logs.filter((_, i) => i % 30 === 10).forEach((l, i) => records.push(rec("weight", { kg: 61.5 + (i % 3) * 0.3 }, at(l.date, 7))));
  for (const lab of p.labs)
    for (const pt of lab.points) records.push(rec("lab_result", { testName: lab.name, value: pt.value, unit: lab.unit, low: lab.range[0], high: lab.range[1], lab: "BioAro Labs" }, at(pt.date, 9)));

  const now = new Date();
  const later = (d: number, h = 20) => {
    const x = new Date(now);
    x.setDate(x.getDate() + d);
    x.setHours(h, 0, 0, 0);
    return x.toISOString();
  };
  const reminders: Reminder[] = [{ id: "s_rem1", title: "Take vitamin D", due: later(1, 9), agent: "you", done: false }];
  const diary: DiaryEntry[] = [{ id: "s_d1", at: new Date(now.getTime() - 86_400_000).toISOString(), agent: "you", action: "Set a reminder", detail: "Take vitamin D" }];
  return { records, reminders, diary };
}
