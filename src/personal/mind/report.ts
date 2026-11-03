import { LAB_ALIASES } from "./nlu";
import { extractLive } from "./live";

/* =====================================================================
   Reading a lab report — on her device first.

   1. Get the text:
        PDF   → pdf.js reads the text layer (scanned PDFs → OCR)
        photo → Tesseract OCR, in her browser
      Both libraries load on demand from a CDN only when she adds a
      report; the file itself never leaves her device.
   2. OVEREO's parser finds each known test, its value, unit, printed
      range and the collection date, and converts units to the ones
      OVEREO uses (e.g. vitamin D ng/mL → nmol/L).
   3. Optionally the live brain reads ONLY the result lines (no name,
      date of birth, address or IDs) and every value it returns must
      appear in the report text.
   4. Nothing is saved until she has checked each value.
   ===================================================================== */

const PDFJS = (process.env.NEXT_PUBLIC_PDFJS_BASE || "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build").replace(/\/+$/, "");
const TESSERACT = process.env.NEXT_PUBLIC_TESSERACT_URL || "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

export interface ReportRow {
  /** OVEREO's name for the test */
  test: string;
  /** the line it came from */
  line: string;
  value: number;
  unit: string;
  low?: number;
  high?: number;
  /** "<" or ">" when the report gives a bound, e.g. "<0.5" */
  qualifier?: "<" | ">";
  /** what was printed, before unit conversion */
  printed: string;
  source: "device" | "live";
}

export interface ReportReading {
  text: string;
  rows: ReportRow[];
  collected: string | null;
  method: "pdf-text" | "ocr" | "none";
  live: boolean;
  /** why nothing was read, in plain words */
  problem?: string;
}

/* ------------------------------ get the text ------------------------------ */

type PdfTextItem = { str: string; transform: number[] };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: PdfTextItem[] }>; getViewport(o: { scale: number }): { width: number; height: number }; render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> } }> }> };
};

let pdfjsP: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfjsP ??= (import(/* webpackIgnore: true */ /* @vite-ignore */ `${PDFJS}/pdf.min.mjs`) as Promise<PdfJs>).then((m) => {
    m.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
    return m;
  });
  pdfjsP.catch(() => (pdfjsP = null));
  return pdfjsP;
}

type TesseractNS = { createWorker: (lang: string) => Promise<{ recognize: (img: HTMLCanvasElement | Blob) => Promise<{ data: { text: string } }>; terminate: () => Promise<void> }> };
let tessP: Promise<TesseractNS> | null = null;
function loadTesseract(): Promise<TesseractNS> {
  tessP ??= new Promise<TesseractNS>((resolve, reject) => {
    const w = window as unknown as { Tesseract?: TesseractNS };
    if (w.Tesseract) return resolve(w.Tesseract);
    const s = document.createElement("script");
    s.src = TESSERACT;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error("OCR failed to load")));
    s.onerror = () => reject(new Error("OCR failed to load"));
    document.head.appendChild(s);
  });
  tessP.catch(() => (tessP = null));
  return tessP;
}

/** Rebuild reading-order lines from pdf.js text items (group by baseline, then x). */
export function linesFromItems(items: PdfTextItem[]): string[] {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str?.trim()) continue;
    const y = it.transform[5];
    const x = it.transform[4];
    const row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
    if (row) row.parts.push({ x, s: it.str });
    else rows.push({ y, parts: [{ x, s: it.str }] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s.trim())
        .join("  "),
    );
}

async function imageToCanvas(src: Blob, maxSide = 2200) {
  const bmp = await createImageBitmap(src);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d")!;
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

export async function readText(file: Blob, onStep: (s: string) => void): Promise<{ text: string; method: ReportReading["method"] }> {
  const isPdf = file.type === "application/pdf" || (file as File).name?.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    onStep("Opening the PDF");
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = Math.min(doc.numPages, 8);
    const lines: string[] = [];
    for (let i = 1; i <= pages; i++) {
      onStep(`Reading page ${i} of ${pages}`);
      const page = await doc.getPage(i);
      lines.push(...linesFromItems((await page.getTextContent()).items));
    }
    const text = lines.join("\n");
    if (text.replace(/\s/g, "").length >= 40) return { text, method: "pdf-text" };
    // a scanned PDF: render pages and read them like photos
    onStep("This PDF is a scan — reading it like a photo");
    const T = await loadTesseract();
    const worker = await T.createWorker("eng");
    try {
      let out = "";
      for (let i = 1; i <= Math.min(pages, 3); i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        onStep(`Reading scanned page ${i}`);
        out += `${(await worker.recognize(c)).data.text}\n`;
      }
      return { text: out, method: "ocr" };
    } finally {
      await worker.terminate();
    }
  }
  onStep("Preparing the photo");
  const canvas = await imageToCanvas(file);
  onStep("Reading the photo (on your device)");
  const T = await loadTesseract();
  const worker = await T.createWorker("eng");
  try {
    return { text: (await worker.recognize(canvas)).data.text, method: "ocr" };
  } finally {
    await worker.terminate();
  }
}

