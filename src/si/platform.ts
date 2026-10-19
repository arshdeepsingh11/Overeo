import { store } from "../core/store";
import { derive } from "../core/derived";
import { recommend, TIER_META } from "../core/engines/recommend";
import { TESTS, EVIDENCE, testById } from "../content/tests";
import { SPECIALTIES } from "../content/specialties";
import type { SIAnswer, SIContext } from "./types";

/* =====================================================================
   Overeo SI — platform knowledge: the Test Navigator, the test catalog,
   the ten specialties and the guided tools. Answers stay grounded in
   the same engines and content the pages render.
   ===================================================================== */

type Handler = (q: string, ctx: SIContext, m: RegExpMatchArray) => SIAnswer | null;
interface Intent {
  id: string;
  re: RegExp;
  run: Handler;
}

const TEST_KEYS: [RegExp, string][] = [
  [/hormone health|hormone panel/, "hormone-health"],
  [/ultra hormone/, "ultra-hormone"],
  [/biogut|gut microbiome|stool test/, "biogut"],
  [/bioskin|skin microbiome/, "bioskin"],
  [/biofemme|vaginal microbiome/, "biofemme"],
  [/telomere/, "telomere"],
  [/brain health|p-?tau|amyloid|alzheimer/, "brain-health"],
  [/pharmacogen|\bpgx\b/, "pgx"],
  [/whole genome|\bwgs\b|genome sequencing|dna test|brca/, "wgs"],
  [/cell.?free|cfdna|cancer blood test/, "cfdna"],
  [/gdf/, "gdf15"],
  [/inflammation (aging|ageing|panel)/, "core-inflammation"],
  [/\bcrp\b/, "hs-crp"],
  [/vitamin d\b/, "vitamin-d"],
  [/vitamin panel|essential vitamin/, "essential-vitamins"],
  [/ferritin|iron (test|level)/, "ferritin-cbc"],
  [/\btsh\b|thyroid test/, "tsh"],
  [/lp\(a\)|lipoprotein/, "lpa"],
  [/\bdxa\b|bone density|bone scan/, "dxa"],
  [/testosterone|androgen|dhea/, "androgens"],
  [/progesterone/, "progesterone"],
  [/\bamh\b/, "amh"],
  [/\bfsh\b/, "fsh-e2"],
  [/prolactin/, "prolactin"],
  [/cholesterol|lipid|hba1c/, "hba1c-lipids"],
  [/coeliac|celiac/, "celiac"],
  [/ultrasound/, "pelvic-ultrasound"],
  [/cystatin/, "cystatin-c"],
  [/pap|cervical|hpv/, "cervical"],
  [/sleep study|apn(o)?ea/, "sleep-study"],
  [/cortisol|adrenal fatigue/, "cortisol"],
];

function nav() {
  const s = store.get();
  const d = derive(s.profile, s.levers);
  return { s, d, r: recommend(d, s.nav, s.toolResults) };
}

