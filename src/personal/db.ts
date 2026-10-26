import { SCHEMA_VERSION } from "./types";

/* =====================================================================
   Local, namespaced persistence (offline-first).

   Every collection lives under   overeo.p1.<namespace>.<collection>
   so sample (Maya) and real (her own) data can never share a key, and
   "Reset sample" can never touch her data. Isolation is enforced here, in
   the data layer — not by a UI flag.

   Files (report photos/PDFs) go to IndexedDB, which can hold binary data.
   A backend can replace this module behind the same functions — see
   src/data/adapters.ts and docs/BACKEND.md.
   ===================================================================== */

const ROOT = "overeo.p1";
const META = `${ROOT}.meta`;

export type Collection = "records" | "account" | "agents" | "inbox" | "diary" | "reminders" | "memory" | "prefs" | "feedback" | "outbox";

export const nsKey = (ns: string, c: Collection) => `${ROOT}.${ns}.${c}`;

export function load<T>(ns: string, c: Collection, fallback: T): T {
  try {
    const raw = localStorage.getItem(nsKey(ns, c));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(ns: string, c: Collection, value: unknown) {
  try {
    localStorage.setItem(nsKey(ns, c), JSON.stringify(value));
  } catch {
    // storage full or blocked (private mode) — the app keeps working in memory
  }
}

/** Erase one namespace only. */
export function wipe(ns: string) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${ROOT}.${ns}.`))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  void idbClear(ns);
}

/* ---------------------------- device meta ---------------------------- */
export interface Meta {
  schemaVersion: number;
  /** the signed-in account on this device (local accounts until a backend exists) */
  accountId: string | null;
  /** which space is showing */
  mode: "sample" | "real";
}

export function loadMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META) ?? "null") as Meta | null;
    if (m) return migrate(m);
  } catch {}
  return { schemaVersion: SCHEMA_VERSION, accountId: null, mode: "sample" };
}

export function saveMeta(m: Meta) {
  try {
    localStorage.setItem(META, JSON.stringify(m));
  } catch {}
}

/** Schema migrations run once per upgrade. Add a step for every bump. */
function migrate(m: Meta): Meta {
  let v = m.schemaVersion ?? 0;
  if (v < 1) {
    // v0 → v1: first release of the personal record contract; nothing to move yet.
    v = 1;
  }
  const next = { ...m, schemaVersion: v };
  if (v !== m.schemaVersion) saveMeta(next);
  return next;
}

/* ------------------------------ files (IDB) ------------------------------ */
const DB = "overeo-files";

function idb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    if (typeof indexedDB === "undefined") return res(null);
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}

export async function putFile(ns: string, id: string, blob: Blob) {
  const db = await idb();
  if (!db) return false;
  return new Promise<boolean>((res) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, `${ns}/${id}`);
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
}

export async function getFile(ns: string, id: string): Promise<Blob | null> {
  const db = await idb();
  if (!db) return null;
  return new Promise((res) => {
    const r = db.transaction("files").objectStore("files").get(`${ns}/${id}`);
    r.onsuccess = () => res((r.result as Blob) ?? null);
    r.onerror = () => res(null);
  });
}

async function idbClear(ns: string) {
  const db = await idb();
  if (!db) return;
  const tx = db.transaction("files", "readwrite");
  const st = tx.objectStore("files");
  const r = st.openCursor();
  r.onsuccess = () => {
    const c = r.result;
    if (!c) return;
    if (String(c.key).startsWith(`${ns}/`)) c.delete();
    c.continue();
  };
}