/* -------------------------------- parse -------------------------------- */

// longer, more specific names first (so "haemoglobin A1c" isn't read as haemoglobin)
const REPORT_NAMES: [string, string[]][] = [
  ["HbA1c", ["hemoglobin a1c", "haemoglobin a1c", "hemoglobin alc", "haemoglobin alc", "hb a1c", "hba1c", "hbalc", "a1c", "glycated hemoglobin", "glycated haemoglobin", "glycosylated hemoglobin"]],
  ["Vitamin D", ["25-hydroxy vitamin d", "25 hydroxy vitamin d", "25-hydroxyvitamin d", "25(oh)d", "25-oh vitamin d", "25(oh) vitamin d", "vitamin d, 25-hydroxy", "vitamin d 25-hydroxy", "vitamin d total", "vitamin d2+d3", "vitamin d"]],
  ["AMH", ["anti-mullerian hormone", "anti mullerian hormone", "anti-müllerian hormone", "antimullerian hormone", "amh"]],
  ["TSH", ["thyroid stimulating hormone", "thyroid-stimulating hormone", "thyrotropin", "tsh"]],
  ["FSH (day 3)", ["follicle stimulating hormone", "follicle-stimulating hormone", "fsh"]],
  ["Estradiol (day 3)", ["estradiol", "oestradiol", "estradiol (e2)", "e2"]],
  ["Progesterone", ["progesterone"]],
  ["Total testosterone", ["testosterone, total", "total testosterone", "testosterone"]],
  ["hs-CRP", ["high sensitivity c-reactive protein", "c-reactive protein, high sensitivity", "c reactive protein high sensitivity", "hs-crp", "hscrp", "hs crp", "crp, high sensitivity", "c-reactive protein", "crp"]],
  ["LDL cholesterol", ["ldl cholesterol", "ldl-cholesterol", "ldl-c", "ldl chol", "ldl"]],
  ["Ferritin", ["ferritin"]],
  ["Hemoglobin", ["hemoglobin", "haemoglobin", "hgb", "hb"]],
];
// keep in step with the chat vocabulary
void LAB_ALIASES;

/** Words that mean a different test even though the name matches. */
const NOT_THIS: Record<string, RegExp> = {
  "Total testosterone": /\b(free|bioavailable|index)\b/i,
  "Vitamin D": /\b(1,25|dihydroxy|binding)\b/i,
  "LDL cholesterol": /\b(ratio|particle|hdl\/ldl|ldl\/hdl)\b/i,
  Hemoglobin: /\b(a1c|alc|mean corpuscular|mch|mchc|glycated|glycosylated)\b/i,
  "hs-CRP": /\bratio\b/i,
  "FSH (day 3)": /\blh\/fsh|fsh\/lh\b/i,
};

const UNIT = /(ng\/ml|ng\/dl|ug\/l|µg\/l|mcg\/l|nmol\/l|pmol\/l|mmol\/l|mmol\/mol|g\/l|g\/dl|mg\/l|mg\/dl|miu\/l|miu\/ml|uiu\/ml|µiu\/ml|μiu\/ml|mu\/l|iu\/l|u\/l|pg\/ml|%)/i;

