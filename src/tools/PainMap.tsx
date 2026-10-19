"use client";

import { useState } from "react";
import { useStore, saveToolResult } from "../core/store";
import { useDerived } from "../core/derived";
import { ToolFrame, Field, Toggle, Slider, ResultCard } from "./ToolKit";

/* ------------------------------------------------------------------ *
 * Pain map — where and when it hurts. Tap regions on the body, choose
 * when the pain comes, and the result is mapped to the symptom features
 * NICE NG73 lists as reasons to suspect endometriosis. It never says
 * "you have endometriosis" — it says what the pattern matches and who
 * should look at it.
 * ------------------------------------------------------------------ */

const REGIONS = [
  { id: "ul", label: "Upper left", d: "M60 70 h40 v40 h-40z" },
  { id: "uc", label: "Upper middle", d: "M100 70 h40 v40 h-40z" },
  { id: "ur", label: "Upper right", d: "M140 70 h40 v40 h-40z" },
  { id: "ll", label: "Lower left", d: "M60 110 h40 v40 h-40z" },
  { id: "pel", label: "Pelvis", d: "M100 110 h40 v48 h-40z" },
  { id: "lr", label: "Lower right", d: "M140 110 h40 v40 h-40z" },
  { id: "back", label: "Lower back", d: "M196 92 h28 v60 h-28z" },
];

const WHEN = [
  { id: "period", label: "With my period" },
  { id: "mid", label: "Mid-cycle" },
  { id: "sex", label: "During or after sex" },
  { id: "bowel", label: "With bowel movements" },
  { id: "bladder", label: "Passing urine" },
  { id: "always", label: "Most days" },
];

