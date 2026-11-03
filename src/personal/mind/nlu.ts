/* =====================================================================
   OVEREO Mind — understanding what she means.

   On-device, instant, no model download. Text is normalised, matched to
   concepts (with typo tolerance), scored into intents, and entities are
   pulled out: which symptom, which lab test, how many hours, which day.
   It also spots when she is *telling* OVEREO something ("my period
   started", "slept 6 hours", "bad headache today") so it can offer to log
   it in one tap — she always confirms.
   ===================================================================== */

export type IntentId =
  | "emergency"
  | "greet"
  | "thanks"
  | "help"
  | "period_next"
  | "cycle_phase"
  | "cycle_regular"
  | "fertile"
  | "pregnant"
  | "symptom"
  | "mood"
  | "sleep"
  | "tired"
  | "lab"
  | "labs_all"
  | "bp"
  | "temp"
  | "weight"
  | "meds"
  | "whatif"
  | "overview"
  | "learned"
  | "visit"
  | "tests"
  | "remember"
  | "forget"
  | "log"
  | "safety"
  | "general";

export interface LogIntent {
  type: "period_start" | "period_end" | "symptom" | "mood" | "sleep_duration" | "blood_pressure" | "morning_temperature" | "weight";
  value: Record<string, unknown>;
  when: "today" | "yesterday";
  label: string;
}

export interface Understanding {
  intent: IntentId;
  confidence: number;
  /** runner-up, for transparency and tests */
  alt: IntentId | null;
  text: string;
  symptom: string | null;
  lab: string | null;
  metric: "sleep" | "mood" | "pain" | "weight" | "bp" | null;
  delta: number | null;
  when: "today" | "yesterday" | "tomorrow" | "week" | null;
  log: LogIntent | null;
  memory: string | null;
  emergency: Emergency | null;
  question: boolean;
}

export type Emergency = "heart" | "breathing" | "stroke" | "bleeding" | "self-harm" | "faint" | "pregnancy-pain" | "seizure" | "allergy";

/* ------------------------------ normalise ------------------------------ */

