import type { IconName } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * The platform map. Every top-level area is a route with its own tabs;
 * some tabs hold sub-tabs (specialty conditions, test categories).
 *
 * Route ids double as "where you are" for Overeo SI, live insights and
 * the dock, so they keep the ids the original story used.
 * ------------------------------------------------------------------ */

export interface TabDef {
  id: string;
  label: string;
}

export interface RouteDef {
  id: string;
  path: string;
  label: string;
  group: "You" | "Her biology" | "Care" | "Science" | "OVEREO";
  icon: IconName;
  blurb: string;
  tabs: TabDef[];
}

export const ROUTES: RouteDef[] = [
  { id: "hero", path: "/", label: "Home", group: "OVEREO", icon: "home", blurb: "Your hub", tabs: [] },
  {
    id: "today",
    path: "/today",
    label: "Today",
    group: "You",
    icon: "calendar",
    blurb: "Your day, forecast and next steps",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "checkin", label: "Check-in" },
      { id: "insights", label: "Insights" },
      { id: "plan", label: "Plan" },
    ],
  },
  {
    id: "clock",
    path: "/clock",
    label: "Ovarian Clock",
    group: "Her biology",
    icon: "clock",
    blurb: "Reproductive timeline and markers",
    tabs: [
      { id: "clock", label: "Clock" },
      { id: "markers", label: "Markers" },
      { id: "planning", label: "Fertility planning" },
      { id: "learn", label: "Learn" },
    ],
  },
  {
    id: "lens",
    path: "/cycle",
    label: "Cycle",
    group: "Her biology",
    icon: "cycle",
    blurb: "Phases, forecast and patterns",
    tabs: [
      { id: "lens", label: "Lens" },
      { id: "forecast", label: "Forecast" },
      { id: "patterns", label: "Patterns" },
      { id: "learn", label: "Learn" },
    ],
  },
  {
    id: "radar",
    path: "/signals",
    label: "Silent Signals",
    group: "Her biology",
    icon: "radar",
    blurb: "Patterns medicine often misses",
    tabs: [
      { id: "radar", label: "Radar" },
      { id: "method", label: "How it works" },
      { id: "route", label: "Send to care" },
    ],
  },
  {
    id: "futures",
    path: "/future",
    label: "Future Self",
    group: "You",
    icon: "trend",
    blurb: "Two futures, and the levers between them",
    tabs: [
      { id: "simulator", label: "Simulator" },
      { id: "milestones", label: "Milestones" },
      { id: "menopause", label: "Menopause plan" },
    ],
  },
  {
    id: "specialties",
    path: "/specialties",
    label: "Specialties",
    group: "Care",
    icon: "layers",
    blurb: "Ten areas of women's care",
    tabs: [],
  },
  {
    id: "tests",
    path: "/tests",
    label: "Test Navigator",
    group: "Care",
    icon: "flask",
    blurb: "The right test, at the right time — or none",
    tabs: [
      { id: "navigator", label: "For you" },
      { id: "timing", label: "Timing" },
      { id: "catalog", label: "Catalog" },
      { id: "method", label: "How we recommend" },
    ],
  },
  {
    id: "tools",
    path: "/tools",
    label: "Tools",
    group: "You",
    icon: "target",
    blurb: "Guided check-ins and validated questionnaires",
    tabs: [
      { id: "checkin", label: "Check-in" },
      { id: "pain", label: "Pain map" },
      { id: "pcos", label: "PCOS criteria" },
      { id: "mrs", label: "Menopause scale" },
      { id: "heart", label: "Heart" },
      { id: "bone", label: "Bone" },
    ],
  },
  {
    id: "ecosystem",
    path: "/care",
    label: "Care team",
    group: "Care",
    icon: "users",
    blurb: "One front door to the whole ecosystem",
    tabs: [
      { id: "ecosystem", label: "Ecosystem" },
      { id: "visit", label: "Plan a visit" },
      { id: "agent", label: "Agent" },
      { id: "team", label: "Directory" },
    ],
  },
  {
    id: "commons",
    path: "/research",
    label: "Research",
    group: "Science",
    icon: "globe",
    blurb: "Science Commons and the evidence library",
    tabs: [
      { id: "commons", label: "Commons" },
      { id: "evidence", label: "Evidence library" },
      { id: "gap", label: "The gap" },
    ],
  },
  { id: "privacy", path: "/privacy", label: "Privacy", group: "Science", icon: "lock", blurb: "Consent, one use at a time", tabs: [{ id: "privacy", label: "Your data" }, { id: "controls", label: "Controls" }] },
  { id: "labs", path: "/labs", label: "OVEREO Labs", group: "Science", icon: "sparkle", blurb: "What's coming by 2035", tabs: [] },
  { id: "join", path: "/join", label: "Join", group: "OVEREO", icon: "user", blurb: "The app and early access", tabs: [{ id: "join", label: "Join" }, { id: "app", label: "The app" }] },
];

