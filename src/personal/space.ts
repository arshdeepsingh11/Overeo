import { useRef, useSyncExternalStore } from "react";
import { load, save, loadMeta, saveMeta, wipe, putFile } from "./db";
import { buildSampleSpace, MAYA_ACCOUNT } from "./sample";
import { defaultAgents } from "./agents";
import { DEFAULT_PREFS } from "./i18n";
import {
  SCHEMA_VERSION,
  type Account,
  type AgentId,
  type AgentSettings,
  type AnyRecord,
  type DiaryEntry,
  type MeasurementType,
  type MemoryItem,
  type MemoryOverride,
  type Prefs,
  type Reminder,
  type SpaceMode,
  type Suggestion,
  type ValueMap,
} from "./types";

/* =====================================================================
   Her space — the reactive personal store.

   One woman's records, agents, inbox, diary, reminders and memory, for
   the namespace currently showing ("sample" = Maya, or her own). Every
   write goes through the namespaced db, so the two never mix.
   ===================================================================== */

export interface MindMemory {
  topics: Record<string, number>;
  votes: Record<string, { up: number; down: number }>;
}

export interface SpaceState {
  ready: boolean;
  mode: SpaceMode;
  ns: string;
  /** the profile that's open on this device (null until she creates one) */
  own: Account | null;
  /** every profile on this device — hers, family profiles, signed-in ones */
  profiles: Account[];
  /** the account whose data is showing */
  account: Account | null;
  records: AnyRecord[];
  agents: Record<AgentId, AgentSettings>;
  inbox: Suggestion[];
  diary: DiaryEntry[];
  reminders: Reminder[];
  overrides: MemoryOverride[];
  told: MemoryItem[];
  feedback: Record<string, number>;
  /** what OVEREO Mind has learned from how she uses it: topics she asks about, answers she found (un)helpful */
  mind: MindMemory;
  prefs: Prefs;
  locked: boolean;
}

const DEVICE = "device";

let state: SpaceState = {
  ready: false,
  mode: "sample",
  ns: "sample",
  own: null,
  profiles: [],
  account: null,
  records: [],
  agents: defaultAgents(),
  inbox: [],
  diary: [],
  reminders: [],
  overrides: [],
  told: [],
  feedback: {},
  mind: { topics: {}, votes: {} },
  prefs: DEFAULT_PREFS,
  locked: false,
};

const subs = new Set<() => void>();
export const space = {
  get: () => state,
  set(p: Partial<SpaceState>) {
    state = { ...state, ...p };
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => void subs.delete(f);
  },
};

export function useSpace<T>(sel: (s: SpaceState) => T): T {
  const last = useRef<{ s: SpaceState; v: T } | null>(null);
  const get = () => {
    const s = space.get();
    if (last.current?.s === s) return last.current.v;
    const v = sel(s);
    last.current = { s, v };
    return v;
  };
  return useSyncExternalStore(space.subscribe, get, get);
}

export const newId = (p: string) =>
  `${p}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 15)}`;

const realNs = (accountId: string) => `real-${accountId}`;

/* ------------------------------ lifecycle ------------------------------ */

/** Load the device state once, on the client. */
export function initSpace() {
  if (state.ready) return;
  const meta = loadMeta();
  const prefs = { ...DEFAULT_PREFS, ...load<Partial<Prefs>>(DEVICE, "prefs", {}) };
  const profiles = loadProfiles(meta);
  const own = profiles.find((p) => p.id === meta.accountId) ?? profiles[0] ?? null;
  const mode: SpaceMode = own && meta.mode === "real" ? "real" : "sample";
  state = { ...state, prefs, own, profiles, locked: !!(own && prefs.lock) };
  openNamespace(mode);
}

function loadProfiles(meta = loadMeta()): Account[] {
  const ids = meta.profiles ?? (meta.accountId ? [meta.accountId] : []);
  return ids.map((id) => load<Account | null>(realNs(id), "account", null)).filter((a): a is Account => !!a);
}

function saveProfileList(profiles: Account[], active: string | null, mode: SpaceMode) {
  saveMeta({ ...loadMeta(), schemaVersion: SCHEMA_VERSION, profiles: profiles.map((p) => p.id), accountId: active, mode });
}

