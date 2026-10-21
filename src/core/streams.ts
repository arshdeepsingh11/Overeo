import type { Derived } from "./derived";
import type { DayLog, Phase } from "./persona";
import { latest } from "./persona";
import { levelLabel } from "./engines/signals";
import { ORGS } from "./ecosystem";
import type { IconName } from "../ui/Icon";

/* =====================================================================
   Streams — every kind of information OVEREO reads, described once.

   Each stream has: what it is, how it gets in (manual entry, a photo or
   a PDF — no wearables yet), why it matters with a real source, and a
   live reading computed from her own data. The hero strip, the
   convergence section and SI all read from here, so a fact is written
   in one place and a number is never made up.
   ===================================================================== */

export type StreamId =
  | "cycle"
  | "temp"
  | "heart"
  | "sleep"
  | "labs"
  | "genome"
  | "micro"
  | "symptoms"
  | "meds"
  | "clock"
  | "signals"
  | "future"
  | "care"
  | "privacy"
  | "notes";

export interface StreamSource {
  label: string;
  url?: string;
}

export interface StreamInfo {
  id: StreamId;
  label: string;
  icon: IconName;
  hue: number;
  /** what this stream is, in one sentence */
  what: string;
  /** how it gets into OVEREO today */
  input: string;
  /** why it matters — a sourced fact */
  why: string;
  source: StreamSource;
  /** where to go deeper inside OVEREO */
  href: string;
  ask: string;
}

