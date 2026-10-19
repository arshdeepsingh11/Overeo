import type { Derived } from "../derived";
import type { NavAnswers, ToolResult } from "../store";
import { TESTS, testById, type TestDef } from "../../content/tests";
import { addDays, fmtDate } from "../rng";
import type { Today } from "./forecast";

/* ------------------------------------------------------------------ *
 * Test Navigator engine. Scientific, not sales:
 *  - a test is recommended only when its result would change a decision
 *  - first-line clinical tests come before premium panels
 *  - a recent result is reused instead of repeated
 *  - every recommendation carries its reasons, its timing on HER cycle,
 *    what it can't tell her, and an evidence grade
 *  - tests people often expect but that wouldn't help now are listed
 *    separately, with the reason
 * ------------------------------------------------------------------ */

export type Tier = "discuss" | "consider" | "later" | "done" | "not-now";

export const TIER_META: Record<Tier, { label: string; desc: string }> = {
  discuss: { label: "Discuss now", desc: "Likely to change what happens next. Bring it to your next visit." },
  consider: { label: "Worth considering", desc: "Would add useful information for a goal you chose." },
  later: { label: "Later, if things change", desc: "Not needed today — here's what would make it useful." },
  done: { label: "Already covered", desc: "You have a recent result. Reuse it instead of repeating." },
  "not-now": { label: "Not recommended now", desc: "Often asked about, but wouldn't help you yet." },
};

export interface Reason {
  text: string;
  from: "Your data" | "Your answers" | "Guideline" | "Tool result";
}

export interface TimingPlan {
  label: string;
  window?: [Date, Date];
  ok: boolean;
}

export interface Rec {
  test: TestDef;
  tier: Tier;
  score: number;
  reasons: Reason[];
  timing: TimingPlan;
  caveats: string[];
}

export interface NavResult {
  urgent: string | null;
  recs: Rec[];
  hormoneHint: string | null;
}

const daysAgo = (today: Date, d: Date) => Math.round((today.getTime() - d.getTime()) / 86_400_000);

/** When to take a test, on her own predicted cycle. */
export function timingFor(t: TestDef, today: Today, nowDate: Date, contraception: NavAnswers["contraception"]): TimingPlan {
  // combined methods and most progestin-only methods suppress the natural cycle; a hormonal IUD usually doesn't
  const noCycle = contraception === "combined" || contraception === "progestin";
  const sd = Math.max(1, Math.round(today.sdLength));
  switch (t.timing.kind) {
    case "any":
      return { label: "Any day — no cycle timing needed", ok: true };
    case "fasting":
      return { label: "Any morning, after an 8–12 h fast", ok: true };
    case "once":
      return { label: "Once in a lifetime — any day", ok: true };
    case "booked":
      return { label: "Booked after a clinical visit", ok: true };
    case "cycle-days": {
      if (noCycle && t.contraceptionAffects) return { label: "No natural cycle on hormonal contraception — ask your clinician how to time it", ok: false };
      const { from, to } = t.timing;
      if (today.cycleDay >= from && today.cycleDay <= to) {
        return { label: `Today is cycle day ${today.cycleDay} — inside the day ${from}–${to} window`, window: [nowDate, addDays(nowDate, to - today.cycleDay)], ok: true };
      }
      const a = addDays(today.nextStart, from - 1);
      const b = addDays(today.nextStart, to - 1);
      return { label: `Cycle days ${from}–${to}: about ${fmtDate(a)} – ${fmtDate(b)} (±${sd} d — confirm once your period starts)`, window: [a, b], ok: true };
    }
    case "pre-period": {
      if (noCycle) return { label: "Not meaningful on hormonal contraception", ok: false };
      let at = addDays(today.nextStart, -t.timing.days);
      if (at < nowDate) at = addDays(at, Math.round(today.meanLength));
      return { label: `About ${fmtDate(at)} — ${t.timing.days} days before your next expected period (±${sd} d)`, window: [addDays(at, -1), addDays(at, 1)], ok: true };
    }
  }
}