export function normalise(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bim\b/g, "i am")
    .replace(/\bive\b/g, "i have")
    .replace(/\bi've\b/g, "i have")
    .replace(/\bcan't\b|\bcant\b/g, "cannot")
    .replace(/\bdon't\b|\bdont\b/g, "do not")
    .replace(/\bdidn't\b|\bdidnt\b/g, "did not")
    .replace(/\bwhat's\b|\bwhats\b/g, "what is")
    .replace(/\bhow's\b/g, "how is")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bu\b/g, "you")
    .replace(/\br\b/g, "are")
    .replace(/\bpls\b|\bplz\b/g, "please")
    .replace(/[^\p{L}\p{N}./%°+\-'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Damerau–Levenshtein distance, capped (returns cap+1 when larger). */
export function editDistance(a: string, b: string, cap = 2) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return d[a.length][b.length];
}

const tolerance = (w: string) => (w.length >= 8 ? 2 : w.length >= 5 ? 1 : 0);

/** Does the text contain this phrase, allowing small typos in longer words? */
function has(words: string[], text: string, phrase: string) {
  if (phrase.includes(" ")) {
    if (text.includes(phrase)) return true;
    const ps = phrase.split(" ");
    for (let i = 0; i + ps.length <= words.length; i++) if (ps.every((p, j) => p === words[i + j] || (tolerance(p) > 0 && editDistance(p, words[i + j], tolerance(p)) <= tolerance(p)))) return true;
    return false;
  }
  return words.some((w) => {
    if (w === phrase) return true;
    // stem variants (sleep/sleepy) are listed explicitly — only allow a short suffix on the phrase
    if (w.startsWith(phrase) || phrase.startsWith(w)) return phrase.length >= 4 && w.startsWith(phrase) && w.length - phrase.length <= 3;
    return tolerance(phrase) > 0 && w.length >= 4 && editDistance(phrase, w, tolerance(phrase)) <= tolerance(phrase);
  });
}

/* ------------------------------- lexicon ------------------------------- */

const C: Record<string, string[]> = {
  period: ["period", "periods", "menstruation", "menses", "bleeding", "bleed", "my flow", "aunt flo", "time of the month", "menstrual"],
  next: ["next", "when", "due", "coming", "expect", "start", "arrive", "late", "early", "predict"],
  late: ["late", "missed", "overdue", "delayed", "has not come", "did not come", "not come", "no period"],
  phase: ["phase", "cycle day", "which day", "what day", "where am i", "stage of my cycle", "luteal", "follicular", "ovulatory"],
  cycle: ["cycle", "cycles"],
  regular: ["regular", "irregular", "normal cycle", "normal cycles", "cycle normal", "cycles normal", "normal period", "periods normal", "cycle length", "how long", "length", "vary", "varies", "consistent"],
  spotting: ["spotting", "spot bleeding", "bleeding between", "between periods", "bleeding after sex", "brown discharge"],
  safety: ["signs of a stroke", "stroke signs", "signs of stroke", "heart attack signs", "signs of a heart attack", "symptoms of a heart attack", "symptoms of stroke", "symptoms of a stroke", "when to go to the er", "when should i go to emergency", "emergency signs"],
  lower: ["lower", "reduce", "bring down", "improve", "decrease", "get down"],
  fertile: ["fertile", "fertility window", "fertile window", "ovulate", "ovulation", "ovulating", "conceive", "get pregnant", "best day", "try for a baby", "ttc"],
  pregnant: ["pregnant", "pregnancy", "pregnancy test"],
  symptom: ["cramp", "cramps", "pain", "ache", "headache", "migraine", "bloating", "bloated", "acne", "pimples", "breast", "tender", "nausea", "hot flash", "hot flushes", "night sweats", "back pain", "sore", "hurt", "hurts", "symptom", "symptoms"],
  mood: ["mood", "moody", "sad", "low", "down", "anxious", "anxiety", "irritable", "emotional", "depressed", "happy", "stressed", "stress", "crying", "feel"],
  sleep: ["sleep", "slept", "sleeping", "insomnia", "night", "nights", "rest", "bed"],
  tired: ["tired", "exhausted", "fatigue", "fatigued", "no energy", "low energy", "energy", "drained", "weak", "sleepy"],
  lab: ["lab", "labs", "result", "results", "blood test", "bloodwork", "report", "level", "levels", "value"],
  bp: ["blood pressure", "bp", "hypertension", "systolic", "diastolic", "pressure"],
  temp: ["temperature", "temp", "fever", "bbt", "basal", "thermometer"],
  weight: ["weight", "weigh", "kg", "pounds", "lbs", "bmi"],
  meds: ["medicine", "medication", "medications", "meds", "pill", "pills", "tablet", "supplement", "supplements", "vitamin", "dose", "taking"],
  whatif: ["what if", "what would happen", "if i", "suppose", "would it help", "simulate", "what happens if"],
  overview: ["how am i", "how am i doing", "overview", "summary", "summarise", "summarize", "my week", "this week", "update", "status", "doing"],
  learned: ["learned", "learnt", "know about me", "what do you know", "remember about me", "patterns", "pattern", "noticed", "found"],
  visit: ["doctor", "visit", "appointment", "gp", "gynecologist", "gynaecologist", "clinician", "obgyn", "physician", "nurse", "specialist", "ask my doctor"],
  tests: ["test", "tests", "which test", "should i test", "get tested", "order", "check my", "screening"],
  remember: ["remember that", "remember i", "note that", "keep in mind", "for your info", "fyi", "i am allergic", "i am vegetarian", "i am vegan", "i do not eat", "i work night", "i am on"],
  forget: ["forget", "delete that", "remove that", "not true", "that is wrong", "wrong about"],
  greet: ["hi", "hello", "hey", "good morning", "good evening", "hola", "namaste"],
  thanks: ["thanks", "thank you", "thx", "appreciate"],
  help: ["what can you do", "help", "how do you work", "how does this work", "who are you"],
  why: ["why", "cause", "causes", "reason", "because"],
  me: ["my", "me", "i", "mine", "am i"],
};

/* weights: [concept, weight] — an intent wins with the highest total */
const INTENTS: { id: IntentId; cues: [string, number][]; needs?: string[] }[] = [
  { id: "period_next", cues: [["period", 2], ["next", 2], ["late", 2]], needs: ["period"] },
  { id: "cycle_phase", cues: [["phase", 3], ["cycle", 1]] },
  { id: "cycle_regular", cues: [["regular", 2], ["cycle", 2], ["period", 1]], needs: ["regular"] },
  { id: "fertile", cues: [["fertile", 4], ["next", 0.5]] },
  { id: "pregnant", cues: [["pregnant", 3], ["late", 1]] },
  { id: "symptom", cues: [["symptom", 3], ["why", 1], ["spotting", 4]] },
  { id: "safety", cues: [["safety", 6]] },
  { id: "mood", cues: [["mood", 3], ["why", 0.5]] },
  { id: "sleep", cues: [["sleep", 3]] },
  { id: "tired", cues: [["tired", 3.5], ["why", 0.5]] },
  { id: "lab", cues: [["lab", 2]] },
  { id: "bp", cues: [["bp", 4], ["lower", 0.5]] },
  { id: "temp", cues: [["temp", 3]] },
  { id: "weight", cues: [["weight", 3]] },
  { id: "meds", cues: [["meds", 3]] },
  { id: "whatif", cues: [["whatif", 5]] },
  { id: "overview", cues: [["overview", 3]] },
  { id: "learned", cues: [["learned", 4]] },
  { id: "visit", cues: [["visit", 3]] },
  { id: "tests", cues: [["tests", 2.5]] },
  { id: "remember", cues: [["remember", 5]] },
  { id: "forget", cues: [["forget", 4]] },
  { id: "greet", cues: [["greet", 2]] },
  { id: "thanks", cues: [["thanks", 3]] },
  { id: "help", cues: [["help", 3]] },
];

/* -------------------------------- entities -------------------------------- */

export const LAB_ALIASES: [string, string[]][] = [
  ["Ferritin", ["ferritin", "iron stores", "iron store", "iron level", "iron levels", "iron"]],
  ["Vitamin D", ["vitamin d", "vit d", "vitd", "d3", "25-oh", "25 oh", "25(oh)d", "calcidiol"]],
  ["AMH", ["amh", "anti mullerian", "anti-mullerian", "egg reserve", "ovarian reserve", "egg count"]],
  ["TSH", ["tsh", "thyroid"]],
  ["HbA1c", ["hba1c", "a1c", "blood sugar", "sugar", "glucose", "glycated"]],
  ["FSH (day 3)", ["fsh", "follicle stimulating"]],
  ["Estradiol (day 3)", ["estradiol", "oestradiol", "e2", "estrogen", "oestrogen"]],
  ["Progesterone", ["progesterone"]],
  ["Total testosterone", ["testosterone", "androgen", "androgens"]],
  ["hs-CRP", ["crp", "hs-crp", "hscrp", "inflammation", "c-reactive"]],
  ["LDL cholesterol", ["ldl", "cholesterol", "lipids"]],
  ["Hemoglobin", ["hemoglobin", "haemoglobin", "hb", "hgb", "anemia", "anaemia", "anemic", "anaemic"]],
];

const SYMPTOM_ALIASES: [string, string[]][] = [
  ["Spotting", ["spotting", "spot bleeding", "bleeding between periods", "between periods", "bleeding after sex", "brown discharge"]],
  ["Cramps / pelvic pain", ["cramp", "cramps", "pelvic pain", "period pain", "menstrual pain", "lower belly", "abdominal pain", "stomach pain", "tummy pain"]],
  ["Headache", ["headache", "headaches", "migraine", "migraines", "head hurts", "head ache"]],
  ["Bloating", ["bloating", "bloated", "swollen belly", "gas"]],
  ["Breast tenderness", ["breast", "breasts", "tender breasts", "sore breasts", "boobs"]],
  ["Acne", ["acne", "pimples", "breakout", "breakouts", "spots"]],
  ["Painful bowel movements", ["bowel", "poop", "pooping", "bowel movements", "constipation", "diarrhea", "diarrhoea"]],
  ["Pain with sex", ["sex", "intercourse", "dyspareunia"]],
  ["Hot flash", ["hot flash", "hot flashes", "hot flush", "hot flushes", "flush"]],
  ["Night sweats", ["night sweats", "night sweat", "sweating at night"]],
  ["Fatigue", ["fatigue", "fatigued", "exhausted", "tired", "no energy", "low energy"]],
  ["Nausea", ["nausea", "nauseous", "sick to my stomach", "queasy", "vomit", "vomiting"]],
  ["Back pain", ["back pain", "backache", "lower back", "back hurts"]],
];

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5 };

/* -------------------------------- safety -------------------------------- */

const EMERGENCY: [Emergency, RegExp][] = [
  ["self-harm", /\b(kill myself|end my life|suicid\w*|want to die|wanna die|hurt myself|harm myself|self[- ]harm|cutting myself|no reason to live|better off dead|take my (own )?life)\b/],
  ["heart", /\b(chest (pain|pressure|tightness)|pain in my chest|my chest (hurts|is tight|feels tight)|crushing (pain|feeling)|heart attack|pain (spreading|going) (to|down) my (arm|jaw|back))\b/],
  ["breathing", /\b(cannot breathe|can not breathe|struggling to breathe|hard to breathe|short of breath|shortness of breath|gasping|choking)\b/],
  ["stroke", /\b(face (is )?droop\w*|slurred speech|speech is slurred|cannot speak|one side (of my body )?(is )?(weak|numb)|sudden (numbness|weakness)|stroke|worst headache of my life)\b/],
  ["bleeding", /\b(soak\w* (a |through )?(pad|tampon)s? (every|each|in an?) hour|bleeding (very )?heavily|heavy bleeding (that )?(will not|does not|won't) stop|bleeding (will not|does not|won't) stop|hemorrhag\w*|haemorrhag\w*|passing large clots)\b/],
  ["faint", /\b(fainted|passed out|blacked out|lost consciousness|unconscious)\b/],
  ["pregnancy-pain", /\b(pregnant|pregnancy)\b.*\b(severe|sharp|bad|terrible) (pain|cramp\w*)\b|\b(severe|sharp) (pain|cramp\w*)\b.*\b(pregnant|pregnancy)\b|\bpregnant\b.*\bbleeding\b/],
  ["seizure", /\b(seizure|convulsion|fitting)\b/],
  ["allergy", /\b(throat (is )?(closing|swelling)|swollen (tongue|lips|throat)|anaphyla\w*)\b/],
];

export function detectEmergency(t: string): Emergency | null {
  // "what are the signs of a stroke" is a question about it, not one happening — still answer safely,
  // but only first-person or present-tense phrasing triggers the emergency card.
  for (const [k, re] of EMERGENCY) if (re.test(t)) {
    const generic = /\b(what (are|is)|signs of|symptoms of|how do i know|tell me about|explain)\b/.test(t) && !/\b(i am|i have|i feel|my|right now|now)\b/.test(t);
    if (k === "self-harm" || !generic) return k;
  }
  return null;
}

/* --------------------------------- logging --------------------------------- */

const QUESTION = /^(why|how|what|when|where|which|who|is|are|am|do|does|did|should|could|would|can|will|tell me|explain|show me)\b|\?$/;

function moodScore(t: string): 1 | 2 | 3 | 4 | 5 | null {
  if (/\b(amazing|great|fantastic|wonderful|excellent|really good)\b/.test(t)) return 5;
  if (/\b(good|happy|better|fine|well)\b/.test(t)) return 4;
  if (/\b(okay|ok|alright|so so|meh)\b/.test(t)) return 3;
  if (/\b(flat|blah|irritable|anxious|stressed|meh)\b/.test(t)) return 2;
  if (/\b(low|sad|down|awful|terrible|horrible|depressed|miserable|bad)\b/.test(t)) return 1;
  return null;
}

function severity(t: string): number {
  const n = t.match(/\b(\d{1,2})\s*(\/|out of)\s*10\b/);
  if (n) return Math.min(10, Number(n[1]));
  if (/\b(unbearable|worst|excruciating)\b/.test(t)) return 9;
  if (/\b(severe|terrible|awful|really bad|very bad|horrible|intense)\b/.test(t)) return 8;
  if (/\b(bad|strong|painful)\b/.test(t)) return 6;
  if (/\b(mild|slight|little|light|a bit)\b/.test(t)) return 3;
  return 5;
}

export function detectLog(t: string, words: string[]): LogIntent | null {
  if (QUESTION.test(t)) return null;
  const when: LogIntent["when"] = /\byesterday|last night\b/.test(t) && !/\bslept\b/.test(t) ? "yesterday" : "today";
  if (/\b(my )?period (started|came|began|arrived|is here|has started|just started)|\b(started|got|getting) my period|\bon my period (today|now)\b/.test(t))
    return { type: "period_start", value: { flow: /\bheavy\b/.test(t) ? 3 : /\blight|spotting\b/.test(t) ? 1 : 2 }, when, label: `Period started ${when}` };
  if (/\bperiod (ended|stopped|finished|is over|has ended|is done)\b|\bmy period is over\b/.test(t)) return { type: "period_end", value: {}, when, label: `Period ended ${when}` };
  const slept = t.match(/\bslept (?:for |about |around |only |just )?(\d+(?:[.,]\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)(?: and a half)? ?(h|hrs?|hours?)\b/);
  if (slept) {
    let h = Number(slept[1].replace(",", ".")) || NUM[slept[1]] || 0;
    if (/and a half/.test(slept[0])) h += 0.5;
    if (h > 0 && h <= 16) return { type: "sleep_duration", value: { minutes: Math.round(h * 60) }, when: "today", label: `Slept ${h} h` };
  }
  const bp = t.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
  if (bp && (/\b(bp|blood pressure|pressure)\b/.test(t) || words.length <= 3)) {
    const s = Number(bp[1]);
    const d = Number(bp[2]);
    if (s >= 70 && s <= 250 && d >= 40 && d <= 150 && s > d) return { type: "blood_pressure", value: { systolic: s, diastolic: d }, when, label: `Blood pressure ${s}/${d}` };
  }
  const temp = t.match(/\b(?:temp(?:erature)?|fever)\b[^\d]{0,12}(\d{2,3}(?:[.,]\d{1,2})?)\s*(°|deg|c|f)?/);
  if (temp) {
    let c = Number(temp[1].replace(",", "."));
    if (c > 80) c = Math.round(((c - 32) * 5) / 9 * 100) / 100;
    if (c >= 34 && c <= 42.5) return { type: "morning_temperature", value: { celsius: c }, when, label: `Temperature ${c} °C` };
  }
  const wt = t.match(/\b(?:weigh|weight(?: is)?|weighed)\s*(\d{2,3}(?:[.,]\d)?)\s*(kg|kgs|kilos?|lb|lbs|pounds)?\b/);
  if (wt) {
    let kg = Number(wt[1].replace(",", "."));
    if (wt[2] && /lb|pound/.test(wt[2])) kg = Math.round(kg * 0.45359237 * 10) / 10;
    if (kg >= 25 && kg <= 300) return { type: "weight", value: { kg }, when, label: `Weight ${kg} kg` };
  }
  const iHave = /\b(i have|i got|i have got|having|i am having|i feel|feeling|got|my)\b/.test(t) || words.length <= 4;
  if (iHave) {
    const sym = findSymptom(t, words);
    if (sym && !/\b(no|not|without|never)\b/.test(t)) return { type: "symptom", value: { name: sym, severity: severity(t) }, when, label: `${sym} · ${severity(t)}/10` };
  }
  if (/\b(i feel|i am feeling|feeling|my mood is|mood)\b/.test(t) || words.length <= 3) {
    const m = moodScore(t);
    if (m && !/\b(not|no)\b/.test(t)) return { type: "mood", value: { score: m, label: ["", "Low", "Flat", "Okay", "Good", "Great"][m] }, when, label: `Mood · ${["", "Low", "Flat", "Okay", "Good", "Great"][m]}` };
  }
  return null;
}

export function findSymptom(t: string, words: string[], own: string[] = []): string | null {
  // her own symptom names first (exact wording she used)
  for (const name of own) if (t.includes(name.toLowerCase())) return name;
  for (const [canon, al] of SYMPTOM_ALIASES) if (al.some((a) => has(words, t, a))) return canon;
  return null;
}

export function findLab(t: string, words: string[]): string | null {
  for (const [canon, al] of LAB_ALIASES) if (al.some((a) => (a.length <= 3 ? words.includes(a) : has(words, t, a)))) return canon;
  return null;
}

function findDelta(t: string): { metric: Understanding["metric"]; delta: number | null } {
  const metric: Understanding["metric"] = /\bsleep|slept|bed\b/.test(t) ? "sleep" : /\bweight|kg|lose|lost|gain\b/.test(t) ? "weight" : /\bpain|cramp/.test(t) ? "pain" : /\bmood\b/.test(t) ? "mood" : /\bbp|blood pressure|salt|sodium\b/.test(t) ? "bp" : null;
  const m = t.match(/(\d+(?:[.,]\d+)?|an?|one|two|three|half)\s*(?:more|extra|less|fewer)?\s*(h|hrs?|hours?|mins?|minutes?|kg|kilos?)\b/);
  let delta: number | null = null;
  if (m) {
    delta = Number(m[1].replace(",", ".")) || NUM[m[1]] || null;
    if (delta != null && /min/.test(m[2])) delta = delta / 60;
    if (delta != null && /\b(less|fewer|lose|lost|reduce|cut)\b/.test(t)) delta = -delta;
  }
  const abs = t.match(/\bsleep (\d+(?:[.,]\d+)?) ?(h|hours?)\b/);
  if (abs && !/\b(more|extra|less)\b/.test(t)) delta = null;
  return { metric, delta };
}

/* --------------------------------- main --------------------------------- */

export function understand(raw: string, ownSymptoms: string[] = []): Understanding {
  const text = normalise(raw);
  const words = text.split(" ").filter(Boolean);
  const question = QUESTION.test(text) || /\?\s*$/.test(raw.trim());
  const base: Omit<Understanding, "intent" | "confidence" | "alt"> = {
    text,
    symptom: findSymptom(text, words, ownSymptoms),
    lab: findLab(text, words),
    ...findDelta(text),
    when: /\btomorrow\b/.test(text) ? "tomorrow" : /\byesterday|last night\b/.test(text) ? "yesterday" : /\b(this|last|past) week\b/.test(text) ? "week" : /\btoday|now|tonight\b/.test(text) ? "today" : null,
    log: null,
    memory: null,
    emergency: detectEmergency(text),
    question,
  };
  if (base.emergency) return { ...base, intent: "emergency", confidence: 1, alt: null };

  const log = detectLog(text, words);
  // "I have cramps, what helps?" — offer the log AND answer the question
  const asks = /\b(why|how|what|should|could|normal|help|helps|advice|tips)\b/.test(text);
  if (log && !asks) return { ...base, log, intent: "log", confidence: 0.9, alt: null };
  base.log = log;

  const rem = raw.match(/^\s*(?:please\s+)?(?:remember|note|keep in mind)(?: that)?[:,]?\s+(.{3,200})$/i) ?? raw.match(/^\s*((?:i am|i'm|im) (?:allergic|vegetarian|vegan|on the pill|on birth control|pregnant|breastfeeding|a night shift)[^?]{0,160})$/i);
  if (rem) return { ...base, memory: rem[1].trim().replace(/\.$/, ""), intent: "remember", confidence: 0.92, alt: null };

  const present = new Set(Object.entries(C).filter(([, ps]) => ps.some((p) => has(words, text, p))).map(([k]) => k));
  const scores = INTENTS.map((it) => {
    if (it.needs && !it.needs.every((n) => present.has(n))) return { id: it.id, s: 0 };
    let s = it.cues.reduce((a, [c, w]) => a + (present.has(c) ? w : 0), 0);
    // entity boosts
    if (it.id === "lab" && base.lab) s += 3.5;
    if (it.id === "symptom" && base.symptom) s += 2;
    if (it.id === "whatif" && present.has("whatif") && base.metric) s += 1;
    if (it.id === "greet" && words.length > 4) s -= 2;
    if (it.id === "thanks" && words.length > 6) s -= 2;
    return { id: it.id, s };
  }).sort((a, b) => b.s - a.s);

  // "my period is late" → period, but "am I pregnant" when late is mentioned → pregnancy
  const top = scores[0];
  const second = scores[1];
  if (!top || top.s < 2) return { ...base, intent: "general", confidence: 0.2, alt: top?.s ? top.id : null };
  const confidence = Math.min(0.97, 0.45 + top.s / 10 + Math.min(0.25, (top.s - (second?.s ?? 0)) / 8));
  return { ...base, intent: top.id, confidence, alt: second && second.s > 0 ? second.id : null };
}