function openNamespace(mode: SpaceMode) {
  const own = state.own;
  const ns = mode === "real" && own ? realNs(own.id) : "sample";
  if (ns === "sample" && !load<AnyRecord[] | null>("sample", "records", null)) seedSample();
  const account = ns === "sample" ? MAYA_ACCOUNT : own;
  space.set({
    ready: true,
    mode: ns === "sample" ? "sample" : "real",
    ns,
    account,
    records: load<AnyRecord[]>(ns, "records", []),
    agents: { ...defaultAgents(), ...load<Partial<Record<AgentId, AgentSettings>>>(ns, "agents", {}) },
    inbox: load<Suggestion[]>(ns, "inbox", []),
    diary: load<DiaryEntry[]>(ns, "diary", []),
    reminders: load<Reminder[]>(ns, "reminders", []),
    // what she told OVEREO and what she asked it to forget/correct live together
    ...(() => {
      const mem = load<{ overrides?: MemoryOverride[]; told?: MemoryItem[] }>(ns, "memory", {});
      return { overrides: mem.overrides ?? [], told: mem.told ?? [] };
    })(),
    feedback: load<Record<string, number>>(ns, "feedback", {}),
    mind: { topics: {}, votes: {}, ...load<Partial<MindMemory>>(ns, "mind", {}) },
  });
  saveMeta({ ...loadMeta(), mode: state.mode, accountId: own?.id ?? null, profiles: state.profiles.map((p) => p.id) });
}

function seedSample() {
  const s = buildSampleSpace();
  save("sample", "records", s.records);
  save("sample", "reminders", s.reminders);
  save("sample", "diary", s.diary);
  save("sample", "inbox", []);
}

export function switchMode(mode: SpaceMode) {
  if (mode === "real" && !state.own) return;
  openNamespace(mode);
}

/** Erase Maya's sample and rebuild it. Never touches her own namespace. */
export function resetSample() {
  wipe("sample");
  seedSample();
  if (state.mode === "sample") openNamespace("sample");
}

/* ------------------------------- account ------------------------------- */

/** Create a profile and open it. `id` is given for profiles that live in the backend. */
export function createAccount(a: Omit<Account, "id" | "createdAt"> & { id?: string; createdAt?: string }, opts: { open?: boolean } = {}) {
  const account: Account = { ...a, id: a.id ?? newId("acc"), createdAt: a.createdAt ?? new Date().toISOString() };
  const ns = realNs(account.id);
  const existed = load<Account | null>(ns, "account", null);
  save(ns, "account", account);
  if (!existed) save(ns, "records", []);
  const profiles = [...state.profiles.filter((p) => p.id !== account.id), account];
  space.set({ profiles });
  if (opts.open === false) {
    saveProfileList(profiles, state.own?.id ?? null, state.mode);
    return account;
  }
  saveProfileList(profiles, account.id, "real");
  space.set({ own: account, locked: false });
  openNamespace("real");
  if (!existed) diary("you", account.relation && account.relation !== "self" ? `Created ${account.name}'s profile` : "Created your private space");
  return account;
}

/** Open another profile on this device. (Check her PIN first — see ProfileGate.) */
export function switchProfile(id: string) {
  const p = state.profiles.find((x) => x.id === id);
  if (!p) return;
  space.set({ own: p, locked: false });
  openNamespace("real");
}

export function updateAccount(patch: Partial<Account>) {
  if (!state.own) return;
  const own = { ...state.own, ...patch };
  save(realNs(own.id), "account", own);
  space.set({ own, account: state.mode === "real" ? own : state.account, profiles: state.profiles.map((p) => (p.id === own.id ? own : p)) });
}

/** Update any profile's details (e.g. from the backend) without opening it. */
export function saveProfile(a: Account) {
  save(realNs(a.id), "account", a);
  const profiles = state.profiles.some((p) => p.id === a.id) ? state.profiles.map((p) => (p.id === a.id ? a : p)) : [...state.profiles, a];
  space.set({ profiles, ...(state.own?.id === a.id ? { own: a, account: state.mode === "real" ? a : state.account } : {}) });
  saveProfileList(profiles, state.own?.id ?? null, state.mode);
}