export function PainMap() {
  const d = useDerived();
  const saved = useStore((s) => s.toolResults.pain);
  const [zones, setZones] = useState<string[]>(["pel", "back"]);
  const [when, setWhen] = useState<string[]>([]);
  const [score, setScore] = useState(7);
  const [months6, setMonths6] = useState(true);
  const [daily, setDaily] = useState(true);
  const [ttc, setTtc] = useState(false);
  const [result, setResult] = useState<null | { level: "none" | "low" | "moderate" | "high"; features: string[] }>(null);

  const toggleZone = (id: string) => setZones((z) => (z.includes(id) ? z.filter((x) => x !== id) : [...z, id]));
  const fromLogs = () => {
    const endo = d.signals.find((s) => s.id === "endo");
    const w = ["period"];
    if (d.profile.logs.some((l) => l.bowelPain)) w.push("bowel");
    if (d.profile.logs.some((l) => l.dyspareunia)) w.push("sex");
    setWhen(w);
    setZones(["pel", "back", "ll"]);
    setScore(Math.max(...d.profile.logs.slice(-60).map((l) => l.pain)));
    setMonths6(true);
    setDaily(!!endo);
  };

  const run = () => {
    const f: string[] = [];
    if (zones.length && (when.includes("always") || when.includes("mid")) && months6) f.push("Chronic pelvic pain (6 months or more)");
    if (when.includes("period") && (daily || score >= 7)) f.push("Period-related pain that affects daily activities or quality of life");
    if (when.includes("sex")) f.push("Deep pain during or after sex");
    if (when.includes("bowel")) f.push("Period-related or cyclical bowel symptoms, such as painful bowel movements");
    if (when.includes("bladder")) f.push("Period-related or cyclical urinary symptoms, such as pain passing urine");
    if (ttc && f.length) f.push("Infertility together with one of the above");
    const level = f.length >= 3 ? "high" : f.length >= 1 ? "moderate" : zones.length ? "low" : "none";
    setResult({ level, features: f });
    saveToolResult({
      tool: "pain",
      title: "Pain map",
      summary: f.length ? `${f.length} of the features NICE lists for suspecting endometriosis (${zones.length} region${zones.length === 1 ? "" : "s"}, pain ${score}/10).` : `Pain in ${zones.length} region(s), ${score}/10, without the cyclical features linked to endometriosis.`,
      level,
      facts: { features: f.length, score, zones: zones.join(","), when: when.join(",") },
    });
  };

  return (
    <ToolFrame
      icon="target"
      title="Pain map"
      intro="Tap where it hurts and say when. Two minutes, and it turns a hard-to-describe pain into something a clinician can act on."
      source={{ label: "NICE NG73 — Endometriosis", url: "https://www.nice.org.uk/guidance/ng73" }}
    >
      <div className="pain-grid">
        <div className="pain-body" data-noswipe>
          <svg viewBox="0 0 240 200" role="group" aria-label="Body map">
            <path className="pain-outline" d="M120 18c-18 0-28 12-28 28 0 10 4 16 8 20-26 6-42 20-44 44l-2 50c0 14 10 26 24 30h84c14-4 24-16 24-30l-2-50c-2-24-18-38-44-44 4-4 8-10 8-20 0-16-10-28-28-28z" />
            {REGIONS.map((r) => (
              <path
                key={r.id}
                d={r.d}
                className={`pain-zone ${zones.includes(r.id) ? "on" : ""}`}
                style={{ ["--a" as string]: zones.includes(r.id) ? score / 10 : 0 }}
                role="checkbox"
                aria-checked={zones.includes(r.id)}
                aria-label={r.label}
                tabIndex={0}
                onClick={() => toggleZone(r.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleZone(r.id))}
              />
            ))}
            <text x="210" y="168" className="pain-label">
              back
            </text>
          </svg>
          <span className="faint small">{zones.length ? REGIONS.filter((r) => zones.includes(r.id)).map((r) => r.label).join(" · ") : "Tap a region"}</span>
        </div>
        <div className="tool-grid">
          <Field label="When does it come?" hint="Pick all that fit">
            <div className="toggle-row">
              {WHEN.map((w) => (
                <Toggle key={w.id} on={when.includes(w.id)} onChange={(on) => setWhen((x) => (on ? [...x, w.id] : x.filter((y) => y !== w.id)))}>
                  {w.label}
                </Toggle>
              ))}
            </div>
          </Field>
          <Field label="How bad, at its worst?">
            <Slider value={score} min={0} max={10} onChange={setScore} label="Worst pain" fmt={(v) => `${v}/10`} />
          </Field>
          <Field label="Also">
            <div className="toggle-row">
              <Toggle on={months6} onChange={setMonths6}>
                Going on 6+ months
              </Toggle>
              <Toggle on={daily} onChange={setDaily}>
                Stops me doing normal things
              </Toggle>
              <Toggle on={ttc} onChange={setTtc}>
                Trying to conceive 12+ months
              </Toggle>
            </div>
          </Field>
        </div>
      </div>
      <div className="tool-foot">
        <button className="btn" onClick={run}>
          Map my pain
        </button>
        <button className="btn ghost sm" onClick={fromLogs}>
          Pre-fill from my logs
        </button>
        {saved && !result && <span className="faint small">Last result: {saved.summary}</span>}
      </div>
      {result && (
        <ResultCard
          level={result.level}
          title={result.features.length ? `Matches ${result.features.length} guideline feature${result.features.length > 1 ? "s" : ""}` : "No cyclical pattern matched"}
          summary={
            result.features.length
              ? "These are the symptoms UK guidance lists as reasons to suspect endometriosis and start assessment — not a diagnosis. Symptoms alone are enough to begin treatment and imaging."
              : "Pain without these cyclical features still deserves attention if it's affecting you — a NEYU clinician can look at other causes."
          }
          points={result.features}
          next={[
            { label: "Menstrual health", href: "/specialties/menstrual-health", icon: "drop" },
            { label: "Tests to discuss", href: "/tests", icon: "flask" },
            { label: "Plan a visit", href: "/care?tab=visit", icon: "users" },
          ]}
          ask="Is this endometriosis?"
          saved
        />
      )}
    </ToolFrame>
  );
}
