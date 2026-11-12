import { langByCode } from "./languages";
import { safeTranslation } from "./check";
export { safeTranslation };

/* =====================================================================
   ECHO's translation engine.

   For each piece of text, in this order:
     1. this device's cache (instant, works offline)
     2. the browser's own on-device translator, when it has this language
        (Chrome's built-in Translator — nothing leaves the device)
     3. the live brain via /api/translate (only OVEREO's screen text and
        what she selects — checked so no number changes)
   Anything that can't be translated safely stays in English.
   ===================================================================== */

export type Engine = "cache" | "device" | "live";
export interface Result {
  out: string[];
  engine: Engine | null;
  /** some pieces stayed in English */
  missed: number;
  reason?: string;
}

/* --------------------------------- cache --------------------------------- */

const mem = new Map<string, Map<string, string>>();
const CK = (l: string) => `overeo.echo.cache.${l}`;
let saveT = 0;

function cacheFor(lang: string) {
  let m = mem.get(lang);
  if (!m) {
    m = new Map();
    try {
      const j = JSON.parse(localStorage.getItem(CK(lang)) ?? "{}") as Record<string, string>;
      for (const [k, v] of Object.entries(j)) m.set(k, v);
    } catch {}
    mem.set(lang, m);
  }
  return m;
}
function persist(lang: string) {
  clearTimeout(saveT);
  saveT = window.setTimeout(() => {
    const m = cacheFor(lang);
    // keep the newest ~1500 strings
    const entries = [...m.entries()].slice(-1500);
    try {
      localStorage.setItem(CK(lang), JSON.stringify(Object.fromEntries(entries)));
    } catch {
      try {
        localStorage.setItem(CK(lang), JSON.stringify(Object.fromEntries(entries.slice(-400))));
      } catch {}
    }
  }, 800);
}
export function clearCache() {
  mem.clear();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("overeo.echo.cache.")) localStorage.removeItem(k);
  } catch {}
}

/* ------------------------- the browser's translator ------------------------- */

type BrowserTranslator = { translate: (t: string) => Promise<string> };
const devices = new Map<string, Promise<BrowserTranslator | null>>();

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/**
 * The browser's own translator — used only when the language is already
 * on the device. If it can be downloaded, the download starts quietly in
 * the background and the live brain helps in the meantime: she never waits.
 */
function deviceTranslator(lang: string): Promise<BrowserTranslator | null> {
  let p = devices.get(lang);
  if (p) return p;
  p = (async () => {
    try {
      const T = (globalThis as unknown as { Translator?: { availability: (o: object) => Promise<string>; create: (o: object) => Promise<BrowserTranslator> } }).Translator;
      if (!T) return null;
      const opts = { sourceLanguage: "en", targetLanguage: lang };
      const a = await within(T.availability(opts), 1500);
      if (a === "available") return await within(T.create(opts), 3000);
      if (a === "downloadable" || a === "downloading") {
        // start the download for next time; don't wait for it
        T.create(opts)
          .then((t) => devices.set(lang, Promise.resolve(t)))
          .catch(() => {});
      }
      return null;
    } catch {
      return null;
    }
  })();
  devices.set(lang, p);
  void p.then((t) => !t && setTimeout(() => devices.get(lang) === p && devices.delete(lang), 60_000));
  return p;
}

/* -------------------------------- live brain -------------------------------- */

let liveDownUntil = 0;
const REASONS: Record<string, string> = {
  "not-configured": "The live translator isn't connected here",
  quota: "The live translator has reached its limit for now",
  "rate-limited": "The live translator is busy",
  offline: "You're offline",
};

async function live(texts: string[], lang: string, signal?: AbortSignal): Promise<{ out: (string | null)[]; reason?: string }> {
  if (Date.now() < liveDownUntil) return { out: texts.map(() => null), reason: "upstream" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { out: texts.map(() => null), reason: "offline" };
  try {
    const res = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts, target: lang }), signal: signal ?? AbortSignal.timeout(25_000) });
    const j = (await res.json().catch(() => ({}))) as { out?: (string | null)[]; reason?: string };
    if (!res.ok || !Array.isArray(j.out) || j.out.length !== texts.length) {
      const reason = j.reason ?? (res.status === 404 ? "not-configured" : "upstream");
      liveDownUntil = Date.now() + (reason === "not-configured" ? 30 : reason === "quota" ? 10 : 2) * 60_000;
      return { out: texts.map(() => null), reason };
    }
    return { out: j.out };
  } catch (e) {
    if (signal?.aborted) throw e;
    liveDownUntil = Date.now() + 60_000;
    return { out: texts.map(() => null), reason: "unreachable" };
  }
}

export const reasonText = (r?: string) => (r ? (REASONS[r] ?? "Translation isn't available right now") : "");

/* ---------------------------------- main ---------------------------------- */

/** Translate many strings into `lang`. Same order, same length. */
export async function translateMany(texts: string[], lang: string, opts: { signal?: AbortSignal } = {}): Promise<Result> {
  const out = texts.slice();
  if (!langByCode(lang) || !texts.length) return { out, engine: null, missed: 0 };
  const cache = cacheFor(lang);
  let engine: Engine | null = null;
  const todo: number[] = [];
  texts.forEach((t, i) => {
    const hit = cache.get(t);
    if (hit !== undefined) {
      out[i] = hit;
      engine ??= "cache";
    } else todo.push(i);
  });
  if (!todo.length) return { out, engine, missed: 0 };

  // 2. on the device
  const dev = await deviceTranslator(lang);
  let rest = todo;
  if (dev) {
    rest = [];
    for (const i of todo) {
      if (opts.signal?.aborted) break;
      try {
        const r = await within(dev.translate(texts[i]), 5000);
        if (r && safeTranslation(texts[i], r)) {
          out[i] = r;
          cache.set(texts[i], r);
          engine = "device";
        } else rest.push(i);
      } catch {
        rest.push(i);
      }
    }
  }

  // 3. the live brain, in small batches
  let reason: string | undefined;
  let missed = 0;
  for (let k = 0; k < rest.length; ) {
    const batch: number[] = [];
    let chars = 0;
    while (k < rest.length && batch.length < 40 && chars + texts[rest[k]].length < 6000) {
      chars += texts[rest[k]].length;
      batch.push(rest[k++]);
    }
    if (!batch.length) batch.push(rest[k++]); // one very long piece
    const r = await live(batch.map((i) => texts[i].slice(0, 4000)), lang, opts.signal);
    reason ??= r.reason;
    batch.forEach((i, j) => {
      const t = r.out[j];
      if (t && safeTranslation(texts[i], t)) {
        out[i] = t;
        cache.set(texts[i], t);
        engine = engine === "device" ? "device" : "live";
      } else missed++;
    });
    if (r.reason) {
      missed += rest.length - k;
      break;
    }
  }
  persist(lang);
  return { out, engine, missed, reason };
}

export async function translateOne(text: string, lang: string) {
  const r = await translateMany([text], lang);
  return { text: r.out[0], ok: r.missed === 0 && r.engine !== null, engine: r.engine, reason: r.reason };
}