export function recommend(d: Derived, nav: NavAnswers, tools: Record<string, ToolResult>): NavResult {
  const p = d.profile;
  const now = p.today;
  const age = p.age;
  const goal = (g: string) => nav.goals.includes(g);
  const sym = (s: string) => nav.symptoms.includes(s);
  const fam = (f: string) => nav.family.includes(f);
  const sig = (id: string) => d.signals.find((s) => s.id === id);
  const lab = (k: string) => {
    const l = p.labs.find((x) => x.key === k);
    if (!l) return null;
    const pt = l.points[l.points.length - 1];
    return { ...pt, unit: l.unit, ago: daysAgo(now, pt.date), range: l.range, first: l.points[0] };
  };
  const hormonal = nav.contraception !== "none" && nav.contraception !== "copper-iud";
  const pregnant = nav.stage === "pregnant";

  type Acc = { score: number; reasons: Reason[]; tier?: Tier; caveats: string[] };
  const acc: Record<string, Acc> = {};
  const A = (id: string) => (acc[id] ??= { score: 0, reasons: [], caveats: [] });
  const add = (id: string, n: number, text: string, from: Reason["from"]) => {
    const a = A(id);
    a.score += n;
    a.reasons.push({ text, from });
  };
  const force = (id: string, tier: Tier, text: string, from: Reason["from"] = "Guideline") => {
    const a = A(id);
    a.tier = tier;
    a.reasons.unshift({ text, from });
  };

  const urgent = sig("cardiac") ? "Your entries include chest discomfort with breathlessness or jaw/arm pain. That isn't a testing question — if it's happening now, call 911. Don't drive yourself." : null;

  /* ---------------- iron & blood ---------------- */
  const ferr = lab("ferritin");
  const iron = sig("iron");
  if (sym("heavy-bleeding")) add("ferritin-cbc", 3, "You reported heavy periods — guidelines recommend a blood count for everyone with heavy bleeding.", "Your answers");
  if (iron && ferr) add("ferritin-cbc", 1 + iron.strength * 2, `Ferritin has fallen from ${ferr.first.value} to ${ferr.value} ${ferr.unit} — a repeat shows whether stores are recovering.`, "Your data");
  if (sym("fatigue")) add("ferritin-cbc", 1, "Fatigue is a common early sign of low iron stores, before anaemia.", "Your answers");
  if (sym("bloating") && iron) add("celiac", 2, "Low iron plus gut symptoms is a reason to rule out coeliac disease.", "Guideline");

  /* ---------------- fertility ---------------- */
  const amh = lab("amh");
  if (goal("fertility-timeline") || goal("trying") || nav.stage === "trying") {
    add("amh", 3, "You want to understand your fertility timeline; AMH is the most stable marker of ovarian reserve.", "Your answers");
    add("fsh-e2", 1.5, "Day-3 FSH and estradiol add context to AMH.", "Guideline");
  }
  if (amh && amh.ago < 365) {
    force("amh", "done", `You had AMH ${amh.value} ${amh.unit} ${amh.ago} days ago. Repeat in about a year on the same assay — sooner only if plans change.`, "Your data");
    const fsh = lab("fsh");
    if (fsh && fsh.ago < 365) force("fsh-e2", "done", `Day-3 FSH (${fsh.value} IU/L) was drawn ${fsh.ago} days ago on the right cycle day — no need to repeat yet.`, "Your data");
  }
  if (age >= 45 && (nav.stage === "peri" || sym("hot-flushes"))) force("fsh-e2", "not-now", "Over 45 with typical symptoms, perimenopause is diagnosed from symptoms — FSH isn't needed (NICE NG23).");
  else if (age >= 40 && sym("hot-flushes")) add("fsh-e2", 2.5, "Menopause-type symptoms between 40 and 45 are one of the few times FSH helps.", "Guideline");
  if (nav.stage === "trying") add("progesterone", 3, "Trying to conceive: a correctly timed progesterone confirms ovulation.", "Guideline");
  const rhythm = sig("rhythm");
  if (sym("irregular-cycles") || rhythm) {
    add("progesterone", 1.8, rhythm ? `Your cycles ranged ${rhythm.evidence[0].replace("Cycle lengths ", "")} — progesterone can confirm whether you ovulate.` : "Irregular cycles: progesterone shows whether ovulation is happening.", rhythm ? "Your data" : "Your answers");
    add("tsh", 1.4, "Thyroid conditions are a common, treatable cause of cycle changes.", "Guideline");
    add("prolactin", 1.6, "High prolactin is one cause of irregular cycles to rule out before PCOS.", "Guideline");
    add("androgens", 1.6, "Irregular cycles are one of the three PCOS criteria; androgens are the second.", "Guideline");
  }
  if (sym("acne-hair")) add("androgens", 2.4, "Acne or excess hair growth can reflect raised androgens.", "Your answers");
  const pcosTool = tools.pcos;
  if (pcosTool && (pcosTool.level === "moderate" || pcosTool.level === "high")) add("androgens", 2, `Your PCOS criteria check: ${pcosTool.summary}`, "Tool result");
  if (pcosTool && pcosTool.level === "high") add("hba1c-lipids", 2.5, "PCOS raises the risk of diabetes; the guideline recommends glucose checks at diagnosis and every 1–3 years.", "Guideline");

  /* ---------------- thyroid ---------------- */
  const tsh = lab("tsh");
  if (sym("fatigue")) add("tsh", 1, "Fatigue has many causes; thyroid is one of the simplest to check.", "Guideline");
  if (nav.stage === "trying" || nav.stage === "pregnant") add("tsh", 2, "Thyroid function matters for conception and early pregnancy.", "Guideline");
  if (fam("thyroid")) add("tsh", 1.2, "Thyroid disease runs in your family.", "Your answers");
  if (tsh && tsh.ago < 365 && tsh.value >= tsh.range[0] && tsh.value <= tsh.range[1]) force("tsh", "done", `TSH was normal ${tsh.ago} days ago (${tsh.value} ${tsh.unit}). Repeat only if symptoms change.`, "Your data");

  /* ---------------- pelvic imaging ---------------- */
  const endo = sig("endo");
  if (endo) add("pelvic-ultrasound", 1.5 + endo.strength * 2.5, `Pain, bowel symptoms and heavy flow cluster around your period in ${endo.evidence[0].match(/\d+ of \d+/)?.[0] ?? "most"} cycles — imaging is the next step guidelines suggest.`, "Your data");
  if (sym("pelvic-pain")) add("pelvic-ultrasound", 1.5, "You reported significant period or pelvic pain.", "Your answers");
  if (sym("bowel-pain")) add("pelvic-ultrasound", 1, "Cyclical bowel pain is a listed feature of endometriosis.", "Guideline");
  const pain = tools.pain;
  if (pain && pain.level !== "none" && pain.level !== "low") add("pelvic-ultrasound", 1.5, `Your pain map: ${pain.summary}`, "Tool result");

  /* ---------------- heart & metabolic ---------------- */
  const a1c = lab("hba1c");
  if (age >= 40) add("hba1c-lipids", 2.5, "Canadian guidelines recommend lipid screening from age 40.", "Guideline");
  if (goal("heart")) add("hba1c-lipids", 1.8, "Heart health is one of your goals — this is the foundation of a prevention plan.", "Your answers");
  if (fam("heart")) {
    add("hba1c-lipids", 2, "Early heart disease in your family is a reason to check cholesterol before 40.", "Guideline");
    add("lpa", 3, "Lp(a) is inherited; with family heart disease it's especially worth knowing.", "Guideline");
  }
  if (goal("heart") || goal("longevity")) add("lpa", 1.6, "The Canadian Cardiovascular Society recommends measuring Lp(a) once in every adult.", "Guideline");
  if (a1c) A("hba1c-lipids").caveats.push(`Your HbA1c was ${a1c.value}% ${a1c.ago} days ago (normal); the gap is the lipid panel.`);
  const heartTool = tools.heart;
  if (heartTool && heartTool.level !== "none" && heartTool.level !== "low") {
    add("hba1c-lipids", 2, `Your heart check: ${heartTool.summary}`, "Tool result");
    add("hs-crp", 1, "With women-specific risk enhancers, hs-CRP can refine a borderline risk decision.", "Guideline");
  }
  if (goal("heart")) add("hs-crp", 1, "hs-CRP is a recognised risk enhancer when risk is borderline.", "Guideline");
  if (sym("palpitations")) add("echo", 2, "Palpitations or breathlessness on exertion warrant a cardiology assessment first; imaging follows if needed.", "Your answers");
  if (goal("heart") || goal("longevity")) add("cystatin-c", 0.9, "Gives a more accurate kidney estimate, part of long-term cardiometabolic care.", "Guideline");

  /* ---------------- bone & nutrition ---------------- */
  const vitd = lab("vitd");
  if (age >= 65) add("dxa", 3.5, "Bone density screening is recommended for women 65 and older.", "Guideline");
  const bone = tools.bone;
  if (bone && (bone.level === "moderate" || bone.level === "high")) add("dxa", 3, `Your bone check: ${bone.summary}`, "Tool result");
  if (fam("early-menopause") || (nav.stage === "post" && age < 45)) add("dxa", 2, "Early menopause speeds bone loss.", "Guideline");
  if (!acc.dxa?.score) force("dxa", "not-now", `At ${age} without fracture risk factors, a bone scan isn't recommended yet. The Bone tool tells you if that changes.`);
  if (vitd && vitd.value < vitd.range[0]) add("vitamin-d", 1.6, `Your last vitamin D was ${vitd.value} ${vitd.unit} (below ${vitd.range[0]}) — following up a known low result is reasonable.`, "Your data");
  if (goal("bone")) add("vitamin-d", 0.8, "Relevant to bone goals, though routine testing isn't advised for healthy adults.", "Guideline");
  if (sym("bloating") || goal("gut")) add("essential-vitamins", 1, "Gut symptoms can affect absorption of fat-soluble vitamins.", "Guideline");

  /* ---------------- microbiome ---------------- */
  if (goal("gut")) add("biogut", 2.2, "You chose gut health; a BioGut dietitian can personalise a plan from the profile.", "Your answers");
  if (sym("bloating")) add("biogut", 1.2, "Bloating that tracks your cycle is something BioGut dietitians work with.", "Your answers");
  if (goal("skin")) add("bioskin", 2, "You chose skin; NEA uses the skin microbiome alongside hormones and gut health.", "Your answers");
  if (sym("acne-hair") && goal("skin")) add("bioskin", 0.8, "Breakouts before periods are best read with hormones in mind.", "Your answers");
  if (sym("vaginal")) {
    add("biofemme", 1, "For symptoms, a standard clinical swab comes first; microbiome profiling can help if infections keep coming back.", "Guideline");
  }
  if (p.microbiome.some((m) => m.label === "Vaginal")) force("biofemme", "done", `Your vaginal microbiome is already on file (${p.microbiome.find((m) => m.label === "Vaginal")!.value}) — a protective profile. No repeat needed without symptoms.`, "Your data");

  /* ---------------- longevity & genomics ---------------- */
  if (goal("longevity")) {
    add("core-inflammation", 1.4, "Tracks inflammatory tone over years — interesting for a longevity baseline.", "Your answers");
    A("core-inflammation").caveats.push("Start with the established levers (blood pressure, lipids, HbA1c, strength, fitness) before emerging panels.");
  }
  if (goal("medicines") || sym("side-effects")) add("pgx", 3, "Medicine response is one of your goals; drug–gene guidance exists for many common medicines.", "Your answers");
  if (p.genome.some((g) => g.label === "CYP2C19")) force("pgx", "done", "Your CYP2C19 result is already on file and checked before any protocol. A full panel adds genes like CYP2D6 only if you start medicines they affect.", "Your data");
  if (fam("breast-ovarian-cancer")) {
    add("wgs", 3.2, "Breast or ovarian cancer in your family is a reason to see a genetic counsellor; testing follows if criteria are met.", "Guideline");
    A("wgs").caveats.push("Genetic counselling comes first. Results can affect relatives, and stay off until you switch them on.");
  } else force("wgs", "not-now", "Without a family history that suggests an inherited condition, a whole genome rarely changes care. It's available with counselling if you want it.");
  force("brain-health", "not-now", fam("dementia") ? "Even with dementia in the family, blood biomarkers are only recommended for people with memory symptoms, assessed by a specialist. A clinician can talk through prevention." : "Brain biomarkers are only recommended for people with memory symptoms being assessed by a specialist — not for screening.");
  force("telomere", "not-now", "Exploratory: telomere length varies between labs and doesn't guide individual decisions yet.");
  force("gdf15", "not-now", pregnant ? "GDF-15 rises naturally in pregnancy, so it can't be interpreted now." : "Exploratory: a promising research marker without an established decision role.");
  force("cfdna", "not-now", "Prescription only, used in cancer care and monitoring — not a screening test for healthy people.");

  /* ---------------- general screening ---------------- */
  if (age >= 25 && age <= 69) add("cervical", 1.1, "Check you're up to date with your provincial HPV-based screening.", "Guideline");
  if (sym("snoring")) add("sleep-study", 2.6, "Loud snoring or breathing pauses are a reason to test for sleep apnoea.", "Your answers");

  /* ---------------- one-draw hormone panel ---------------- */
  const hormoneQs = ["androgens", "progesterone", "fsh-e2", "prolactin"].filter((id) => (acc[id]?.score ?? 0) >= 1.8 && acc[id]?.tier !== "done");
  let hormoneHint: string | null = null;
  if (hormoneQs.length >= 2) {
    add("hormone-health", 2, `${hormoneQs.length} hormone questions are open (${hormoneQs.map((id) => testById(id)!.name.split(" (")[0].split(":")[0]).join(", ")}). One BioAro panel may cover several in one draw — if its timing suits each marker.`, "Guideline");
    hormoneHint = "Progesterone must be drawn in the luteal phase, so it can't share an early-cycle draw with FSH or androgens.";
    A("hormone-health").caveats.push(hormoneHint);
  }
  if (hormonal) {
    for (const id of Object.keys(acc)) {
      if (testById(id)?.contraceptionAffects)
        acc[id].caveats.push(
          nav.contraception === "hormonal-iud"
            ? "A hormonal IUD can modestly change some hormone results — mention it when the test is ordered."
            : "Hormonal contraception changes this result. Guidelines suggest testing after about 3 months off, if that's safe for you — ask first.",
        );
    }
  }

  /* ---------------- assemble ---------------- */
  const recs: Rec[] = [];
  for (const t of TESTS) {
    const a = acc[t.id];
    if (!a) continue;
    let tier: Tier | undefined = a.tier;
    if (!tier) tier = a.score >= 3 ? "discuss" : a.score >= 1.8 ? "consider" : a.score >= 0.8 ? "later" : undefined;
    if (!tier) continue;
    // premium or emerging panels never top the list on their own
    if (tier === "discuss" && (t.evidence === "emerging" || t.evidence === "exploratory")) tier = "consider";
    // her own evidence first: tool results, then her data, then her answers, then guidelines
    const rank: Reason["from"][] = ["Tool result", "Your data", "Your answers", "Guideline"];
    const reasons = a.tier ? a.reasons : [...a.reasons].sort((x, y) => rank.indexOf(x.from) - rank.indexOf(y.from));
    recs.push({ test: t, tier, score: a.score, reasons, timing: timingFor(t, d.today, now, nav.contraception), caveats: a.caveats });
  }
  const order: Tier[] = ["discuss", "consider", "later", "done", "not-now"];
  const firstLine = (r: Rec) => (r.test.provider === "NEYU clinical" ? 0 : 1);
  recs.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || b.score - a.score || firstLine(a) - firstLine(b));
  return { urgent, recs, hormoneHint };
}