export const STREAMS: Record<StreamId, StreamInfo> = {
  cycle: {
    id: "cycle",
    label: "Cycle",
    icon: "cycle",
    hue: 340,
    what: "Her period start dates and daily logs — the timeline every other stream is read against.",
    input: "Tapped in each day, or imported from a period-app export.",
    why: "FIGO counts cycles as regular when the shortest and longest differ by no more than 7–9 days, depending on age.",
    source: { label: "FIGO menstrual disorders system (2018)", url: "https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666" },
    href: "/cycle",
    ask: "Is her cycle regular?",
  },
  temp: {
    id: "temp",
    label: "Temperature",
    icon: "waves",
    hue: 20,
    what: "Her waking temperature, compared with her own baseline.",
    input: "Entered from a basal thermometer each morning — no wearable needed.",
    why: "After ovulation, progesterone raises resting temperature by roughly 0.3–0.5 °C, so a sustained rise dates ovulation after the fact.",
    source: { label: "ACOG · Fertility awareness-based methods", url: "https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning" },
    href: "/cycle?tab=lens",
    ask: "What does her temperature show this cycle?",
  },
  heart: {
    id: "heart",
    label: "Heart",
    icon: "heart",
    hue: 330,
    what: "Morning pulse, blood pressure and the heart questions she answers.",
    input: "A pulse she counts or reads off a cuff — typed in or photographed.",
    why: "Heart disease is the leading cause of death in women, and women more often have symptoms like breathlessness, nausea, or jaw and back pain.",
    source: { label: "American Heart Association", url: "https://www.heart.org/en/health-topics/heart-attack/warning-signs-of-a-heart-attack/heart-attack-symptoms-in-women" },
    href: "/specialties/heart",
    ask: "Tell me about women's heart health",
  },
  sleep: {
    id: "sleep",
    label: "Sleep",
    icon: "moon",
    hue: 300,
    what: "Hours slept and how rested she feels, logged each morning.",
    input: "Two taps on waking.",
    why: "Sleep is often lighter and more disrupted in the days before a period, especially with premenstrual symptoms.",
    source: { label: "Baker & Lee, Sleep Medicine Clinics (2018)", url: "https://doi.org/10.1016/j.jsmc.2018.04.002" },
    href: "/today",
    ask: "Why does sleep drop before her period?",
  },
  labs: {
    id: "labs",
    label: "Labs",
    icon: "flask",
    hue: 25,
    what: "BioAro Labs and clinic results, dated and kept as one history.",
    input: "Uploaded as a PDF or a photo of the report — read line by line, then confirmed by her.",
    why: "A ferritin under about 30 ng/mL points to iron deficiency even while hemoglobin is still normal — common with heavy periods.",
    source: { label: "Pasricha et al., The Lancet (2021)", url: "https://doi.org/10.1016/S0140-6736(20)32594-0" },
    href: "/tests",
    ask: "What do her labs show?",
  },
  genome: {
    id: "genome",
    label: "Genome",
    icon: "dna",
    hue: 310,
    what: "Pharmacogenomic and risk results, each behind its own consent.",
    input: "A BioAro genome report, uploaded once.",
    why: "CPIC guidelines use CYP2C19 results to guide choices for clopidogrel, several antidepressants and acid-reducing medicines.",
    source: { label: "CPIC guidelines", url: "https://cpicpgx.org/guidelines/" },
    href: "/specialties/longevity",
    ask: "How is genetic data handled?",
  },
  micro: {
    id: "micro",
    label: "Microbiome",
    icon: "target",
    hue: 35,
    what: "Gut and vaginal microbiome results from BioAro Labs.",
    input: "A BioGut or BioFemme report, uploaded as a PDF.",
    why: "Vaginal communities dominated by Lactobacillus crispatus are linked with a lower pH and fewer signs of bacterial vaginosis.",
    source: { label: "Ravel et al., PNAS (2011)", url: "https://www.pnas.org/doi/10.1073/pnas.1002611107" },
    href: "/specialties/gut",
    ask: "What does her microbiome show?",
  },
  symptoms: {
    id: "symptoms",
    label: "Symptoms",
    icon: "drop",
    hue: 335,
    what: "Pain, flow, bowel symptoms and fatigue — logged, or simply said to SI.",
    input: "A slider, a body map, or a sentence.",
    why: "Cyclical pelvic pain, pain with bowel movements and pain with sex are symptoms ESHRE lists as reasons to consider endometriosis.",
    source: { label: "ESHRE endometriosis guideline (2022)", url: "https://www.eshre.eu/Guideline/Endometriosis" },
    href: "/tools?tab=pain",
    ask: "Is this endometriosis?",
  },
  meds: {
    id: "meds",
    label: "Medicines",
    icon: "shield",
    hue: 290,
    what: "Medicines and supplements she takes.",
    input: "Typed in, or a photo of the label or prescription.",
    why: "Women experience adverse drug reactions nearly twice as often as men — many doses were set on data from men.",
    source: { label: "Zucker & Prendergast, Biology of Sex Differences (2020)", url: "https://bsd.biomedcentral.com/articles/10.1186/s13293-020-00308-5" },
    href: "/specialties/longevity",
    ask: "Why do women get more drug side effects?",
  },
  clock: {
    id: "clock",
    label: "Ovarian Clock",
    icon: "clock",
    hue: 320,
    what: "AMH, FSH, cycle variability and family history read together as one timeline.",
    input: "Built from her labs and answers — nothing extra to enter.",
    why: "AMH reflects how many eggs remain, not their quality — in a large study it did not predict natural fertility in women aged 30–44.",
    source: { label: "Steiner et al., JAMA (2017)", url: "https://jamanetwork.com/journals/jama/fullarticle/2656810" },
    href: "/clock",
    ask: "Explain her Ovarian Clock",
  },
  signals: {
    id: "signals",
    label: "Signals",
    icon: "radar",
    hue: 328,
    what: "Patterns that repeat across her streams, scored by how consistently they recur.",
    input: "Found by SI — she never has to look for them.",
    why: "Across 770 diseases, women were on average diagnosed later than men.",
    source: { label: "Westergaard et al., Nature Communications (2019)", url: "https://www.nature.com/articles/s41467-019-08475-9" },
    href: "/signals",
    ask: "What patterns have you noticed?",
  },
  future: {
    id: "future",
    label: "Future Self",
    icon: "trend",
    hue: 22,
    what: "An illustrative model of how today's habits shape the decades ahead.",
    input: "Levers she switches on — strength training, sleep, iron.",
    why: "Women spend about 25% more of their lives in poor health than men.",
    source: { label: "McKinsey Health Institute × WEF (2024)", url: "https://www.mckinsey.com/mhi/our-insights/closing-the-womens-health-gap-a-1-trillion-dollar-opportunity-to-improve-lives-and-economies" },
    href: "/future",
    ask: "What if she starts strength training?",
  },
  care: {
    id: "care",
    label: "Care team",
    icon: "users",
    hue: 305,
    what: "The NEYU physicians and BioAro teams her results can route to.",
    input: "She chooses who sees what.",
    why: "One record means she never retells her story — and each team sees only what she has consented to share.",
    source: { label: "OVEREO care model" },
    href: "/care",
    ask: "Who will see her results?",
  },
  privacy: {
    id: "privacy",
    label: "Privacy",
    icon: "lock",
    hue: 315,
    what: "Her consent settings — one use at a time, revocable.",
    input: "Set by her, changed any time.",
    why: "In Canada, the Genetic Non-Discrimination Act makes it illegal to require a genetic test, or its results, for a service or contract.",
    source: { label: "Genetic Non-Discrimination Act (Canada)", url: "https://laws-lois.justice.gc.ca/eng/acts/G-2.5/" },
    href: "/privacy",
    ask: "Who sees my data?",
  },
  notes: {
    id: "notes",
    label: "BioEMR",
    icon: "doc",
    hue: 295,
    what: "Clinician notes from her visits, matched to the streams they mention.",
    input: "Shared from BioEMR with her consent, or a photo of a visit summary.",
    why: "When notes and her own logs sit in one record, nothing she said at a visit has to be repeated.",
    source: { label: "OVEREO care model" },
    href: "/care?tab=visit",
    ask: "What did her clinicians note?",
  },
};

