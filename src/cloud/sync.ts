"use client";

/* =====================================================================
   Sync between her device and the OVEREO backend.

   Offline-first: every change is saved on the device straight away
   (src/personal/db.ts). For a profile that belongs to a signed-in
   account, this engine then:
     - pushes what changed (about a second later, in one request)
     - pulls what changed elsewhere (when the profile opens, every
       minute while the app is visible, and when she comes back online)
   The newest edit wins. Nothing is ever pushed for the sample (Maya) or
   for profiles kept only on this device.
   ===================================================================== */

import { api, ApiError } from "./api";
import { cloud, toAccount, type CloudProfile } from "./account";
import { fileHooks, load, save, saveHooks, type Collection } from "../personal/db";
import { reloadOpenProfile, saveProfile, space } from "../personal/space";
import type { AnyRecord } from "../personal/types";

const ARRAYS = ["inbox", "diary", "reminders"] as const;
const SINGLES = ["memory", "feedback", "mind"] as const;
const WATCHED = new Set<Collection>(["records", "agents", ...ARRAYS, ...SINGLES]);

type Snapshot = { cursor: string | null; sent: Record<string, string> };
const snapKey = (ns: string) => `overeo.p1.${ns}.syncstate`;
function snap(ns: string): Snapshot {
  try {
    return JSON.parse(localStorage.getItem(snapKey(ns)) ?? "null") ?? { cursor: null, sent: {} };
  } catch {
    return { cursor: null, sent: {} };
  }
}
function putSnap(ns: string, s: Snapshot) {
  try {
    localStorage.setItem(snapKey(ns), JSON.stringify(s));
  } catch {}
}

