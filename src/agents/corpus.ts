import { SPECIALTIES } from "../content/specialties";
import { TESTS, EVIDENCE, type Category } from "../content/tests";
import { LAB_TESTS, labUrl } from "../content/bioaroLabs";
import { STREAMS } from "../core/streams";
import { LAB_INFO, SYMPTOM_INFO, PHASE_PLAIN } from "../personal/mind/knowledge";
import { TEAM } from "./team";

/* =====================================================================
   The team's knowledge base — OVEREO's own content, nothing else.

   Every answer is built from these passages (plus the facts about her
   that OVEREO Mind shares). If something isn't in a passage, the agents
   say they don't know it yet. Passages are short: one fact or one item.
   Prices are deliberately left out — agents never quote them.
   ===================================================================== */

export interface Passage {
  id: string;
  /** shown to her as the source chip */
  source: string;
  /** a page in OVEREO, or the BioAro test page */
  href?: string;
  tags: string[];
  text: string;
}

const SPECIALTY_TAGS: Record<string, string[]> = {
  fertility: ["fertility"],
  "menstrual-health": ["menstrual", "cycle", "pcos", "endometriosis", "symptoms"],
  hormones: ["hormones", "labs", "pcos"],
  menopause: ["menopause"],
  heart: ["heart", "care"],
  bone: ["bone", "menopause"],
  skin: ["skin", "care"],
  gut: ["gut", "care"],
  "mind-sleep": ["mind-sleep", "mood", "sleep"],
  longevity: ["labs", "care"],
};

const CATEGORY_TAGS: Record<Category, string[]> = {
  Fertility: ["fertility", "labs", "tests"],
  Hormones: ["hormones", "labs", "tests"],
  "Blood & iron": ["labs", "tests"],
  "Metabolic & heart": ["heart", "labs", "tests"],
  Nutrition: ["labs", "tests"],
  Microbiome: ["gut", "labs", "tests"],
  "Inflammation & ageing": ["labs", "tests"],
  Genomics: ["genome", "meds", "tests"],
  "Imaging & screening": ["care", "tests"],
};

/** How OVEREO itself works — written for her, kept factual. */
const ABOUT: Omit<Passage, "id">[] = [
  { source: "About OVEREO", href: "/app", tags: ["app", "care"], text: "OVEREO is a women's precision-health app from the BioAro ecosystem (with NEYU, BioAro Labs, Advanced Cardiology and NEA). It learns from what she logs — periods, symptoms, mood, sleep, temperature, blood pressure, medicines and lab results — and explains her patterns. It is educational and does not diagnose." },
  { source: "Your privacy", href: "/app/me", tags: ["app", "privacy"], text: "Her space lives on her device. Sample data (Maya) and her real data are kept completely separate. She can export everything as a file, delete her space, lock the app with a PIN, and turn on discreet mode to hide health details on screen." },
  { source: "Your privacy", href: "/app/me", tags: ["app", "privacy"], text: "When the live brain is used, OVEREO shares only short facts about her patterns — never her name, email or raw entries — and she can switch personal context off for any question." },
  { source: "How the agents work", href: "/app/agents", tags: ["app", "reminders"], text: "Her agents only suggest. Each suggestion lands in the Inbox; she can say yes, change it, or tap 'Not for me'. Approved actions are recorded in her Diary. Two 'not relevant' answers stop that kind of suggestion. In each agent's settings she chooses what it may do, what it must never do, how often it can suggest something, and quiet hours." },
  { source: "Reminders and notifications", href: "/app/me", tags: ["reminders", "app"], text: "Reminders appear at the times she usually checks in and respect quiet hours. With notifications on, OVEREO can reach her while it's open; on supported devices it can also reach her when it's closed (on iPhone, after adding OVEREO to the Home Screen). Discreet mode uses neutral wording." },
  { source: "Visit summary", href: "/app/visit", tags: ["visit", "care"], text: "The Visit summary puts her cycle, symptoms, mood and sleep, blood pressure, labs, medicines and the questions worth asking on one page she can print or save as a PDF for her clinician." },
  { source: "Reading a lab report", href: "/app/track", tags: ["labs"], text: "She can add a lab report as a PDF or photo. OVEREO reads it on her device, finds each result, its range and the collection date, converts units, and asks her to check every value before anything is saved." },
  { source: "What-ifs", href: "/app", tags: ["mood", "sleep"], text: "What-ifs use her own data, for example how her mood moves with her sleep. They show a likely range and how sure OVEREO is, and they show patterns — not proof of cause." },
  { source: "Emergency signs", tags: ["safety", "care", "mood", "menstrual", "fertility", "heart"], text: "Call local emergency services now for chest pain or pressure, trouble breathing, stroke signs (face drooping, arm weakness, speech trouble), fainting, very heavy bleeding (a pad or tampon every hour for several hours), severe sudden pain — especially in pregnancy — or thoughts of self-harm. In Canada and the US, 988 reaches a suicide crisis line." },
  { source: "Ordering a test", href: "/tests", tags: ["labs", "tests", "bioaro"], text: "BioAro Labs tests can be opened from OVEREO; ordering and payment happen on BioAro's own site and checkout. OVEREO recommends tests only when her data or goals make them useful, and her clinician can order them too." },
];

