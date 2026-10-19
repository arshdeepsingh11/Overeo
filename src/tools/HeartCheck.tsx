"use client";

import { useState } from "react";
import { useStore, updateProfile, saveToolResult } from "../core/store";
import { useDerived } from "../core/derived";
import { narrateProfileChange } from "../core/insights";
import { mean } from "../core/rng";
import { Callout } from "../ui/Page";
import { ToolFrame, Field, Toggle, ResultCard } from "./ToolKit";

/* ------------------------------------------------------------------ *
 * Heart check — red flags first (they bypass everything), then the
 * women-specific risk enhancers most calculators leave out (pregnancy
 * complications, early menopause, PCOS, autoimmune disease) alongside
 * the classic ones. It doesn't compute a 10-year score — that needs
 * lipids and blood pressure — it tells you what to measure and why.
 * ------------------------------------------------------------------ */

const RED = [
  { id: "chestPain", label: "Chest pressure, tightness or pain" },
  { id: "breathless", label: "Breathlessness" },
  { id: "jawPain", label: "Pain in jaw, neck, back or arm" },
] as const;

const WOMEN = [
  { id: "preeclampsia", label: "Preeclampsia or high blood pressure in pregnancy" },
  { id: "gdm", label: "Gestational diabetes" },
  { id: "preterm", label: "Preterm birth or a small-for-age baby" },
  { id: "earlyMeno", label: "Menopause before 40" },
  { id: "pcos", label: "PCOS" },
  { id: "autoimmune", label: "Lupus, rheumatoid arthritis or psoriasis" },
];
const CLASSIC = [
  { id: "bp", label: "Diagnosed high blood pressure" },
  { id: "diabetes", label: "Diabetes" },
  { id: "smoke", label: "Smoking or vaping nicotine" },
  { id: "chol", label: "High cholesterol" },
  { id: "family", label: "Heart disease in a parent or sibling before 55 (men) / 65 (women)" },
  { id: "inactive", label: "Mostly inactive" },
];

export function HeartCheck() {
  const d = useDerived();
  const flags = useStore((s) => s.profile.redFlags);
  const pcosTool = useStore((s) => s.toolResults.pcos);
  const [w, setW] = useState<string[]>(pcosTool?.level === "high" ? ["pcos"] : []);
  const [c, setC] = useState<string[]>([]);
  const [shown, setShown] = useState(false);
  const urgent = flags.chestPain && (flags.breathless || flags.jawPain);
  const logs = d.profile.logs;
  const rhrNow = Math.round(mean(logs.slice(-30).map((l) => l.rhr)));
  const rhrThen = Math.round(mean(logs.slice(0, 30).map((l) => l.rhr)));

  const setFlag = (id: (typeof RED)[number]["id"], on: boolean) => {
    updateProfile((p) => ({ ...p, redFlags: { ...p.redFlags, [id]: on } }));
    narrateProfileChange(on ? "Heart symptom logged" : "Heart symptom cleared");
  };

  const run = () => {
    setShown(true);
    const n = w.length + c.length;
    const level = urgent ? "urgent" : n >= 3 ? "high" : n >= 1 ? "moderate" : "low";
    saveToolResult({
      tool: "heart",
      title: "Heart check",
      summary: urgent ? "Red-flag symptoms logged." : `${w.length} women-specific and ${c.length} classic risk factor${c.length === 1 ? "" : "s"}.`,
      level,
      facts: { women: w.length, classic: c.length, urgent },
    });
  };
  const n = w.length + c.length;

  return (
    <ToolFrame
      icon="heart"
      title="Women's heart check"
      intro="Two minutes. Red flags first, then the risk factors standard calculators often miss in women."
      source={{ label: "AHA/ACC prevention guidance & Go Red for Women", url: "https://www.goredforwomen.org/" }}
    >
      <Field label="Right now, or in the last hour — are you having:" hint="If yes to chest symptoms with either of the others, this becomes an emergency">
        <div className="toggle-row">
          {RED.map((r) => (
            <Toggle key={r.id} on={flags[r.id]} onChange={(on) => setFlag(r.id, on)}>
              {r.label}
            </Toggle>
          ))}
        </div>
      </Field>
      {urgent && (
        <Callout tone="alert" title="Call 911 now">
          These symptoms together can mean a heart attack — in women they're often subtler. Don't drive yourself. Chew an aspirin only if a dispatcher or clinician tells you to.
        </Callout>
      )}
      <div className="tool-grid two">
        <Field label="Women-specific risk enhancers">
          <div className="toggle-col">
            {WOMEN.map((x) => (
              <Toggle key={x.id} on={w.includes(x.id)} onChange={(on) => setW((a) => (on ? [...a, x.id] : a.filter((y) => y !== x.id)))}>
                {x.label}
              </Toggle>
            ))}
          </div>
        </Field>
        <Field label="Classic risk factors">
          <div className="toggle-col">
            {CLASSIC.map((x) => (
              <Toggle key={x.id} on={c.includes(x.id)} onChange={(on) => setC((a) => (on ? [...a, x.id] : a.filter((y) => y !== x.id)))}>
                {x.label}
              </Toggle>
            ))}
          </div>
        </Field>
      </div>
      <p className="faint small">
        From her wearable: resting heart rate {rhrThen} → {rhrNow} bpm over six months{rhrNow - rhrThen >= 2 ? " — a gentle rise worth watching alongside iron and sleep." : "."}
      </p>
      <div className="tool-foot">
        <button className="btn" onClick={run}>
          See my heart plan
        </button>
      </div>
      {shown && (
        <ResultCard
          level={urgent ? "urgent" : n >= 3 ? "high" : n >= 1 ? "moderate" : "low"}
          title={urgent ? "Emergency symptoms — act now" : n ? `${n} risk factor${n > 1 ? "s" : ""} to act on` : "No major risk factors reported"}
          summary={
            urgent
              ? "Call 911. Your dossier and the Advanced Cardiology team are notified for follow-up."
              : n
                ? "Women-specific enhancers like these are reasons to start prevention earlier — guidelines suggest a fuller assessment rather than waiting for age 40."
                : "Keep the basics: blood pressure yearly, a lipid panel from 40, and Lp(a) measured once."
          }
          points={
            urgent
              ? []
              : [
                  "Measure: blood pressure (home readings are best), lipid panel, HbA1c, and Lp(a) once",
                  w.includes("preeclampsia") || w.includes("gdm") ? "Pregnancy complications roughly double long-term heart risk — keep them in every record." : "",
                  w.includes("earlyMeno") ? "Early menopause is a recognised risk enhancer; discuss hormone therapy until the usual age of menopause." : "",
                  c.includes("smoke") ? "Stopping smoking is the single biggest change — support is available through NEYU." : "",
                ].filter(Boolean)
          }
          next={
            urgent
              ? [{ label: "Silent Signals", href: "/signals", icon: "radar" }]
              : [
                  { label: "Women's heart health", href: "/specialties/heart", icon: "heart" },
                  { label: "Tests to discuss", href: "/tests", icon: "flask" },
                ]
          }
          ask="Tell me about women's heart health"
          saved
        />
      )}
    </ToolFrame>
  );
}