/** quick fingerprint of an element (so unchanged things are never re-sent) */
function fp(v: unknown) {
  const s = JSON.stringify(v) ?? "";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

const profileOf = (ns: string) => {
  if (!ns.startsWith("real-")) return null;
  const id = ns.slice(5);
  const a = space.get().profiles.find((p) => p.id === id);
  return a?.cloud && cloud.get().status === "signed-in" && cloud.get().user?.id === a.cloud.userId ? id : null;
};

/* ---------------------------- what's on the device ---------------------------- */

type Rec = Omit<AnyRecord, "scope" | "isSimulated">;
interface Local {
  records: Map<string, Rec>;
  items: Map<string, { collection: string; id: string; data: unknown }>;
}

function readLocal(ns: string): Local {
  const records = new Map<string, Rec>();
  for (const r of load<AnyRecord[]>(ns, "records", [])) {
    const { scope: _s, isSimulated: _i, ...rest } = r;
    void _s;
    void _i;
    records.set(r.id, rest);
  }
  const items = new Map<string, { collection: string; id: string; data: unknown }>();
  for (const [id, data] of Object.entries(load<Record<string, unknown>>(ns, "agents", {}))) items.set(`agents:${id}`, { collection: "agents", id, data });
  for (const c of ARRAYS) for (const x of load<{ id: string }[]>(ns, c, [])) if (x?.id) items.set(`${c}:${x.id}`, { collection: c, id: x.id, data: x });
  for (const c of SINGLES) {
    const v = load<unknown>(ns, c, null);
    if (v !== null) items.set(`${c}:main`, { collection: c, id: "main", data: v });
  }
  return { records, items };
}

/* ----------------------------------- push ----------------------------------- */

const timers = new Map<string, number>();
const busy = new Set<string>();
let applying = false;

function schedule(ns: string, ms = 1200) {
  clearTimeout(timers.get(ns));
  timers.set(ns, window.setTimeout(() => void push(ns), ms));
}

export async function push(ns: string): Promise<boolean> {
  const pid = profileOf(ns);
  if (!pid) return false;
  if (busy.has(ns)) {
    schedule(ns, 800);
    return false;
  }
  busy.add(ns);
  try {
    const s = snap(ns);
    const local = readLocal(ns);
    const now = new Date().toISOString();
    const records: unknown[] = [];
    const items: unknown[] = [];
    const sent: Record<string, string> = {};
    for (const [id, r] of local.records) {
      const k = `r:${id}`;
      const h = fp(r);
      sent[k] = h;
      if (s.sent[k] !== h) records.push({ ...r, updatedAt: r.updatedAt ?? now });
    }
    for (const [key, it] of local.items) {
      const k = `i:${key}`;
      const h = fp(it.data);
      sent[k] = h;
      if (s.sent[k] !== h) items.push({ ...it, updatedAt: now });
    }
    for (const k of Object.keys(s.sent)) {
      if (sent[k]) continue;
      if (k.startsWith("r:")) {
        // a record that left the device: the backend keeps it, marked deleted
        const old = { id: k.slice(2), type: "weight", value: {}, observedAt: now, updatedAt: now, deleted: true };
        records.push(old);
      } else {
        const [collection, ...rest] = k.slice(2).split(":");
        items.push({ collection, id: rest.join(":"), data: null, updatedAt: now, deleted: true });
      }
    }
    if (!records.length && !items.length) return true;
    cloud.set({ sync: "syncing" });
    // large first uploads go in parts
    for (let i = 0; i < Math.max(records.length, items.length); i += 1000)
      await api("POST", `/profiles/${pid}/sync`, { records: records.slice(i, i + 1000), items: items.slice(i, i + 1000) }, { profileId: pid, timeout: 30_000 });
    putSnap(ns, { ...snap(ns), sent });
    cloud.set({ sync: "idle", lastSync: new Date().toISOString() });
    return true;
  } catch (e) {
    const err = e as ApiError;
    cloud.set({ sync: err.code === "offline" || err.code === "unreachable" ? "offline" : "error" });
    if (err.status === 401) cloud.set({ status: "signed-out" });
    return false;
  } finally {
    busy.delete(ns);
  }
}

/* ----------------------------------- pull ----------------------------------- */

interface Pulled {
  cursor: string;
  profile: CloudProfile;
  records: (Rec & { deleted: boolean })[];
  items: { collection: string; id: string; data: unknown; deleted: boolean }[];
}

export async function pull(ns: string): Promise<boolean> {
  const pid = profileOf(ns);
  if (!pid) return false;
  try {
    const s = snap(ns);
    cloud.set({ sync: "syncing" });
    const r = await api<Pulled>("GET", `/profiles/${pid}/sync${s.cursor ? `?since=${encodeURIComponent(s.cursor)}` : ""}`, undefined, { profileId: pid, timeout: 30_000 });
    const user = cloud.get().user;
    if (user) saveProfile(toAccount(r.profile, user, space.get().profiles.find((a) => a.id === pid)));
    const local = readLocal(ns);
    const sent = { ...s.sent };
    // things she changed here and hasn't sent yet stay as they are
    const pending = (k: string, v: unknown) => sent[k] !== undefined && fp(v) !== sent[k];
    let changed = false;

    const recs = new Map(load<AnyRecord[]>(ns, "records", []).map((x) => [x.id, x]));
    for (const x of r.records) {
      const k = `r:${x.id}`;
      const mine = local.records.get(x.id);
      if (mine && pending(k, mine)) continue;
      if (x.deleted) {
        if (recs.delete(x.id)) changed = true;
        delete sent[k];
        continue;
      }
      const { deleted: _d, ...rest } = x;
      void _d;
      const rec = { ...rest, observedAt: new Date(rest.observedAt).toISOString(), createdAt: new Date(rest.createdAt).toISOString(), updatedAt: new Date(rest.updatedAt).toISOString(), scope: { mode: "real", namespaceId: ns }, isSimulated: false } as AnyRecord;
      recs.set(x.id, rec);
      const { scope: _s, isSimulated: _i, ...bare } = rec;
      void _s;
      void _i;
      sent[k] = fp(bare);
      changed = true;
    }

    const cols: Record<string, unknown> = {};
    const get = (c: string) => (cols[c] ??= c === "agents" ? { ...load<Record<string, unknown>>(ns, "agents", {}) } : (ARRAYS as readonly string[]).includes(c) ? [...load<{ id: string }[]>(ns, c as Collection, [])] : load<unknown>(ns, c as Collection, null));
    for (const it of r.items) {
      if (!WATCHED.has(it.collection as Collection)) continue;
      const key = `${it.collection}:${it.id}`;
      const k = `i:${key}`;
      const mine = local.items.get(key);
      if (mine && pending(k, mine.data)) continue;
      changed = true;
      if (it.collection === "agents") {
        const o = get("agents") as Record<string, unknown>;
        if (it.deleted) delete o[it.id];
        else o[it.id] = it.data;
      } else if ((ARRAYS as readonly string[]).includes(it.collection)) {
        const arr = (get(it.collection) as { id: string }[]).filter((x) => x.id !== it.id);
        if (!it.deleted) arr.push(it.data as { id: string });
        cols[it.collection] = arr;
      } else cols[it.collection] = it.deleted ? null : it.data;
      if (it.deleted) delete sent[k];
      else sent[k] = fp(it.data);
    }

    if (changed) {
      applying = true;
      try {
        save(ns, "records", [...recs.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt)));
        for (const [c, v] of Object.entries(cols)) {
          let value = v;
          if (c === "diary") value = (v as { at: string }[]).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 400);
          if (c === "reminders") value = (v as { due: string }[]).sort((a, b) => a.due.localeCompare(b.due));
          save(ns, c as Collection, value);
        }
      } finally {
        applying = false;
      }
      if (space.get().ns === ns) reloadOpenProfile();
    }
    putSnap(ns, { cursor: new Date(r.cursor).toISOString(), sent });
    cloud.set({ sync: "idle", lastSync: new Date().toISOString() });
    return true;
  } catch (e) {
    const err = e as ApiError;
    cloud.set({ sync: err.code === "offline" || err.code === "unreachable" ? "offline" : "error" });
    if (err.status === 401) cloud.set({ status: "signed-out" });
    return false;
  }
}