/** Remove one profile and everything it holds from this device. */
export function removeProfile(id: string) {
  wipe(realNs(id));
  const profiles = state.profiles.filter((p) => p.id !== id);
  const wasOpen = state.own?.id === id;
  const next = wasOpen ? (profiles[0] ?? null) : state.own;
  space.set({ profiles, own: next, locked: false });
  saveProfileList(profiles, next?.id ?? null, next ? state.mode : "sample");
  if (wasOpen) openNamespace(next ? "real" : "sample");
}

/** Leave her space on this device (shows the sample). Her data stays. */
export function signOut() {
  saveMeta({ ...loadMeta(), accountId: null, mode: "sample" });
  space.set({ own: null, locked: false });
  openNamespace("sample");
}

/** Delete her space completely from this device. */
export function deleteMySpace() {
  if (!state.own) return;
  removeProfile(state.own.id);
  if (!state.profiles.length) {
    setPrefs({ lock: null });
    // forget the email sign-in and push address on this device too
    save(DEVICE, "auth", null);
    save(DEVICE, "push", null);
    signOut();
  }
}

/** Re-read the open profile from storage (after a sync brought new data). */
export function reloadOpenProfile() {
  if (state.mode === "real" && state.own) openNamespace("real");
}

export function exportMySpace() {
  const s = state;
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      account: s.account,
      records: s.records,
      reminders: s.reminders,
      diary: s.diary,
      agents: s.agents,
      memory: { overrides: s.overrides, told: s.told },
      mind: s.mind,
    },
    null,
    2,
  );
}

/* ------------------------------- records ------------------------------- */

function persistRecords(records: AnyRecord[]) {
  save(state.ns, "records", records);
  space.set({ records });
}

export function addRecord<K extends MeasurementType>(
  type: K,
  value: ValueMap[K],
  opts: { observedAt?: string; origin?: "manual" | "uploaded_document"; documentId?: string; confirmed?: boolean } = {},
) {
  const now = new Date().toISOString();
  const origin = opts.origin ?? "manual";
  const rec = {
    id: newId("rec"),
    scope: { mode: state.mode, namespaceId: state.ns },
    type,
    value,
    observedAt: opts.observedAt ?? now,
    createdAt: now,
    updatedAt: now,
    source: { origin, label: origin === "manual" ? "You entered this" : "From your uploaded document", documentId: opts.documentId },
    confirmationStatus: opts.confirmed === false ? "unconfirmed" : "confirmed",
    status: "active",
    history: [{ revisionNumber: 1, changedAt: now, changedBy: "user", reason: "created" }],
    isSimulated: state.mode === "sample",
    schemaVersion: SCHEMA_VERSION,
  } as AnyRecord;
  persistRecords([...state.records, rec]);
  return rec;
}

/** Corrections create a revision — the old value stays traceable. */
export function correctRecord(id: string, value: unknown, observedAt?: string) {
  const now = new Date().toISOString();
  persistRecords(
    state.records.map((r) =>
      r.id !== id
        ? r
        : ({
            ...r,
            value,
            observedAt: observedAt ?? r.observedAt,
            updatedAt: now,
            confirmationStatus: r.confirmationStatus === "unconfirmed" ? "confirmed" : "corrected",
            history: [...r.history, { revisionNumber: r.history.length + 1, changedAt: now, changedBy: "user", reason: "user_correction", previousValue: r.value }],
          } as AnyRecord),
    ),
  );
}

export function confirmRecord(id: string, ok: boolean) {
  const now = new Date().toISOString();
  persistRecords(
    state.records.map((r) =>
      r.id !== id
        ? r
        : ({
            ...r,
            updatedAt: now,
            confirmationStatus: ok ? "confirmed" : "rejected",
            status: ok ? r.status : "archived",
            history: [...r.history, { revisionNumber: r.history.length + 1, changedAt: now, changedBy: "user", reason: ok ? "confirmation" : "rejection" }],
          } as AnyRecord),
    ),
  );
}

/** Remove from her active record (kept as archived for traceability). */
export function archiveRecord(id: string) {
  const now = new Date().toISOString();
  persistRecords(
    state.records.map((r) =>
      r.id !== id ? r : ({ ...r, status: "archived", updatedAt: now, history: [...r.history, { revisionNumber: r.history.length + 1, changedAt: now, changedBy: "user", reason: "archived" }] } as AnyRecord),
    ),
  );
}

