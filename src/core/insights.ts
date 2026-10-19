import { store, pushInsight } from "./store";
import { derive } from "./derived";
import { PHASE_META } from "./engines/forecast";
import { levelLabel } from "./engines/signals";
import { fmtDate } from "./rng";
import { recommend } from "./engines/recommend";
import { specialtyBySlug } from "../content/specialties";

/* ------------------------------------------------------------------ *
 * Live insights — Overeo SI narrates what you're looking at, using the
 * same derived data the charts use. Fires on section change and on
 * profile edits, so the panel always reflects the current state.
 * ------------------------------------------------------------------ */

type Gen = () => { text: string; tag: string; tone?: "info" | "signal" | "good" | "alert" } | null;

function gens(): Record<string, Gen> {
  const s = store.get();
  const d = derive(s.profile, s.levers);
  const top = d.signals[0];
  return {
    hero: () => ({
      text: `Good to see you. I'm reading ${d.profile.logs.length} days of ${d.profile.name}'s entries, ${d.profile.labs.length} lab series and her genome flags — together.`,
      tag: "Overeo SI",
    }),
    si: () => ({ text: "Press O anywhere and I'll open where you are. Hold O to talk.", tag: "Tip" }),
    gap: () => ({
      text: "Across 770 diseases, women were diagnosed later than men in a Danish population study. Patterns are how you close that gap.",
      tag: "Research",
    }),
    converge: () => ({
      text: `${d.profile.name}'s skin temperature rises ~0.3 °C after ovulation every cycle — I use that to date her phases even without a period log.`,
      tag: "Pattern",
    }),
    clock: () => ({
      text: `Reproductive markers ${d.clock.verdict} (${d.clock.markerAge} vs ${d.clock.calendarAge}). This is about timing and options — not a fertility verdict.`,
      tag: "Ovarian Clock",
      tone: d.clock.delta > 1.5 ? "signal" : "good",
    }),
    lens: () => ({
      text: `Today is cycle day ${d.today.cycleDay} (${PHASE_META[d.today.phase].label.toLowerCase()}). Next period predicted around ${fmtDate(d.today.nextStart)} — ±${Math.max(1, Math.round(d.today.sdLength))} days.`,
      tag: "Forecast",
    }),
    radar: () =>
      top
        ? {
            text: `${top.title}: ${levelLabel[top.level].toLowerCase()} (${Math.round(top.strength * 100)}% consistency). ${top.evidence[0]}.`,
            tag: "Silent signal",
            tone: top.level === "urgent" ? "alert" : "signal",
          }
        : null,
    futures: () => ({
      text:
        d.futures.gain > 0
          ? `With these changes the illustrative model keeps her healthspan index above 60 for ~${d.futures.gain} more years.`
          : "Switch on a lever to see two futures diverge. Strength training moves bone the most after 40.",
      tag: "Future self",
      tone: d.futures.gain > 0 ? "good" : "info",
    }),
    agent: () => ({ text: "I can book, prepare and follow up — but I always ask before acting.", tag: "Agent" }),
    ecosystem: () => ({
      text: "Every result routes to an in-house team: NEYU care, BioAro Labs, Advanced Cardiology, Biongevity, NEA, BioMynd.",
      tag: "Ecosystem",
    }),
    commons: () => ({
      text: "Contributors choose exactly what to share. Insights flow back to them first.",
      tag: "Science Commons",
    }),
    privacy: () => ({ text: "Genetic data stays off until you switch it on, one use at a time.", tag: "Privacy", tone: "good" }),
    app: () => ({ text: "The same intelligence, in your pocket — and on your wrist.", tag: "App" }),
    labs: () => ({ text: "Every period could become a painless data point. That's the 2035 lab.", tag: "Labs" }),
    join: () => ({ text: "No health data needed to join — just a name and an email.", tag: "Join" }),
    today: () => ({
      text: `Cycle day ${d.today.cycleDay}, ${PHASE_META[d.today.phase].label.toLowerCase()}. ${d.today.phase === "luteal" ? "Sleep usually dips for her in the next few days — I've moved wind-down earlier." : "A good window for harder training."}`,
      tag: "Today",
    }),
    specialties: () => ({ text: "Ten areas of women's care, each with its own team, tests and tools. Your signals point to Menstrual health first.", tag: "Specialties" }),
    tests: () => {
      const r = recommend(d, s.nav, s.toolResults);
      const now = r.recs.filter((x) => x.tier === "discuss");
      const skip = r.recs.filter((x) => x.tier === "done" || x.tier === "not-now").length;
      return {
        text: `${now.length} test${now.length === 1 ? "" : "s"} worth discussing now${now[0] ? ` — starting with ${now[0].test.name.split(" (")[0]}` : ""}. ${skip} others are already covered or wouldn't help yet, and I've said why.`,
        tag: "Test Navigator",
        tone: "good",
      };
    },
    tools: () => ({ text: "Each tool feeds the same profile — finish one and the Test Navigator and signals update.", tag: "Tools" }),
  };
}

let lastSection = "";
export function narrateSection(id: string) {
  if (id === lastSection) return;
  lastSection = id;
  if (id.startsWith("spec:")) {
    const sp = specialtyBySlug(id.slice(5));
    if (sp) pushInsight(`${sp.name}: ${sp.conditions.length} conditions, ${sp.tests.length} related tests, led by the ${sp.team[0] === "acc" ? "Advanced Cardiology" : sp.team[0] === "nea" ? "NEA" : sp.team[0] === "bio" ? "Biongevity" : sp.team[0] === "mynd" ? "BioMynd" : sp.team[0] === "gut" ? "BioGut" : "NEYU"} team.`, "Specialty");
    return;
  }
  const g = gens()[id];
  const r = g?.();
  if (r) pushInsight(r.text, r.tag, r.tone);
}

export function narrateProfileChange(what: string) {
  const s = store.get();
  const d = derive(s.profile, s.levers);
  const top = d.signals[0];
  pushInsight(
    `${what} — recalculated everything. Ovarian Clock ${d.clock.markerAge}; top signal: ${top ? top.title.toLowerCase() : "none"}.`,
    "Recomputed",
    "info",
  );
}