/** The order the hero strip shows them in. */
export const STRIP: StreamId[] = ["cycle", "temp", "heart", "sleep", "labs", "genome", "micro", "symptoms", "meds", "clock", "signals", "future", "care", "privacy"];

/** The eight raw streams that converge on SI. */
export const CONVERGE: StreamId[] = ["cycle", "temp", "heart", "labs", "genome", "micro", "symptoms", "notes"];

/* ------------------------------------------------------------------ *
 * Her readings — computed from the profile, never typed by hand.
 * ------------------------------------------------------------------ */

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const signed = (x: number, dp = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(dp)}`;

function byPhase(logs: DayLog[], key: "temp" | "rhr" | "sleep" | "energy", phases: Phase[]) {
  return mean(logs.filter((l) => phases.includes(l.phase)).map((l) => l[key]));
}

export interface StreamFacts {
  lengths: number[];
  cycleMean: number;
  cycleMin: number;
  cycleMax: number;
  spread: number;
  /** FIGO: ≤7 days at 26–41, otherwise ≤9 */
  spreadLimit: number;
  current: DayLog[];
  tempShift: number;
  ovDay: number | null;
  rhrShift: number;
  rhrNow: number;
  rhrFirst: number;
  sleepLuteal: number;
  sleepFollicular: number;
  painByDay: number[];
  painMax: number;
  painfulDays: number;
  bowelCycles: number;
  dyspareuniaDays: number;
  heavyCycles: number;
  ferritin: { value: number; first: number; unit: string; points: { date: Date; value: number }[] };
  vitd: number | null;
}

export function streamFacts(d: Derived): StreamFacts {
  const p = d.profile;
  const lengths = p.cycles.map((c) => c.length).filter((x): x is number => x != null);
  const cycleMin = Math.min(...lengths);
  const cycleMax = Math.max(...lengths);
  const lastIdx = p.cycles.length - 1;
  const current = p.logs.filter((l) => l.cycleIndex === lastIdx);
  const past = p.logs.filter((l) => l.cycleIndex < lastIdx);
  // the first day of a sustained rise = first luteal day this cycle
  const firstLuteal = current.find((l) => l.phase === "luteal");
  const tempShift = byPhase(current, "temp", ["luteal"]) - byPhase(current, "temp", ["follicular"]);
  const rhrShift = byPhase(p.logs, "rhr", ["luteal"]) - byPhase(p.logs, "rhr", ["follicular"]);
  const painByDay = Array.from({ length: 10 }, (_, i) => r1(mean(past.filter((l) => l.cycleDay === i + 1).map((l) => l.pain))));
  const cycleIdx = [...new Set(past.map((l) => l.cycleIndex))];
  const ferr = p.labs.find((l) => l.key === "ferritin")!;
  const vitd = p.labs.find((l) => l.key === "vitd");
  return {
    lengths,
    cycleMean: r1(mean(lengths)),
    cycleMin,
    cycleMax,
    spread: cycleMax - cycleMin,
    spreadLimit: p.age >= 26 && p.age <= 41 ? 7 : 9,
    current,
    tempShift: r2(tempShift),
    ovDay: firstLuteal ? firstLuteal.cycleDay - 2 : null,
    rhrShift: r1(rhrShift),
    rhrNow: Math.round(mean(p.logs.slice(-7).map((l) => l.rhr))),
    rhrFirst: Math.round(mean(p.logs.slice(0, 28).map((l) => l.rhr))),
    sleepLuteal: r1(byPhase(p.logs.filter((l) => l.phase === "luteal" && l.cycleDay > 20), "sleep", ["luteal"])),
    sleepFollicular: r1(byPhase(p.logs, "sleep", ["follicular"])),
    painByDay,
    painMax: Math.max(...p.logs.map((l) => l.pain)),
    painfulDays: past.filter((l) => l.pain >= 7).length,
    bowelCycles: cycleIdx.filter((c) => past.some((l) => l.cycleIndex === c && l.bowelPain)).length,
    dyspareuniaDays: p.logs.filter((l) => l.dyspareunia).length,
    heavyCycles: cycleIdx.filter((c) => past.some((l) => l.cycleIndex === c && l.flow >= 4)).length,
    ferritin: { value: latest(ferr).value, first: ferr.points[0].value, unit: ferr.unit, points: ferr.points },
    vitd: vitd ? latest(vitd).value : null,
  };
}

export interface Reading {
  /** short value for chips and labels */
  value: string;
  /** one sentence: what SI reads in her data */
  insight: string;
  /** how firmly the data supports the insight */
  strength: "clear" | "emerging" | "watch" | "info";
}

export function readStream(id: StreamId, d: Derived, f: StreamFacts = streamFacts(d)): Reading {
  const p = d.profile;
  switch (id) {
    case "cycle": {
      const regular = f.spread <= f.spreadLimit;
      return {
        value: `day ${d.today.cycleDay}`,
        insight: `Six cycles average ${f.cycleMean} days (${f.cycleMin}–${f.cycleMax}). They vary by ${f.spread} days — ${regular ? "within" : "just beyond"} FIGO's ${f.spreadLimit}-day limit for her age, so the forecast keeps a ±${d.today.sdLength}-day margin.`,
        strength: regular ? "info" : "watch",
      };
    }
    case "temp":
      return {
        value: `${signed(f.tempShift, 2)} °C`,
        insight: f.ovDay
          ? `Her temperature rose ${f.tempShift.toFixed(2)} °C after day ${f.ovDay} and has held since — consistent with ovulation around day ${f.ovDay}, so her luteal phase is on track.`
          : `No sustained rise yet this cycle — ovulation hasn't been confirmed.`,
        strength: f.ovDay ? "clear" : "watch",
      };
    case "heart":
      return {
        value: `${f.rhrNow} bpm`,
        insight: `Her morning pulse runs ${signed(f.rhrShift)} bpm in the luteal phase — a normal cycle effect — but her baseline has crept from ${f.rhrFirst} to ${f.rhrNow} bpm as ferritin fell.`,
        strength: f.rhrNow - f.rhrFirst >= 2 ? "emerging" : "info",
      };
    case "sleep":
      return {
        value: `${f.sleepLuteal} h`,
        insight: `In the last days before each period she sleeps ${f.sleepLuteal} h, versus ${f.sleepFollicular} h mid-follicular — a repeatable pre-period dip, not random bad nights.`,
        strength: f.sleepFollicular - f.sleepLuteal >= 0.5 ? "emerging" : "info",
      };
    case "labs":
      return {
        value: `ferritin ${f.ferritin.value}`,
        insight: `Ferritin has fallen ${f.ferritin.first} → ${f.ferritin.value} ${f.ferritin.unit} over a year, now below 30, while ${f.heavyCycles} of her last 6 cycles were heavy. Iron is the strongest lead for her tiredness.`,
        strength: f.ferritin.value < 30 ? "clear" : "info",
      };
    case "genome": {
      const g = p.genome[0];
      return {
        value: `${g.label} IM`,
        insight: `${g.label}: ${g.value.toLowerCase()}. Any medicine CPIC links to ${g.label} gets flagged for her clinician before it's prescribed. BRCA stays untested until she gives its own consent.`,
        strength: "info",
      };
    }
    case "micro":
      return {
        value: "L. crispatus",
        insight: `Vaginal: ${p.microbiome[0].value} — the most protective community type. Gut: ${p.microbiome[1].value.toLowerCase()}. Nothing here explains her pain, which points SI back to the pelvic pattern.`,
        strength: "info",
      };
    case "symptoms":
      return {
        value: `pain ${f.painMax}/10`,
        insight: `Pain averages ${f.painByDay[0]}/10 on day 1 and fades by day 4, every cycle. ${f.bowelCycles} of 6 cycles also had painful bowel movements${f.dyspareuniaDays ? `, with ${f.dyspareuniaDays} days of pain with sex` : ""} — together, a pattern worth an endometriosis conversation.`,
        strength: "clear",
      };
    case "meds":
      return { value: "CYP2C19 IM", insight: "Her CYP2C19 result is applied to every medicine she adds, before anything else is suggested.", strength: "info" };
    case "clock":
      return {
        value: `${d.clock.markerAge}`,
        insight: `Marker age ${d.clock.markerAge} at ${d.clock.calendarAge}. ${d.clock.verdict}`,
        strength: "info",
      };
    case "signals": {
      const top = d.signals[0];
      const n = d.signals.filter((s) => s.level !== "watch").length;
      return {
        value: `${n} patterns`,
        insight: top ? `${n} patterns repeat across her streams. Strongest: ${top.title} (${levelLabel[top.level].toLowerCase()}).` : "Nothing repeating yet.",
        strength: top?.level === "strong" ? "clear" : "emerging",
      };
    }
    case "future":
      return {
        value: d.futures.gain ? `+${d.futures.gain} yrs` : "levers off",
        insight: d.futures.gain ? `With her chosen levers on, the model adds about ${d.futures.gain} healthy years — illustrative, with each input labelled by evidence strength.` : "Switch on a lever to see how the decades bend.",
        strength: "info",
      };
    case "care":
      return { value: `${ORGS.length} teams`, insight: `${ORGS.length} teams, one record. Her pelvic-pain pattern would route first to NEYU women's health.`, strength: "info" };
    case "privacy":
      return { value: "genetics off", insight: "Genetic data is off by default; every share is one use, for one purpose, and can be withdrawn.", strength: "info" };
    case "notes":
      return {
        value: "2 notes",
        insight: "Two visit notes (sample): fatigue and heavy periods raised at NEYU; ferritin flagged low with a recheck planned. SI matched both to her Labs and Symptoms streams.",
        strength: "info",
      };
  }
}