/** Pull, then push: used when a profile opens and when she comes back online. */
export async function syncNow(ns = space.get().ns) {
  if (!profileOf(ns)) return false;
  const ok = await pull(ns);
  return (await push(ns)) && ok;
}

/** Copy a device-only space into a profile in her account (when she creates an account). */
export function moveLocalInto(fromId: string, toId: string) {
  const from = `real-${fromId}`;
  const to = `real-${toId}`;
  for (const c of ["records", "agents", ...ARRAYS, ...SINGLES] as Collection[]) {
    const v = load<unknown>(from, c, null);
    if (v === null) continue;
    save(to, c, c === "records" ? (v as AnyRecord[]).map((r) => ({ ...r, scope: { mode: "real", namespaceId: to } })) : v);
  }
}

/* ---------------------------------- files ---------------------------------- */

async function upload(ns: string, id: string, blob: Blob, tries = 0): Promise<void> {
  const pid = profileOf(ns);
  if (!pid) return;
  try {
    await api("POST", `/profiles/${pid}/files`, undefined, { profileId: pid, raw: blob, headers: { "content-type": blob.type || "application/octet-stream", "x-file-name": encodeURIComponent((blob as File).name ?? `${id}`), "x-client-id": id }, timeout: 120_000 });
  } catch (e) {
    const err = e as ApiError;
    if (tries < 3 && (err.code === "offline" || err.code === "unreachable")) setTimeout(() => void upload(ns, id, blob, tries + 1), 30_000 * (tries + 1));
  }
}

/* --------------------------------- chat log --------------------------------- */

/** Keep Ask SI and agent chats in her account (signed-in profiles only). */
export function logChat(conversationId: string, kind: "si" | "agent" | "team", title: string, messages: { id: string; role: "user" | "assistant"; agent?: string | null; text: string; meta?: Record<string, unknown> }[]) {
  const pid = profileOf(space.get().ns);
  if (!pid || !messages.length) return;
  void api("POST", `/profiles/${pid}/messages`, { conversationId, kind, title: title.slice(0, 200), messages: messages.map((m) => ({ ...m, text: m.text.slice(0, 20000) })) }, { profileId: pid }).catch(() => undefined);
}

/* ---------------------------------- start ---------------------------------- */

let started = false;
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  saveHooks.add((ns, c) => {
    if (applying || !WATCHED.has(c) || !profileOf(ns)) return;
    schedule(ns);
  });
  fileHooks.add((ns, id, blob) => void upload(ns, id, blob));
  // when a profile opens, bring it up to date
  let lastNs = "";
  space.subscribe(() => {
    const ns = space.get().ns;
    if (ns !== lastNs) {
      lastNs = ns;
      if (profileOf(ns)) void syncNow(ns);
    }
  });
  // once she's known to be signed in (each app start, and after logging in): catch up
  let was = cloud.get().status;
  cloud.subscribe(() => {
    const now = cloud.get().status;
    if (now === was) return;
    was = now;
    if (now === "signed-in" && profileOf(space.get().ns)) void syncNow();
  });
  addEventListener("online", () => void syncNow());
  setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, 60_000);
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") for (const ns of timers.keys()) void push(ns);
  });
}
