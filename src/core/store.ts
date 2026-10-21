import { useSyncExternalStore, useRef } from "react";
import { createPersona, type Profile } from "./persona";

/* ------------------------------------------------------------------ *
 * A tiny global store. Everything on the page reads from ONE profile,
 * so editing a value anywhere (Clock inputs, Space panels, Overeo SI
 * commands) re-computes every chart, signal and insight at once.
 * ------------------------------------------------------------------ */

export type ThemePref = "auto" | "light" | "dark";
export type Mood = "auto" | "calm" | "focus" | "energize" | "night";
export type Mode = "story" | "space" | "ar";

export interface Insight {
  id: string;
  text: string;
  tag: string;
  tone?: "info" | "signal" | "good" | "alert";
  at: number;
}

export interface Toast {
  id: string;
  text: string;
}

export interface AgentTask {
  id: string;
  title: string;
  owner: string;
  status: "proposed" | "approved" | "done";
  when: string;
}

export interface Levers {
  strength: boolean;
  sleep: boolean;
  iron: boolean;
  menoCare: boolean;
  nutrition: boolean;
}

/** A finished guided tool (Pain map, PCOS criteria, Menopause scale…). Feeds SI and the Test Navigator. */
export interface ToolResult {
  tool: string;
  title: string;
  summary: string;
  level: "none" | "low" | "moderate" | "high" | "urgent";
  /** machine-readable facts other engines can use */
  facts: Record<string, number | boolean | string>;
  at: number;
}

/** Answers to the Test Navigator questions. Pre-filled from her data, editable. */
export interface NavAnswers {
  goals: string[];
  symptoms: string[];
  stage: "cycling" | "trying" | "pregnant" | "postpartum" | "peri" | "post";
  contraception: "none" | "combined" | "progestin" | "hormonal-iud" | "copper-iud";
  family: string[];
}

export interface VisitRequest {
  id: string;
  specialty: string;
  team: string;
  kind: "virtual" | "clinic" | "home-draw";
  share: string[];
  at: number;
}

export interface State {
  themePref: ThemePref;
  theme: "light" | "dark";
  mood: Mood;
  mode: Mode;
  siOpen: boolean;
  siSeed: string | null;
  siListen: boolean;
  activeSection: string;
  profile: Profile;
  insights: Insight[];
  toasts: Toast[];
  levers: Levers;
  lensMetric: "rhr" | "temp" | "sleep" | "energy";
  lensView: "phase" | "raw";
  dossierCount: number;
  agentTasks: AgentTask[];
  collab: boolean;
  insightsOpen: boolean;
  reducedMotion: boolean;
  peers: number;
  toolResults: Record<string, ToolResult>;
  nav: NavAnswers;
  visits: VisitRequest[];
  /** false during server render and the first client render */
  hydrated: boolean;
}

const prefersDark = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

// The first render must be identical on the server and in the browser, so
// the initial state uses fixed defaults. Saved preferences, the visitor's
// clock and media queries are applied in hydrateStore() after mount.
let state: State = {
  themePref: "light",
  theme: "light",
  mood: "auto",
  mode: "story",
  siOpen: false,
  siSeed: null,
  siListen: false,
  activeSection: "hero",
  profile: createPersona(),
  insights: [],
  toasts: [],
  levers: { strength: false, sleep: false, iron: false, menoCare: false, nutrition: false },
  lensMetric: "temp",
  lensView: "phase",
  dossierCount: 0,
  agentTasks: [],
  collab: false,
  insightsOpen: false,
  reducedMotion: false,
  peers: 1,
  toolResults: {},
  nav: defaultNav(),
  visits: [],
  hydrated: false,
};