/** Sample clinician notes (synthetic — part of Maya's sample profile). */
export function sampleNotes(d: Derived) {
  const ferr = d.profile.labs.find((l) => l.key === "ferritin")!;
  const drawn = latest(ferr).date;
  const day = 86_400_000;
  return [
    { date: new Date(drawn.getTime() - 12 * day), who: "NEYU Health · women's health", text: "Heavy, painful periods and low energy. Ordered BioAro panel incl. ferritin, AMH, TSH.", links: ["symptoms", "labs"] as StreamId[] },
    { date: new Date(drawn.getTime() + 9 * day), who: "BioAro Labs · results review", text: `Ferritin ${latest(ferr).value} ${ferr.unit} — low. Discuss iron; recheck in about 3 months.`, links: ["labs"] as StreamId[] },
  ];
}

/** How SI links one stream to others — shown as tappable connections. */
export const LINKS: Record<StreamId, { to: StreamId; why: string }[]> = {
  cycle: [
    { to: "temp", why: "dates ovulation" },
    { to: "symptoms", why: "pain peaks days 1–3" },
  ],
  temp: [
    { to: "cycle", why: "confirms the phase" },
    { to: "heart", why: "both lift after ovulation" },
  ],
  heart: [
    { to: "temp", why: "same luteal lift" },
    { to: "labs", why: "baseline rose as iron fell" },
  ],
  sleep: [{ to: "cycle", why: "dips before periods" }],
  labs: [
    { to: "symptoms", why: "heavy flow drains iron" },
    { to: "heart", why: "pulse creeps up" },
  ],
  genome: [{ to: "notes", why: "flagged before prescribing" }],
  micro: [{ to: "symptoms", why: "rules out an infection lead" }],
  symptoms: [
    { to: "cycle", why: "same days every cycle" },
    { to: "labs", why: "heavy flow → low iron" },
  ],
  meds: [{ to: "genome", why: "CYP2C19 applied" }],
  clock: [{ to: "labs", why: "AMH and FSH" }],
  signals: [{ to: "symptoms", why: "strongest pattern" }],
  future: [{ to: "labs", why: "iron lever" }],
  care: [{ to: "notes", why: "visit history" }],
  privacy: [{ to: "genome", why: "consent per use" }],
  notes: [
    { to: "labs", why: "ferritin flagged" },
    { to: "symptoms", why: "raised at visit" },
  ],
};