/* ------------------------- options for the UI ------------------------- */

export const GOALS = [
  { id: "fertility-timeline", label: "Understand my fertility timeline" },
  { id: "trying", label: "Trying to conceive" },
  { id: "painful-periods", label: "Painful or heavy periods" },
  { id: "energy", label: "More energy" },
  { id: "skin", label: "Skin & hair" },
  { id: "gut", label: "Gut health" },
  { id: "heart", label: "Heart health" },
  { id: "bone", label: "Bone strength" },
  { id: "menopause", label: "Perimenopause & menopause" },
  { id: "mind", label: "Sleep & mood" },
  { id: "medicines", label: "How I respond to medicines" },
  { id: "longevity", label: "Longevity" },
];

export const SYMPTOMS = [
  { id: "heavy-bleeding", label: "Heavy periods" },
  { id: "pelvic-pain", label: "Severe period pain" },
  { id: "bowel-pain", label: "Bowel pain with periods" },
  { id: "irregular-cycles", label: "Irregular cycles" },
  { id: "acne-hair", label: "Acne or excess hair" },
  { id: "fatigue", label: "Fatigue" },
  { id: "luteal-sleep", label: "Poor sleep before periods" },
  { id: "hot-flushes", label: "Hot flushes / night sweats" },
  { id: "low-mood", label: "Low mood or anxiety" },
  { id: "bloating", label: "Bloating or bowel changes" },
  { id: "vaginal", label: "Vaginal symptoms" },
  { id: "palpitations", label: "Palpitations or breathlessness" },
  { id: "snoring", label: "Loud snoring" },
  { id: "side-effects", label: "Medicine side effects" },
];

export const FAMILY = [
  { id: "early-menopause", label: "Early menopause (<45)" },
  { id: "heart", label: "Early heart disease" },
  { id: "breast-ovarian-cancer", label: "Breast or ovarian cancer" },
  { id: "osteoporosis", label: "Osteoporosis or hip fracture" },
  { id: "diabetes", label: "Type 2 diabetes" },
  { id: "thyroid", label: "Thyroid disease" },
  { id: "dementia", label: "Dementia" },
];

export const STAGES: { id: NavAnswers["stage"]; label: string }[] = [
  { id: "cycling", label: "Regular life, not trying" },
  { id: "trying", label: "Trying to conceive" },
  { id: "pregnant", label: "Pregnant" },
  { id: "postpartum", label: "Postpartum (<1 year)" },
  { id: "peri", label: "Perimenopause" },
  { id: "post", label: "Post-menopause" },
];

export const CONTRACEPTION: { id: NavAnswers["contraception"]; label: string }[] = [
  { id: "none", label: "None" },
  { id: "combined", label: "Combined pill / patch / ring" },
  { id: "progestin", label: "Progestin-only pill / implant / shot" },
  { id: "hormonal-iud", label: "Hormonal IUD" },
  { id: "copper-iud", label: "Copper IUD" },
];
