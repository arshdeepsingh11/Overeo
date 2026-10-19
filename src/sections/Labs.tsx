"use client";

import { FlowField } from "../fx/FlowField";
import { Text3DFlip } from "../ui/Motion";
import { Tilt } from "../ui/Controls";
import { MENSTRUAL_FACT, OVARY_FACT } from "../core/research";
import { openSI } from "../core/store";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * OVEREO Labs — the 2035 layer, honest about what's live, what's in
 * research and what's vision. Fluid particles: "every period becomes
 * data".
 * ------------------------------------------------------------------ */

const ROAD: { y: string; t: string; d: string; s: "live" | "research" | "vision" }[] = [
  { y: "2026", t: "Female intelligence layer", d: "Cycle-aware reading of every lab and wearable. Overeo SI.", s: "live" },
  { y: "2027", t: "Silent Signals, validated", d: "Pattern detection studied with in-house clinicians before clinical use.", s: "research" },
  { y: "2028", t: "Every period becomes data", d: "Needle-free monthly biomarkers from menstrual fluid, analysed by BioAro Labs.", s: "research" },
  { y: "2030", t: "Female Dose Lens", d: "Sex, pharmacogenomics and life stage in every medicine conversation.", s: "vision" },
  { y: "2032", t: "Ovarian longevity", d: "Trials that slow ovarian ageing to extend whole-body healthspan.", s: "vision" },
  { y: "2035", t: "Her biology, continuous", d: "A lifelong female twin that sees change before symptoms do.", s: "vision" },
];

export function Labs() {
  return (
    <section id="labs" className="section labs">
      <FlowField />
      <div className="wrap labs-in">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> OVEREO Labs · 2035
          </span>
          <h2 className="title-lg">
            <Text3DFlip text="Every period" /> <span className="serif grad-text">becomes data.</span>
          </h2>
          <p className="lede">Move your cursor through the field. {MENSTRUAL_FACT.text}</p>
          <p className="note">
            <a href={MENSTRUAL_FACT.url} target="_blank" rel="noreferrer">
              {MENSTRUAL_FACT.source}
            </a>{" "}
            ·{" "}
            <a href={OVARY_FACT.url} target="_blank" rel="noreferrer">
              {OVARY_FACT.source}
            </a>
          </p>
        </div>
        <div className="road">
          {ROAD.map((r) => (
            <Tilt key={r.y} max={6}>
              <div className={`glass road-card ${r.s}`}>
                <span className="road-y mono">{r.y}</span>
                <b>{r.t}</b>
                <span className="small muted">{r.d}</span>
                <span className={`badge ${r.s === "live" ? "good" : r.s === "research" ? "signal" : ""}`}>{r.s === "live" ? "In this prototype" : r.s === "research" ? "In research" : "Vision"}</span>
              </div>
            </Tilt>
          ))}
        </div>
        <button className="btn ghost" onClick={() => openSI("What is menstrual-fluid testing?")} style={{ marginTop: 28 }}>
          <Icon name="sparkle" size={16} /> Ask SI about the science
        </button>
      </div>
    </section>
  );
}
