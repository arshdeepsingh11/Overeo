import { corpus, type Passage } from "./corpus";

/* =====================================================================
   Retrieval — BM25 over OVEREO's passages, with everyday words mapped
   to the words the content uses ("tired" → fatigue, ferritin, iron…).
   Small and fast enough to run on her phone or on the server.
   ===================================================================== */

const STOP = new Set("a an the and or but if of to in on at for with by from is are was were be been being am i me my mine you your it its this that these those do does did can could should would will what which who whom how why when where there here about as into than then so not no yes just very really also any some more most much many get got have has had".split(" "));

/** everyday word → words the content uses */
const EXPAND: Record<string, string[]> = {
  tired: ["fatigue", "energy", "ferritin", "iron", "sleep", "thyroid", "tsh"],
  exhausted: ["fatigue", "energy", "ferritin", "sleep"],
  energy: ["fatigue", "ferritin", "iron", "thyroid"],
  period: ["menstrual", "cycle", "bleeding", "menstruation"],
  periods: ["menstrual", "cycle", "bleeding"],
  late: ["cycle", "pregnancy", "irregular"],
  cramps: ["pain", "pelvic", "dysmenorrhea", "endometriosis", "prostaglandins"],
  cramp: ["pain", "pelvic", "endometriosis"],
  pain: ["pelvic", "endometriosis", "cramps"],
  heavy: ["bleeding", "flow", "ferritin", "iron"],
  baby: ["fertility", "conceive", "pregnancy"],
  pregnant: ["pregnancy", "conceive", "fertility"],
  conceive: ["fertility", "ovulation", "fertile"],
  eggs: ["egg", "ovarian", "reserve", "amh", "freezing"],
  freeze: ["egg", "freezing", "cryopreservation", "amh"],
  iron: ["ferritin", "hemoglobin", "anaemia", "anemia"],
  thyroid: ["tsh"],
  sugar: ["hba1c", "glucose", "diabetes"],
  heart: ["cardiac", "blood", "pressure", "cholesterol", "ldl", "crp"],
  bp: ["blood", "pressure"],
  mood: ["mood", "pms", "pmdd", "anxiety", "depression"],
  sad: ["mood", "depression", "pmdd"],
  anxious: ["anxiety", "mood"],
  sleep: ["sleep", "insomnia"],
  hot: ["flash", "menopause", "vasomotor"],
  flashes: ["flash", "menopause", "vasomotor"],
  sweats: ["night", "sweats", "menopause"],
  acne: ["skin", "androgens", "pcos"],
  hair: ["androgens", "pcos", "hirsutism"],
  bloating: ["gut", "bloating", "digestion"],
  gut: ["microbiome", "digestion", "bloating"],
  bones: ["bone", "osteoporosis", "dxa", "density"],
  doctor: ["clinician", "visit", "specialist"],
  test: ["test", "lab", "blood"],
  tests: ["test", "lab", "blood"],
  genes: ["genomics", "pharmacogenomics", "genome"],
  medicine: ["medication", "pharmacogenomics", "pharmacist"],
  pills: ["medication", "contraception"],
  privacy: ["privacy", "device", "export", "delete"],
  data: ["privacy", "device", "export"],
  reminder: ["reminders", "notifications", "quiet"],
  reminders: ["notifications", "quiet"],
};

export const tokens = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

export function expand(q: string) {
  const base = tokens(q);
  const extra = base.flatMap((w) => EXPAND[w] ?? EXPAND[`${w}s`] ?? []).flatMap(tokens);
  return { base, all: [...new Set([...base, ...extra])], extra: new Set(extra.filter((x) => !base.includes(x))) };
}

interface Index {
  docs: { p: Passage; tf: Map<string, number>; len: number }[];
  df: Map<string, number>;
  avg: number;
}

const indexes = new WeakMap<Passage[], Index>();

function build(ps: Passage[]): Index {
  const docs = ps.map((p) => {
    const ts = tokens(`${p.text} ${p.source} ${p.tags.join(" ")}`);
    const tf = new Map<string, number>();
    ts.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    return { p, tf, len: ts.length };
  });
  const df = new Map<string, number>();
  docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  return { docs, df, avg: docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length) };
}

export interface Scored {
  p: Passage;
  score: number;
}

/**
 * Top passages for a question. `boostTags` favours an agent's own area;
 * `extra` are passages added for this question only (her facts).
 */
export function retrieve(q: string, k = 6, opts: { boostTags?: string[]; extra?: Passage[]; min?: number } = {}): Scored[] {
  const base = corpus();
  let idx = indexes.get(base);
  if (!idx) {
    idx = build(base);
    indexes.set(base, idx);
  }
  const { all, extra } = expand(q);
  const teamQ = /\b(agent|agents|team|who (can|should|covers)|which (agent|teammate))\b/i.test(q);
  if (!all.length) return [];
  const docs = opts.extra?.length ? [...idx.docs, ...build(opts.extra).docs] : idx.docs;
  const N = docs.length;
  const K1 = 1.4;
  const B = 0.72;
  const out: Scored[] = [];
  for (const d of docs) {
    let s = 0;
    for (const t of all) {
      const f = d.tf.get(t);
      if (!f) continue;
      const df = idx.df.get(t) ?? 1;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      // expansion words count, but less than her own words
      s += (extra.has(t) ? 0.45 : 1) * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / idx.avg)));
    }
    if (!s) continue;
    if (opts.boostTags?.some((t) => d.p.tags.includes(t))) s *= 1.35;
    if (d.p.id.startsWith("you")) s *= 1.25; // her own facts first, when relevant
    if (d.p.source === "Your OVEREO team" && !teamQ) s *= 0.4; // the roster matters only when she asks about the team
    out.push({ p: d.p, score: s });
  }
  return out
    .sort((a, b) => b.score - a.score)
    .filter((x) => x.score >= (opts.min ?? 2.2))
    .slice(0, k);
}

/** Her facts (from OVEREO Mind) as passages for this question only. */
export const factPassages = (facts: string[]): Passage[] => facts.map((t, i) => ({ id: `you${i + 1}`, source: "Your data", tags: ["you"], text: t }));