export const PLATFORM_INTENTS: Intent[] = [
  {
    id: "tests-rec",
    re: /\b(which|what) (tests?|labs?|blood ?work)\b|\btests? (should|do|would) (i|she)\b|\brecommend(ed)? (a )?tests?\b/,
    run: (_q, ctx) => {
      if (!ctx.useProfile)
        return {
          title: "Testing, the scientific way",
          summary: "I only suggest a test when its result would change a decision — first-line clinical tests before premium panels, timed to the cycle, with what it can't tell you. Turn her profile context on and I'll show hers.",
          used: ["General knowledge"],
          actions: [{ label: "Open the Test Navigator", icon: "flask", cmds: [{ type: "goto", section: "tests" }] }],
        };
      const { r } = nav();
      const now = r.recs.filter((x) => x.tier === "discuss");
      const cons = r.recs.filter((x) => x.tier === "consider");
      const done = r.recs.filter((x) => x.tier === "done");
      const skip = r.recs.filter((x) => x.tier === "not-now");
      return {
        title: now.length ? `${now.length} test${now.length > 1 ? "s" : ""} worth discussing now` : "Nothing urgent to test",
        summary: r.urgent ?? `Based on her entries, labs and answers. ${done.length} are already covered by recent results, and ${skip.length} popular tests wouldn't help her yet — I've said why for each.`,
        points: [
          ...now.map((x) => `${x.test.name} — ${x.reasons[0]?.text ?? ""} Timing: ${x.timing.label}.`),
          ...cons.slice(0, 2).map((x) => `Worth considering: ${x.test.name} — ${x.reasons[0]?.text ?? ""}`),
          ...done.slice(0, 2).map((x) => `Already covered: ${x.test.name} — ${x.reasons[0]?.text ?? ""}`),
        ],
        used: ["Daily logs", "Lab history", "Silent Signals", "Navigator answers", "Tool results"],
        limits: "Recommendations prepare a conversation with a NEYU clinician — they don't replace one. Prices are BioAro's published prices where available.",
        actions: [
          { label: "Open the Test Navigator", icon: "flask", cmds: [{ type: "goto", section: "tests" }] },
          { label: "See her timing calendar", icon: "calendar", cmds: [{ type: "goto", section: "tests:timing" }] },
        ],
        tone: r.urgent ? "alert" : "good",
        sources: [
          { label: "NICE NG88 — Heavy menstrual bleeding", url: "https://www.nice.org.uk/guidance/ng88" },
          { label: "International PCOS Guideline (2023)", url: "https://www.monash.edu/medicine/mchri/pcos/guideline" },
        ],
      };
    },
  },
  {
    id: "test-eval",
    re: /\b(worth|should (i|she) (get|take|do|buy|order)|do (i|she) need|is (a|an|the)?\s?.*\b(useful|accurate|reliable)|what does (a|an|the)? ?.*\b(test|panel|scan) (show|tell|measure))\b/,
    run: (q, ctx) => {
      const hit = TEST_KEYS.find(([re]) => re.test(q));
      if (!hit) return null;
      if (hit[1] === "cortisol")
        return {
          title: "Cortisol tests and 'adrenal fatigue'",
          summary: "A single cortisol value swings through the day and doesn't measure stress or burnout. 'Adrenal fatigue' isn't a recognised diagnosis. Cortisol is tested to look for specific conditions — Cushing's syndrome or adrenal insufficiency — when a clinician suspects them.",
          points: ["For fatigue, iron, thyroid and sleep are higher-yield places to start", "BioAro offers cortisol testing for clinician-directed use"],
          used: ["Endocrine Society guidance"],
          actions: [{ label: "See tests for fatigue", icon: "flask", cmds: [{ type: "goto", section: "tests" }] }],
          sources: [{ label: "Endocrine Society — Adrenal fatigue", url: "https://www.endocrine.org/patient-engagement/endocrine-library/adrenal-fatigue" }],
        };
      const t = testById(hit[1]);
      if (!t) return null;
      const rec = ctx.useProfile ? nav().r.recs.find((x) => x.test.id === t.id) : undefined;
      const ev = EVIDENCE[t.evidence];
      return {
        title: `${t.name}${rec ? ` — ${TIER_META[rec.tier].label.toLowerCase()}` : ""}`,
        summary: rec ? `${rec.reasons[0]?.text ?? TIER_META[rec.tier].desc}` : `${t.what} ${t.tells}`,
        points: [`What it tells you: ${t.tells}`, `What it can't: ${t.cannot}`, `Timing: ${rec?.timing.label ?? t.timingNote}`, `Evidence: ${ev.label} — ${t.evidenceNote}`, ...(rec?.caveats ?? [])],
        used: rec ? ["Test catalog", "Her data and answers"] : ["Test catalog"],
        limits: t.rx ? "Needs a clinician's order or review." : "Results are reviewed with a clinician before acting on them.",
        actions: [
          { label: "Open the Test Navigator", icon: "flask", cmds: [{ type: "goto", section: "tests" }] },
          { label: "Browse the catalog", icon: "layers", cmds: [{ type: "goto", section: "tests:catalog" }] },
        ],
        tone: rec?.tier === "not-now" ? "signal" : "info",
        sources: t.url ? [{ label: `BioAro Labs — ${t.name}`, url: t.url }] : undefined,
      };
    },
  },
  {
    id: "tools",
    re: /\b(tools?|questionnaire|check.?in|menopause (rating )?scale|\bmrs\b|pain map|pcos (check|criteria)|risk check)\b/,
    run: (q) => {
      const tab = /pain/.test(q) ? "pain" : /pcos/.test(q) ? "pcos" : /meno|mrs/.test(q) ? "mrs" : /heart/.test(q) ? "heart" : /bone/.test(q) ? "bone" : "checkin";
      const done = Object.values(store.get().toolResults);
      return {
        title: "Guided tools",
        summary: "Each tool takes a minute or two and feeds the same profile — finish one and the Test Navigator, signals and your dossier update.",
        points: [
          "Check-in — pain, flow, energy, sleep and mood for today",
          "Pain map — where and when it hurts, mapped to guideline features",
          "PCOS criteria — the 2023 international criteria, pre-filled from your cycles",
          "Menopause Rating Scale — a validated 11-item score you can repeat",
          "Heart — women-specific risk enhancers and red flags",
          "Bone — the risk factors fracture tools use",
          ...(done.length ? [`Done so far: ${done.map((t) => t.title).join(", ")}`] : []),
        ],
        used: ["Tools"],
        actions: [{ label: "Open the tool", icon: "target", cmds: [{ type: "goto", section: `tools:${tab}` }] }],
      };
    },
  },
  {
    id: "specialty",
    re: /\b(specialt(y|ies)|which (doctor|clinic|team)|who should (i|she) see|(open|show|go to) (the )?(\w+) (page|specialty))\b/,
    run: (q) => {
      const sp = SPECIALTIES.find((s) => q.includes(s.short.toLowerCase()) || q.includes(s.slug.replace("-", " ")));
      if (sp)
        return {
          title: sp.name,
          summary: sp.about,
          points: sp.whenToSee.slice(0, 4).map((w) => `See someone if: ${w}`),
          used: ["Specialty guide"],
          actions: [{ label: `Open ${sp.short}`, icon: sp.icon, cmds: [{ type: "goto", section: `spec:${sp.slug}` }] }],
          sources: sp.sources,
        };
      const { d } = nav();
      const order = d.signals.map((s) => s.id);
      const ranked = [...SPECIALTIES].sort((a, b) => score(b) - score(a));
      function score(s: (typeof SPECIALTIES)[number]) {
        return s.signals.reduce((n, id) => n + (order.includes(id) ? 3 - order.indexOf(id) * 0.5 : 0), 0);
      }
      return {
        title: "Who she should see first",
        summary: `Ranked by her current signals. Top: ${ranked[0].name}, then ${ranked[1].name}.`,
        points: ranked.slice(0, 4).map((s) => `${s.name} — ${s.tagline}`),
        used: ["Silent Signals", "Specialty guide"],
        actions: ranked.slice(0, 2).map((s) => ({ label: `Open ${s.short}`, icon: s.icon, cmds: [{ type: "goto" as const, section: `spec:${s.slug}` }] })),
      };
    },
  },
];