/** Convert to the units OVEREO uses. Returns null when the unit isn't known for that test. */
export function toCanonical(test: string, value: number, unit: string): { value: number; unit: string } | null {
  const u = unit.toLowerCase().replace("μ", "µ").replace("mcg", "µg").replace(/^ug/, "µg").replace(/^uiu/, "µiu");
  const k = (f: number, to: string, dp = 1) => ({ value: Math.round(value * f * 10 ** dp) / 10 ** dp, unit: to });
  switch (test) {
    case "Ferritin":
      return /^(ng\/ml|µg\/l)$/.test(u) ? k(1, "ng/mL", 1) : null;
    case "Vitamin D":
      return u === "nmol/l" ? k(1, "nmol/L", 0) : u === "ng/ml" ? k(2.496, "nmol/L", 0) : null;
    case "AMH":
      return u === "ng/ml" ? k(1, "ng/mL", 2) : u === "pmol/l" ? k(1 / 7.14, "ng/mL", 2) : null;
    case "TSH":
      return /^(miu\/l|µiu\/ml|miu\/ml|mu\/l)$/.test(u) ? k(1, "mIU/L", 2) : null;
    case "HbA1c":
      // IFCC mmol/mol → NGSP %: % = 0.09148 × mmol/mol + 2.152
      return u === "%" ? k(1, "%", 1) : u === "mmol/mol" ? { value: Math.round((0.09148 * value + 2.152) * 10) / 10, unit: "%" } : null;
    case "FSH (day 3)":
      return /^(iu\/l|miu\/ml|u\/l)$/.test(u) ? k(1, "IU/L", 1) : null;
    case "Estradiol (day 3)":
      return u === "pg/ml" ? k(1, "pg/mL", 0) : u === "pmol/l" ? k(1 / 3.671, "pg/mL", 0) : null;
    case "Progesterone":
      return u === "ng/ml" ? k(1, "ng/mL", 1) : u === "nmol/l" ? k(1 / 3.18, "ng/mL", 1) : null;
    case "Total testosterone":
      return u === "nmol/l" ? k(1, "nmol/L", 2) : u === "ng/dl" ? k(1 / 28.84, "nmol/L", 2) : null;
    case "hs-CRP":
      return u === "mg/l" ? k(1, "mg/L", 1) : u === "mg/dl" ? k(10, "mg/L", 1) : null;
    case "LDL cholesterol":
      return u === "mmol/l" ? k(1, "mmol/L", 2) : u === "mg/dl" ? k(1 / 38.67, "mmol/L", 2) : null;
    case "Hemoglobin":
      return u === "g/l" ? k(1, "g/L", 0) : u === "g/dl" ? k(10, "g/L", 0) : null;
  }
  return null;
}

/** A sensible default unit when a report prints the number without one. */
const DEFAULT_UNIT: Record<string, string> = { Ferritin: "ng/mL", "Vitamin D": "nmol/L", AMH: "ng/mL", TSH: "mIU/L", HbA1c: "%", "FSH (day 3)": "IU/L", "Estradiol (day 3)": "pg/mL", Progesterone: "ng/mL", "Total testosterone": "nmol/L", "hs-CRP": "mg/L", "LDL cholesterol": "mmol/L", Hemoglobin: "g/L" };

/** Values outside these can't be real (catches OCR slips like a missing decimal point). */
const PLAUSIBLE: Record<string, [number, number]> = { Ferritin: [0.5, 5000], "Vitamin D": [5, 600], AMH: [0, 30], TSH: [0, 150], HbA1c: [3, 20], "FSH (day 3)": [0, 200], "Estradiol (day 3)": [0, 6000], Progesterone: [0, 300], "Total testosterone": [0, 40], "hs-CRP": [0, 300], "LDL cholesterol": [0.2, 15], Hemoglobin: [40, 220] };

const num = (s: string) => {
  // "1,000" thousands, "6,4" decimal comma
  const t = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  return Number(t);
};

