/* =====================================================================
   OVEREO personal data contract (v1).

   One verified record model that every screen, agent and SI read from.
   Follows the reviewed D1 contract: provenance, confirmation, revisions,
   sample/real isolation and schema versioning. Only CONFIRMED + ACTIVE
   records ever enter calculations.
   ===================================================================== */

export const SCHEMA_VERSION = 1;

export type SpaceMode = "sample" | "real";

export type RecordOrigin = "manual" | "uploaded_document" | "calculated" | "si_suggested" | "sample";
export type ConfirmationStatus = "unconfirmed" | "confirmed" | "corrected" | "rejected";
export type RecordStatus = "active" | "superseded" | "archived";

export type MeasurementType =
  | "period_start"
  | "period_end"
  | "symptom"
  | "mood"
  | "sleep_duration"
  | "blood_pressure"
  | "morning_temperature"
  | "lab_result"
  | "medication"
  | "weight";

export type SourceLabel = "You entered this" | "From your uploaded document" | "Calculated" | "Suggested by SI" | "Sample data";

export interface SourceReference {
  origin: RecordOrigin;
  label: SourceLabel;
  documentId?: string;
}

export interface RecordRevision {
  revisionNumber: number;
  changedAt: string;
  changedBy: "user" | "system";
  reason: "created" | "user_correction" | "confirmation" | "rejection" | "archived";
  previousValue?: unknown;
}

/* -------- typed values -------- */
export interface PeriodValue {
  flow?: 1 | 2 | 3 | 4;
}
export interface SymptomValue {
  name: string;
  severity: number; // 0–10
}
export interface MoodValue {
  score: 1 | 2 | 3 | 4 | 5; // 1 low … 5 great
  label: string;
}
export interface SleepValue {
  minutes: number;
  quality?: 1 | 2 | 3;
}
export interface BloodPressureValue {
  systolic: number;
  diastolic: number;
  pulse?: number;
}
export interface TemperatureValue {
  celsius: number;
}
export interface LabValue {
  testName: string;
  value: number;
  unit: string;
  low?: number;
  high?: number;
  lab?: string;
}
export interface MedicationValue {
  name: string;
  taken: boolean;
}
export interface WeightValue {
  kg: number;
}

export interface ValueMap {
  period_start: PeriodValue;
  period_end: PeriodValue;
  symptom: SymptomValue;
  mood: MoodValue;
  sleep_duration: SleepValue;
  blood_pressure: BloodPressureValue;
  morning_temperature: TemperatureValue;
  lab_result: LabValue;
  medication: MedicationValue;
  weight: WeightValue;
}

export interface HealthRecord<K extends MeasurementType = MeasurementType> {
  id: string;
  scope: { mode: SpaceMode; namespaceId: string };
  type: K;
  value: ValueMap[K];
  /** when it happened (ISO) */
  observedAt: string;
  createdAt: string;
  updatedAt: string;
  source: SourceReference;
  confirmationStatus: ConfirmationStatus;
  status: RecordStatus;
  history: RecordRevision[];
  isSimulated: boolean;
  schemaVersion: number;
}

export type AnyRecord = { [K in MeasurementType]: HealthRecord<K> }[MeasurementType];

/* ---------------------------- account ---------------------------- */
export type Goal = "periods" | "fertility" | "egg-freezing" | "pregnancy" | "menopause" | "energy" | "general";
export type LifeStage = "cycling" | "trying" | "pregnant" | "postpartum" | "peri" | "post";

export interface Account {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  goals: Goal[];
  stage: LifeStage;
  /** her own estimate before OVEREO has learned it */
  typicalCycle?: number;
  birthYear?: number;
  consent: { personalise: boolean; genetics: boolean; notifications: boolean; research: boolean };
}

/* ---------------------------- agents ---------------------------- */
export type AgentId = "cycle" | "labs" | "visit" | "reminders" | "meds" | "mood" | "fertility" | "meno";
export type Frequency = "important" | "daily" | "weekly";

export interface AgentSettings {
  enabled: boolean;
  /** what it may do */
  may: { remind: boolean; suggestTests: boolean; summaries: boolean; notify: boolean };
  /** her own "never" rules, in her words */
  never: string[];
  frequency: Frequency;
  quiet: { from: number; to: number }; // hours, local
}

export type ActionKind = "reminder" | "plan" | "summary" | "log" | "test" | "info";

export interface Suggestion {
  id: string;
  /** dedupe key: one live suggestion per key */
  key: string;
  agent: AgentId;
  kind: ActionKind;
  title: string;
  body: string;
  /** why — evidence in plain words */
  why: string[];
  createdAt: string;
  /** for reminders */
  due?: string;
  href?: string;
  status: "pending" | "approved" | "dismissed" | "snoozed";
  dismissReason?: "not-relevant" | "wrong" | "later";
}

export interface DiaryEntry {
  id: string;
  at: string;
  agent: AgentId | "you" | "si";
  action: string;
  detail?: string;
  undo?: { kind: "reminder"; id: string };
}

export interface Reminder {
  id: string;
  title: string;
  due: string;
  agent: AgentId | "you";
  done: boolean;
  notified?: boolean;
}

/* ---------------------------- memory ---------------------------- */
export interface MemoryItem {
  id: string;
  area: "cycle" | "mood" | "sleep" | "body" | "labs" | "habits" | "preferences" | "goals";
  text: string;
  /** how sure, 0–1 */
  confidence: number;
  evidence: string;
  /** learned from data vs told by her */
  kind: "learned" | "told" | "preference";
}

export interface MemoryOverride {
  id: string;
  action: "forget" | "correct";
  text?: string;
  at: string;
}

/* ---------------------------- prefs ---------------------------- */
export type Lang = "en" | "es" | "fr" | "pt" | "de" | "hi" | "pa" | "zh";

export interface Prefs {
  lang: Lang;
  discreet: boolean;
  lock: { pinHash: string; salt: string; afterMinutes: number } | null;
  notifications: boolean;
  units: { temp: "C" | "F"; weight: "kg" | "lb" };
}