export async function attachDocument(blob: Blob) {
  const id = newId("doc");
  await putFile(state.ns, id, blob);
  return id;
}

/** Only confirmed, active records may enter calculations. */
export const usable = (r: AnyRecord) => r.status === "active" && (r.confirmationStatus === "confirmed" || r.confirmationStatus === "corrected");

/* ------------------------- inbox, diary, reminders ------------------------- */

export function diary(agent: DiaryEntry["agent"], action: string, detail?: string, undo?: DiaryEntry["undo"]) {
  const e: DiaryEntry = { id: newId("d"), at: new Date().toISOString(), agent, action, detail, undo };
  const next = [e, ...state.diary].slice(0, 400);
  save(state.ns, "diary", next);
  space.set({ diary: next });
}

export function setInbox(inbox: Suggestion[]) {
  save(state.ns, "inbox", inbox);
  space.set({ inbox });
}

export function addReminder(r: Omit<Reminder, "id" | "done">) {
  const rem: Reminder = { ...r, id: newId("rem"), done: false };
  const next = [...state.reminders, rem].sort((a, b) => a.due.localeCompare(b.due));
  save(state.ns, "reminders", next);
  space.set({ reminders: next });
  return rem;
}

export function updateReminder(id: string, patch: Partial<Reminder>) {
  const next = state.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r));
  save(state.ns, "reminders", next);
  space.set({ reminders: next });
}

export function removeReminder(id: string) {
  const next = state.reminders.filter((r) => r.id !== id);
  save(state.ns, "reminders", next);
  space.set({ reminders: next });
}

export function bumpFeedback(key: string) {
  const feedback = { ...state.feedback, [key]: (state.feedback[key] ?? 0) + 1 };
  save(state.ns, "feedback", feedback);
  space.set({ feedback });
}

/** Mind learns what she cares about (topics) and which answers help her (votes). */
export function noteTopic(topic: string) {
  const mind = { ...state.mind, topics: { ...state.mind.topics, [topic]: (state.mind.topics[topic] ?? 0) + 1 } };
  save(state.ns, "mind", mind);
  space.set({ mind });
}

export function voteAnswer(topic: string, up: boolean) {
  const v = state.mind.votes[topic] ?? { up: 0, down: 0 };
  const mind = { ...state.mind, votes: { ...state.mind.votes, [topic]: up ? { ...v, up: v.up + 1 } : { ...v, down: v.down + 1 } } };
  save(state.ns, "mind", mind);
  space.set({ mind });
}

/* -------------------------------- agents -------------------------------- */

export function setAgent(id: AgentId, patch: Partial<AgentSettings>) {
  const agents = { ...state.agents, [id]: { ...state.agents[id], ...patch } };
  save(state.ns, "agents", agents);
  space.set({ agents });
  diary("you", patch.enabled === false ? `Paused the ${id} agent` : patch.enabled ? `Switched on the ${id} agent` : `Updated the ${id} agent's settings`);
}

/* -------------------------------- memory -------------------------------- */

function persistMemory(overrides: MemoryOverride[], told: MemoryItem[]) {
  save(state.ns, "memory", { overrides, told });
  space.set({ overrides, told });
}

export function forgetMemory(id: string) {
  persistMemory([...state.overrides.filter((o) => o.id !== id), { id, action: "forget", at: new Date().toISOString() }], state.told.filter((t) => t.id !== id));
  diary("you", "Asked OVEREO to forget something it had learned");
}

export function correctMemory(id: string, text: string) {
  persistMemory([...state.overrides.filter((o) => o.id !== id), { id, action: "correct", text, at: new Date().toISOString() }], state.told);
  diary("you", "Corrected something OVEREO had learned", text);
}

export function tellMemory(text: string, area: MemoryItem["area"] = "preferences") {
  const item: MemoryItem = { id: newId("told"), area, text, confidence: 1, evidence: "You told OVEREO", kind: "told" };
  persistMemory(state.overrides, [...state.told, item]);
  diary("you", "Told OVEREO something about you", text);
}

/* -------------------------------- prefs -------------------------------- */

export function setPrefs(patch: Partial<Prefs>) {
  const prefs = { ...state.prefs, ...patch };
  save(DEVICE, "prefs", prefs);
  space.set({ prefs });
}

export function setLocked(locked: boolean) {
  space.set({ locked });
}