let cache: Passage[] | null = null;

export function corpus(): Passage[] {
  if (cache) return cache;
  const out: Passage[] = [];
  let n = 0;
  const add = (p: Omit<Passage, "id">) => out.push({ ...p, id: `p${++n}` });

  for (const a of ABOUT) add(a);

  // the team itself, so agents can hand off correctly
  for (const a of TEAM.filter((x) => !x.networkOnly)) add({ source: "Your OVEREO team", href: "/app/agents", tags: ["app", ...a.tags.slice(0, 2)], text: `${a.name}, the ${a.title.toLowerCase()}: ${a.role} Covers ${a.does.join(", ")}. Does not cover ${a.doesNot.join(", ")}.` });

  for (const s of SPECIALTIES) {
    const tags = SPECIALTY_TAGS[s.slug] ?? ["care"];
    const href = `/specialties/${s.slug}`;
    const src = `Guide: ${s.name}`;
    add({ source: src, href, tags, text: s.about });
    add({ source: src, href, tags: [...tags, "care", "visit"], text: `When to see a clinician about ${s.short.toLowerCase()}: ${s.whenToSee.join("; ")}.` });
    if (s.urgent) add({ source: src, href, tags: [...tags, "safety"], text: `Urgent (${s.short}): ${s.urgent}` });
    for (const c of s.conditions) {
      add({ source: src, href, tags: [...tags, c.id], text: `${c.name}: ${c.summary} Common signs: ${c.signs.join("; ")}.` });
      add({ source: src, href, tags: [...tags, c.id, "care", "visit"], text: `${c.name} — how it's usually checked: ${c.diagnosis.join("; ")}. Usual care: ${c.care.join("; ")}.` });
    }
    for (const f of s.faqs) add({ source: src, href, tags, text: `${f.q} ${f.a}` });
    if (s.sources.length) add({ source: src, href, tags, text: `Sources behind the ${s.short.toLowerCase()} guide: ${s.sources.map((x) => x.label).join("; ")}.` });
  }

  for (const t of TESTS) {
    add({
      source: `Test navigator: ${t.name}`,
      href: "/tests",
      tags: CATEGORY_TAGS[t.category],
      text: `${t.name} (${t.category}, via ${t.provider}). What it is: ${t.what} What it tells: ${t.tells} What it cannot tell: ${t.cannot} When to test: ${t.timingNote} Sample: ${t.sample}. Evidence: ${EVIDENCE[t.evidence].label} — ${t.evidenceNote}${t.contraceptionAffects ? " Hormonal contraception can change the result." : ""}`,
    });
  }

  for (const l of LAB_TESTS)
    add({ source: `BioAro Labs: ${l.name}`, href: labUrl(l), tags: ["bioaro", "labs", "tests", l.area.toLowerCase()], text: `${l.name}${l.sub ? ` (${l.sub})` : ""} — ${l.tagline} ${l.learn} Sample: ${l.sample}. Results in ${l.results}. ${l.markers}.${l.prep ? ` Preparation: ${l.prep}` : ""}` });

  for (const s of Object.values(STREAMS))
    add({ source: `How OVEREO reads ${s.label.toLowerCase()}`, href: s.href.startsWith("/") ? s.href : undefined, tags: [s.id, "app"], text: `${s.label}: ${s.what} ${s.why}${s.source?.label ? ` (Source: ${s.source.label}.)` : ""}` });

  for (const [name, i] of Object.entries(LAB_INFO))
    add({ source: `Lab guide: ${name}`, href: "/app/track?t=lab_result", tags: ["labs", name.toLowerCase(), ...(name === "AMH" || name.startsWith("FSH") ? ["fertility"] : []), ...(/Estradiol|Progesterone|testosterone|FSH|TSH/i.test(name) ? ["hormones"] : [])], text: `${name}: ${i.what} ${i.context}${i.timing ? ` ${i.timing}` : ""}${i.retest ? ` ${i.retest}` : ""} (Source: ${i.source}.)` });

  for (const [name, i] of Object.entries(SYMPTOM_INFO))
    add({ source: `Symptom guide: ${name}`, href: "/app/track?t=symptom", tags: ["symptoms", "cycle", ...(/flash|sweat/i.test(name) ? ["menopause"] : []), ...(/fatigue/i.test(name) ? ["mood", "sleep"] : [])], text: `${name}: ${i.about} What can help: ${i.helps.join("; ")}. ${i.see}` });

  for (const [phase, t] of Object.entries(PHASE_PLAIN)) add({ source: "Cycle phases", tags: ["cycle"], text: `The ${phase} phase is ${t}.` });

  cache = out;
  return out;
}
