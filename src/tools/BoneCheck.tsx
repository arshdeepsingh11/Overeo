"use client";

import { useState } from "react";
import { useStore, saveToolResult } from "../core/store";
import { ToolFrame, Field, Toggle, ResultCard } from "./ToolKit";

/* ------------------------------------------------------------------ *
 * Bone check — the clinical risk factors fracture tools such as FRAX
 * use, plus women-specific ones (early menopause, missed periods).
 * It doesn't compute FRAX (that needs the official calculator); it
 * tells you whether a bone-density scan is recommended yet and what
 * builds bone in the meantime.
 * ------------------------------------------------------------------ */

const FACTORS = [
  { id: "fracture", label: "Broke a bone from a minor fall after 40", w: 2 },
  { id: "parentHip", label: "A parent broke a hip", w: 1 },
  { id: "steroids", label: "Steroid tablets for 3+ months", w: 2 },
  { id: "earlyMeno", label: "Menopause before 45", w: 2 },
  { id: "amenorrhea", label: "Periods stopped for 3+ months (not pregnancy)", w: 1 },
  { id: "lowWeight", label: "Low body weight (BMI under 20)", w: 1 },
  { id: "smoke", label: "Current smoker", w: 1 },
  { id: "alcohol", label: "3 or more alcoholic drinks a day", w: 1 },
  { id: "ra", label: "Rheumatoid arthritis", w: 1 },
  { id: "malabsorption", label: "Coeliac disease or other malabsorption", w: 1 },
  { id: "ai", label: "Aromatase inhibitors or other bone-thinning medicines", w: 2 },
];

export function BoneCheck() {
  const age = useStore((s) => s.profile.age);
  const [f, setF] = useState<string[]>([]);
  const [shown, setShown] = useState(false);
  const weight = FACTORS.filter((x) => f.includes(x.id)).reduce((a, x) => a + x.w, 0);
  const dxa = age >= 65 || weight >= 2;
  const level = dxa ? "high" : weight >= 1 ? "moderate" : "low";

  const run = () => {
    setShown(true);
    saveToolResult({
      tool: "bone",
      title: "Bone check",
      summary: dxa ? `Bone density scan worth discussing (${f.length} risk factor${f.length === 1 ? "" : "s"}${age >= 65 ? ", age 65+" : ""}).` : `${f.length} risk factor${f.length === 1 ? "" : "s"} — no scan needed yet.`,
      level,
      facts: { factors: f.length, weight, dxa },
    });
  };

  return (
    <ToolFrame
      icon="shield"
      title="Bone check"
      intro={`At ${age}, you're near peak bone mass. This checks whether a scan is recommended yet — and what protects bone for the decades ahead.`}
      source={{ label: "Osteoporosis Canada & FRAX risk factors", url: "https://osteoporosis.ca/" }}
    >
      <Field label="Do any of these apply?">
        <div className="toggle-col cols">
          {FACTORS.map((x) => (
            <Toggle key={x.id} on={f.includes(x.id)} onChange={(on) => setF((a) => (on ? [...a, x.id] : a.filter((y) => y !== x.id)))}>
              {x.label}
            </Toggle>
          ))}
        </div>
      </Field>
      <div className="tool-foot">
        <button className="btn" onClick={run}>
          Check my bones
        </button>
      </div>
      {shown && (
        <ResultCard
          level={level}
          title={dxa ? "Discuss a bone density (DXA) scan" : "No scan needed yet — build bone now"}
          summary={
            dxa
              ? "With these risk factors, guidance supports measuring bone density now rather than waiting for 65. Your clinician may also use FRAX to estimate 10-year fracture risk."
              : "Screening is generally recommended from 65, or earlier with risk factors. The years before menopause are when you can bank the most bone."
          }
          points={[
            "Strength or impact training at least twice a week",
            "Protein at every meal; calcium mainly from food (about 1,000 mg a day before 50)",
            "Vitamin D 400–1,000 IU daily in Canada for most adults — no routine blood test needed",
            f.includes("amenorrhea") ? "Missed periods lower estrogen, which protects bone — worth investigating on their own." : "",
          ].filter(Boolean)}
          next={[
            { label: "Bone & metabolic", href: "/specialties/bone", icon: "shield" },
            { label: "Future Self", href: "/future", icon: "trend" },
          ]}
          ask="When should she get a bone density scan?"
          saved
        />
      )}
    </ToolFrame>
  );
}