export function parseReport(raw: string): { rows: ReportRow[]; collected: string | null } {
  const text = raw
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    // common OCR slips in units: "mlU/L" → "mIU/L", "u g/L" → "ug/L"
    .replace(/\bm[l1|]U\//g, "mIU/")
    .replace(/\b([uµμ])[l1|]U\//g, "$1IU/")
    .replace(/\b([uµμ]) g\/l\b/gi, "$1g/L");
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const rows: ReportRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const low = line.toLowerCase();
    for (const [test, names] of REPORT_NAMES) {
      if (seen.has(test)) continue;
      const hit = names
        .map((n) => ({ n, at: findWord(low, n) }))
        .filter((x) => x.at >= 0)
        .sort((a, b) => b.n.length - a.n.length)[0];
      if (!hit) continue;
      if (NOT_THIS[test]?.test(line)) continue;
      // everything after the name; results printed on the next line are common in OCR'd tables
      let rest = line.slice(hit.at + hit.n.length);
      if (!/\d/.test(rest.replace(/^[^a-z0-9]*\(?[a-z0-9]{1,3}\)?/i, "")) && lines[i + 1] && !REPORT_NAMES.some(([, ns]) => ns.some((n) => n.length > 2 && findWord(lines[i + 1].toLowerCase(), n) >= 0))) rest = `${rest} ${lines[i + 1]}`;
      const parsed = parseValue(test, rest);
      if (!parsed) continue;
      rows.push({ ...parsed, test, line: line.length > 140 ? `${line.slice(0, 140)}…` : line, source: "device" });
      seen.add(test);
      break;
    }
  }
  return { rows, collected: findDate(lines) };
}

function findWord(hay: string, needle: string) {
  let from = 0;
  for (;;) {
    const i = hay.indexOf(needle, from);
    if (i < 0) return -1;
    const before = i === 0 ? " " : hay[i - 1];
    const after = hay[i + needle.length] ?? " ";
    if (!/[a-z0-9]/.test(before) && !/[a-z]/.test(after)) return i;
    from = i + 1;
  }
}

function parseValue(test: string, restRaw: string): Omit<ReportRow, "test" | "line" | "source"> | null {
  // drop a leading "(e2)" / ", total" / ":" and the method/flag words around numbers
  const rest = restRaw
    .replace(/^[\s,:;*-]*(\((e2|tsh|amh|fsh|hba1c|crp|ldl)\))?/i, " ")
    // "Vitamin D 25-OH: 32" — the 25 is part of the name, not the result
    .replace(/^\s*[,(]?\s*(1,)?25\s*[-(]?\s*(oh|hydroxy)\)?\s*(d3|d2|d|vitamin d)?\)?/i, " ");
  const m = rest.match(/(^|[^\d.,/-])([<>]=?)?\s*(\d{1,4}(?:[.,]\d{1,3})?(?:,\d{3})*)(?![\d.,]*\d)(?!\s*[-/]\s*\d{2,4}[-/])/);
  if (!m) return null;
  const qualifier = m[2] ? (m[2][0] as "<" | ">") : undefined;
  const value = num(m[3]);
  if (!Number.isFinite(value)) return null;
  const after = rest.slice((m.index ?? 0) + m[0].length);
  const unitM = after.match(UNIT) ?? rest.match(UNIT);
  const unit = unitM ? unitM[1] : "";
  // printed reference range: "30 - 100", "30-100", "(30.0-100.0)", "< 5.0", "> 30"
  const rng = after.match(/(\d+(?:[.,]\d+)?)\s*(?:-|to)\s*(\d+(?:[.,]\d+)?)/);
  const upper = !rng ? after.match(/(?:^|\s|\()(?:<|≤|less than|up to)\s*=?\s*(\d+(?:[.,]\d+)?)/i) : null;
  const lower = !rng ? after.match(/(?:^|\s|\()(?:>|≥|greater than|over)\s*=?\s*(\d+(?:[.,]\d+)?)/i) : null;
  let lowV = rng ? num(rng[1]) : lower ? num(lower[1]) : undefined;
  let highV = rng ? num(rng[2]) : upper ? num(upper[1]) : undefined;
  if (lowV != null && highV != null && lowV > highV) [lowV, highV] = [highV, lowV];

  const printedUnit = unit || DEFAULT_UNIT[test];
  const conv = toCanonical(test, value, printedUnit);
  if (!conv) return null;
  const cLow = lowV != null ? toCanonical(test, lowV, printedUnit)?.value : undefined;
  const cHigh = highV != null ? toCanonical(test, highV, printedUnit)?.value : undefined;
  const [pl, ph] = PLAUSIBLE[test] ?? [0, 1e6];
  if (conv.value < pl || conv.value > ph) return null;
  return {
    value: conv.value,
    unit: conv.unit,
    low: cLow,
    high: cHigh,
    qualifier,
    printed: `${qualifier ?? ""}${m[3]} ${unit || "(no unit printed)"}${rng ? ` · range ${rng[1]}–${rng[2]}` : upper ? ` · range < ${upper[1]}` : lower ? ` · range > ${lower[1]}` : ""}`,
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The collection date, if the report states one clearly. */
export function findDate(lines: string[]): string | null {
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    if (dt > new Date(Date.now() + 86_400_000) || y < 2000) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const parseIn = (s: string) => {
    let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m) {
      const a = +m[1];
      const b = +m[2];
      if (a > 12 && b <= 12) return iso(+m[3], b, a);
      if (b > 12 && a <= 12) return iso(+m[3], a, b);
      return null; // 03/04/2026 could be March 4 or 3 April — let her choose
    }
    m = s.match(/\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(20\d{2})\b/i);
    if (m && MONTHS.includes(m[2].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
    m = s.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    if (m && MONTHS.includes(m[1].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
    return null;
  };
  const KEY = /\b(collect\w*|collection|specimen|sample date|drawn|draw date|date of service)\b/i;
  for (const l of lines) {
    const k = l.match(KEY);
    if (!k) continue;
    // read the date that follows the keyword, not a birth or report date elsewhere on the line
    const tail = l.slice((k.index ?? 0) + k[0].length).split(/\b(dob|birth|reported|received|printed)\b/i)[0];
    const d = parseIn(tail);
    if (d) return d;
  }
  return null;
}

/** Only the lines that hold results — no name, birth date, address, phone, email or IDs. */
export function resultLinesOnly(text: string): string {
  const PII = /\b(name|patient|dob|birth|born|address|street|phone|tel|fax|email|mrn|health card|hcn|insurance|ohip|ahcip|msp|ssn|sin|account|physician|doctor|dr\.|ordered by|requisition|accession|postal|zip)\b|@/i;
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => /\d/.test(l) && (UNIT.test(l) || /\d\s*-\s*\d/.test(l) || /\b(collect|specimen|drawn)\w*\b/i.test(l)) && !PII.test(l))
    .map((l) => l.replace(/\b\d{7,}\b/g, "#"))
    .slice(0, 120)
    .join("\n");
}

/* --------------------------------- all together --------------------------------- */

export async function readReport(file: Blob, opts: { useLive: boolean; onStep: (s: string) => void }): Promise<ReportReading> {
  let text = "";
  let method: ReportReading["method"] = "none";
  try {
    const r = await readText(file, opts.onStep);
    text = r.text;
    method = r.method;
  } catch {
    return { text: "", rows: [], collected: null, method: "none", live: false, problem: "I couldn't open the reader on this device (it needs a connection the first time). You can type the values instead." };
  }
  opts.onStep("Finding your results");
  const local = parseReport(text);
  let live = false;
  if (opts.useLive) {
    const lines = resultLinesOnly(text);
    if (lines.length > 20) {
      opts.onStep("Double-checking with the live brain");
      const ex = await extractLive(lines).catch(() => null);
      if (ex) {
        live = true;
        for (const r of ex.results) {
          const canon = canonicalName(r.test);
          if (!canon || local.rows.some((x) => x.test === canon)) continue;
          const conv = toCanonical(canon, r.value, r.unit || DEFAULT_UNIT[canon]);
          if (!conv) continue;
          const [pl, ph] = PLAUSIBLE[canon] ?? [0, 1e6];
          if (conv.value < pl || conv.value > ph) continue;
          local.rows.push({
            test: canon,
            line: `${r.test} ${r.value} ${r.unit}`,
            value: conv.value,
            unit: conv.unit,
            low: r.low != null ? toCanonical(canon, r.low, r.unit || DEFAULT_UNIT[canon])?.value : undefined,
            high: r.high != null ? toCanonical(canon, r.high, r.unit || DEFAULT_UNIT[canon])?.value : undefined,
            printed: `${r.value} ${r.unit}`,
            source: "live",
          });
        }
        local.collected ??= ex.collected;
      }
    }
  }
  return {
    text,
    rows: local.rows,
    collected: local.collected,
    method,
    live,
    problem: local.rows.length ? undefined : text.trim() ? "I read the report but didn't find tests I know. You can add the values yourself." : "I couldn't read any text — try a sharper, well-lit photo, or type the values.",
  };
}

export function canonicalName(printed: string): string | null {
  const low = ` ${printed.toLowerCase()} `;
  for (const [test, names] of REPORT_NAMES) if (names.some((n) => findWord(low, n) >= 0) && !NOT_THIS[test]?.test(printed)) return test;
  return null;
}