const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set(patch: Partial<State> | ((s: State) => Partial<State>)) {
    const p = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Subscribe to a slice of state. Re-renders only when the slice changes (shallow). */
export function useStore<T>(selector: (s: State) => T): T {
  const last = useRef<{ s: State; v: T } | null>(null);
  const get = () => {
    const s = store.get();
    if (last.current && last.current.s === s) return last.current.v;
    const v = selector(s);
    if (last.current && shallowEqual(last.current.v, v)) {
      last.current = { s, v: last.current.v };
      return last.current.v;
    }
    last.current = { s, v };
    return v;
  };
  return useSyncExternalStore(store.subscribe, get, get);
}

function shallowEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

/* ---------------------------- actions ---------------------------- */

/** v2: light is the default for everyone; only an explicit choice switches it. */
export const THEME_KEY = "overeo.theme.v2";

/** Call once on the client after the first render. */
export function hydrateStore() {
  if (state.hydrated) return;
  let pref: ThemePref = "light";
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "auto") pref = t;
  } catch {}
  const theme = pref === "dark" || (pref === "auto" && prefersDark()) ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  store.set({
    themePref: pref,
    theme,
    mood: read<Mood>("overeo.mood", "auto"),
    profile: createPersona(), // the visitor's own "today"
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    toolResults: read<Record<string, ToolResult>>("overeo.tools", {}),
    nav: read<NavAnswers | null>("overeo.nav", null) ?? defaultNav(),
    visits: read<VisitRequest[]>("overeo.visits", []),
    hydrated: true,
  });
}

/** What SI pre-fills from the profile, before she has answered anything. */
export function defaultNav(): NavAnswers {
  return {
    goals: ["fertility-timeline", "painful-periods", "energy"],
    symptoms: ["heavy-bleeding", "pelvic-pain", "fatigue", "luteal-sleep"],
    stage: "cycling",
    contraception: "none",
    family: [],
  };
}

const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export function saveToolResult(r: Omit<ToolResult, "at">) {
  const next = { ...store.get().toolResults, [r.tool]: { ...r, at: Date.now() } };
  save("overeo.tools", next);
  store.set({ toolResults: next });
}

export function clearToolResult(tool: string) {
  const next = { ...store.get().toolResults };
  delete next[tool];
  save("overeo.tools", next);
  store.set({ toolResults: next });
}

export function setNav(patch: Partial<NavAnswers>) {
  const nav = { ...store.get().nav, ...patch };
  save("overeo.nav", nav);
  store.set({ nav });
}

export function addVisit(v: Omit<VisitRequest, "id" | "at">) {
  const visits = [{ ...v, id: uid("v"), at: Date.now() }, ...store.get().visits].slice(0, 12);
  save("overeo.visits", visits);
  store.set({ visits });
}

/** Privacy controls: wipe everything this browser stored. */
export function forgetEverything() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("overeo."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  store.set({ toolResults: {}, nav: defaultNav(), visits: [], profile: createPersona(), levers: { strength: false, sleep: false, iron: false, menoCare: false, nutrition: false } });
}

let seq = 0;
export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {}
  const theme = pref === "dark" || (pref === "auto" && prefersDark()) ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  store.set({ themePref: pref, theme });
}

export function setMood(mood: Mood) {
  try {
    localStorage.setItem("overeo.mood", JSON.stringify(mood));
  } catch {}
  store.set({ mood });
}

export function toast(text: string) {
  const t = { id: uid("t"), text };
  store.set((s) => ({ toasts: [...s.toasts, t] }));
  setTimeout(() => store.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 3200);
}

export function pushInsight(text: string, tag: string, tone: Insight["tone"] = "info") {
  const s = store.get();
  if (s.insights[0]?.text === text) return;
  const ins: Insight = { id: uid("i"), text, tag, tone, at: Date.now() };
  store.set({ insights: [ins, ...s.insights].slice(0, 24) });
}

export function updateProfile(fn: (p: Profile) => Profile) {
  store.set((s) => ({ profile: fn(s.profile) }));
}

export function resetProfile() {
  store.set({ profile: createPersona() });
}

export function openSI(seed: string | null = null, listen = false) {
  store.set({ siOpen: true, siSeed: seed, siListen: listen });
}

export function closeSI() {
  store.set({ siOpen: false, siSeed: null, siListen: false });
}