/** Legacy story ids (used by Overeo SI answers) → where they live now. */
const TARGETS: Record<string, { path: string; tab?: string; anchor?: string }> = {
  si: { path: "/", anchor: "si" },
  gap: { path: "/research", tab: "gap" },
  converge: { path: "/", anchor: "converge" },
  agent: { path: "/care", tab: "agent" },
  app: { path: "/join", tab: "app" },
  checkin: { path: "/today", tab: "checkin" },
  navigator: { path: "/tests", tab: "navigator" },
  timing: { path: "/tests", tab: "timing" },
  catalog: { path: "/tests", tab: "catalog" },
  visit: { path: "/care", tab: "visit" },
  evidence: { path: "/research", tab: "evidence" },
  pain: { path: "/tools", tab: "pain" },
  pcos: { path: "/tools", tab: "pcos" },
  mrs: { path: "/tools", tab: "mrs" },
  heart: { path: "/tools", tab: "heart" },
  bone: { path: "/tools", tab: "bone" },
  menopause: { path: "/future", tab: "menopause" },
  markers: { path: "/clock", tab: "markers" },
  planning: { path: "/clock", tab: "planning" },
  forecast: { path: "/cycle", tab: "forecast" },
};

export interface Target {
  path: string;
  tab?: string;
  anchor?: string;
}

/** Resolve "clock", "agent", "/specialties/heart-health", "tests:timing"… */
export function resolveTarget(id: string): Target {
  if (id.startsWith("/")) {
    const [p, tab] = id.split("?tab=");
    return { path: p, tab };
  }
  const [base, tab] = id.split(":");
  if (base === "spec") return { path: `/specialties/${tab}` };
  const r = ROUTES.find((x) => x.id === base);
  if (r) return { path: r.path, tab };
  return TARGETS[base] ?? { path: "/" };
}

export function hrefFor(t: Target) {
  return `${t.path}${t.tab ? `?tab=${t.tab}` : ""}${t.anchor ? `#${t.anchor}` : ""}`;
}

/** pathname → the id SI and the dock use. */
export function routeIdFor(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  const spec = p.match(/^\/specialties\/([^/]+)/);
  if (spec) return `spec:${spec[1]}`;
  const app = p.match(/^\/app(?:\/([^/]+))?/);
  if (app) return `app-${app[1] ?? "today"}`;
  return ROUTES.find((r) => r.path === p)?.id ?? "hero";
}

export function routeFor(id: string): RouteDef | undefined {
  return ROUTES.find((r) => r.id === id) ?? (id.startsWith("spec:") ? ROUTES.find((r) => r.id === "specialties") : undefined);
}

/* ---------------- navigation, registered by the app shell ---------------- */

type Nav = (href: string) => void;
let navigator: Nav = (href) => {
  if (typeof location !== "undefined") location.assign(href);
};
export function setNavigator(n: Nav) {
  navigator = n;
}
export function navigate(href: string) {
  navigator(href);
}

/** Ask the current page to switch tab without a navigation. */
export const TAB_EVENT = "overeo:tab";
export function selectTab(tab: string) {
  if (typeof window === "undefined") return;
  const url = new URL(location.href);
  url.searchParams.set("tab", tab);
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  dispatchEvent(new CustomEvent(TAB_EVENT, { detail: tab }));
}