/* --------------- knowledge search over the specialty guides --------------- */

const STOP = new Set("a an the is are do does i she her my me what when why how can could should to of in on for and or it be with about if this that".split(" "));
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

function overlap(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  return a.filter((w) => B.has(w)).length / Math.max(a.length, b.length * 0.7);
}

export function knowledgeAnswer(q: string): SIAnswer | null {
  const qw = words(q);
  let best: { score: number; ans: SIAnswer } | null = null;
  for (const sp of SPECIALTIES) {
    for (const c of sp.conditions) {
      const nameHit = q.includes(c.name.toLowerCase().split(" (")[0]) ? 1 : 0;
      const sc = Math.max(nameHit, overlap(qw, words(c.ask)), overlap(qw, words(c.name)) * 0.9);
      if (sc > (best?.score ?? 0.55))
        best = {
          score: sc,
          ans: {
            title: c.name,
            summary: c.summary,
            points: [`Signs: ${c.signs.join(" · ")}`, `How it's diagnosed: ${c.diagnosis.join("; ")}`, `Care: ${c.care.join(" · ")}`, `What OVEREO adds: ${c.overeo}`],
            used: [`${sp.name} guide`],
            limits: "Educational — a clinician makes the diagnosis.",
            actions: [{ label: `Open ${sp.short}`, icon: sp.icon, cmds: [{ type: "goto", section: `spec:${sp.slug}` }] }],
            sources: sp.sources,
          },
        };
    }
    for (const f of sp.faqs) {
      const sc = overlap(qw, words(f.q));
      if (sc > (best?.score ?? 0.55))
        best = {
          score: sc,
          ans: {
            title: f.q,
            summary: f.a,
            used: [`${sp.name} guide`],
            actions: [{ label: `Open ${sp.short}`, icon: sp.icon, cmds: [{ type: "goto", section: `spec:${sp.slug}` }] }],
            sources: sp.sources,
          },
        };
    }
  }
  return best?.ans ?? null;
}

/** "What is adenomyosis?" — a named condition from the guides, unless a richer data-driven topic owns it. */
const OWNED_BY_TOPICS = new Set(["endometriosis", "pcos", "perimenopause", "hmb", "iron-def", "egg-freezing", "dor"]);
export const CONDITION_INTENT: Intent = {
  id: "condition",
  re: /\b(what is|what's|what are|tell me about|explain|what causes)\b/,
  run: (q) => {
    for (const sp of SPECIALTIES)
      for (const c of sp.conditions) {
        if (OWNED_BY_TOPICS.has(c.id)) continue;
        const key = c.name.toLowerCase().split(" (")[0].split(" & ")[0];
        if (q.includes(key)) return knowledgeAnswer(c.name.toLowerCase());
      }
    return null;
  },
};

export const KNOWLEDGE_INTENT: Intent = { id: "knowledge", re: /.+/, run: (q) => knowledgeAnswer(q) };

/** Suggestions for platform pages and specialty pages. */
export function platformSuggestions(section: string): string[] | null {
  if (section.startsWith("spec:")) {
    const sp = SPECIALTIES.find((s) => `spec:${s.slug}` === section);
    return sp ? sp.symptoms.slice(0, 3).map((s) => s.ask) : null;
  }
  const map: Record<string, string[]> = {
    today: ["What should she focus on today?", "When is her next period?", "Why does sleep drop before her period?"],
    specialties: ["Who should she see first?", "Is this endometriosis?", "Could she have PCOS?"],
    tests: ["Which tests should she take?", "Is a telomere test worth it?", "Should she get a vitamin D test?"],
    tools: ["What tools are there?", "Open the pain map", "Menopause rating scale"],
  };
  return map[section] ?? null;
}

export const TEST_COUNT = TESTS.length;
