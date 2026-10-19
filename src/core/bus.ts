import { store, setTheme, setMood, toast, openSI, closeSI, type Mood } from "./store";
import { ROUTES, resolveTarget, hrefFor, navigate, selectTab, routeIdFor } from "./routes";
import { SPECIALTIES } from "../content/specialties";

/* ------------------------------------------------------------------ *
 * Command bus — the single way Overeo SI (and the Dock) act on the UI.
 * Anything SI can say "I'll do that" about is a command here.
 * ------------------------------------------------------------------ */

export type Command =
  | { type: "goto"; section: string }
  | { type: "theme"; value: "light" | "dark" | "auto" }
  | { type: "mood"; value: Mood }
  | { type: "mode"; value: "story" | "space" | "ar" }
  | { type: "print-dossier" }
  | { type: "run-agent" }
  | { type: "lever"; key: keyof ReturnType<typeof store.get>["levers"]; on: boolean }
  | { type: "lens"; metric: "rhr" | "temp" | "sleep" | "energy" }
  | { type: "si"; seed?: string }
  | { type: "toast"; text: string };

type Handler = (c: Command) => void;
type Owned = Handler & { handles?: Command["type"] };
const handlers = new Set<Owned>();

export function onCommand(h: Handler) {
  handlers.add(h);
  return () => {
    handlers.delete(h);
  };
}

/** Commands that need a page to be on screen wait for it (e.g. print-dossier after goto radar). */
// Kept in sessionStorage too, so a queued command survives a full page load.
const pending: Command[] = [];
const PENDING_KEY = "overeo.pending";
function savePending() {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending.map((c) => c.type)));
  } catch {}
}
export function takePending(type: Command["type"]) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "[]") as Command["type"][];
    for (const t of stored) if (!pending.some((c) => c.type === t)) pending.push({ type: t } as Command);
  } catch {}
  const i = pending.findIndex((c) => c.type === type);
  if (i < 0) return false;
  pending.splice(i, 1);
  savePending();
  return true;
}

function goto(id: string) {
  if (store.get().mode !== "story") store.set({ mode: "story" });
  closeSI();
  const t = resolveTarget(id);
  const here = typeof location !== "undefined" ? location.pathname.replace(/\/+$/, "") || "/" : "/";
  const smooth = store.get().reducedMotion ? "auto" : "smooth";
  if (here === t.path) {
    if (t.tab) selectTab(t.tab);
    requestAnimationFrame(() => {
      const el = t.anchor ? document.getElementById(t.anchor) : null;
      if (el) el.scrollIntoView({ behavior: smooth, block: "start" });
      else if (t.tab) document.querySelector(".tabbar")?.scrollIntoView({ behavior: smooth, block: "start" });
      else scrollTo({ top: 0, behavior: smooth });
    });
    return;
  }
  navigate(hrefFor(t));
}

export function run(c: Command) {
  switch (c.type) {
    case "goto":
      goto(c.section);
      break;
    case "theme":
      setTheme(c.value);
      break;
    case "mood":
      setMood(c.value);
      toast(`Mood lighting: ${c.value}`);
      break;
    case "mode":
      closeSI();
      store.set({ mode: c.value });
      break;
    case "lever":
      store.set((s) => ({ levers: { ...s.levers, [c.key]: c.on } }));
      break;
    case "lens":
      store.set({ lensMetric: c.metric });
      break;
    case "si":
      openSI(c.seed ?? null);
      break;
    case "toast":
      toast(c.text);
      break;
    case "print-dossier":
    case "run-agent":
      // if the page that handles it isn't mounted yet, keep it for when it is
      if (![...handlers].some((h) => (h as Owned).handles === c.type)) {
        pending.push(c);
        savePending();
        return;
      }
      break;
    default:
      break;
  }
  handlers.forEach((h) => h(c));
}

/** Register a handler that owns a command type (so it can claim queued ones on mount). */
export function ownCommand(type: Command["type"], h: Handler) {
  const tagged: Owned = Object.assign(
    (c: Command) => {
      if (c.type === type) h(c);
    },
    { handles: type },
  );
  handlers.add(tagged);
  if (takePending(type)) setTimeout(() => h({ type } as Command), 400);
  return () => {
    handlers.delete(tagged);
  };
}

/** Every place SI or the sheet can name. */
export const SECTIONS: { id: string; label: string; group: string }[] = ROUTES.map((r) => ({ id: r.id, label: r.label, group: r.group }));

const EXTRA_LABELS: Record<string, string> = {
  si: "Overeo SI",
  gap: "The gap",
  converge: "Convergence",
  agent: "the Agent",
  app: "the app",
  visit: "Plan a visit",
  evidence: "the Evidence library",
  checkin: "Check-in",
};

/** "clock" → "Ovarian Clock", "tests:timing" → "Test Navigator · Timing", "spec:heart" → "Women's heart health". */
export function labelFor(id: string): string {
  if (id.startsWith("spec:")) return SPECIALTIES.find((s) => `spec:${s.slug}` === id)?.name ?? "Specialties";
  const [base, tab] = id.split(":");
  const r = ROUTES.find((x) => x.id === base);
  if (r) {
    const t = tab && r.tabs.find((x) => x.id === tab);
    return t ? `${r.label} · ${t.label}` : r.label;
  }
  return EXTRA_LABELS[base] ?? "OVEREO";
}

export { routeIdFor };
