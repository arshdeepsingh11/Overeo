import { useSyncExternalStore } from "react";
import { guessLang } from "./languages";

/* =====================================================================
   ECHO's settings — on/off, target language, whole-page mode.
   Kept on this device only (localStorage).
   ===================================================================== */

export interface EchoState {
  /** ECHO is available (the button shows, select-to-translate works) */
  on: boolean;
  lang: string;
  /** the whole page is shown translated */
  page: boolean;
  /** what ECHO is doing right now (not saved) */
  status: "idle" | "working" | "done" | "error";
  /** "device" = browser's own translator, "live" = live brain */
  engine: "device" | "live" | "cache" | null;
  note: string | null;
}

const KEY = "overeo.echo";
let state: EchoState = { on: false, lang: "es", page: false, status: "idle", engine: null, note: null };
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<EchoState> | null;
    if (j) state = { ...state, on: !!j.on, lang: typeof j.lang === "string" ? j.lang : guessLang(), page: !!j.page && !!j.on };
    else state = { ...state, lang: guessLang() };
  } catch {
    state = { ...state, lang: guessLang() };
  }
}

export const echo = {
  get(): EchoState {
    load();
    return state;
  },
  set(p: Partial<EchoState>) {
    load();
    state = { ...state, ...p };
    if (!state.on) state.page = false;
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: state.on, lang: state.lang, page: state.page }));
    } catch {}
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
};

const SERVER: EchoState = { on: false, lang: "es", page: false, status: "idle", engine: null, note: null };

export function useEcho<T>(pick: (s: EchoState) => T): T {
  return useSyncExternalStore(
    echo.subscribe,
    () => pick(echo.get()),
    () => pick(SERVER),
  );
}
