"use client";

import { useState } from "react";
import { OrbitRing } from "../fx/OrbitRing";
import { ORGS, type Org } from "../core/ecosystem";
import { useDerived } from "../core/derived";
import { openSI } from "../core/store";
import { Orb } from "../si/Orb";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * Ecosystem — the in-house network OVEREO is the women's front door
 * to, orbiting one core. The card at the front is in focus, and the
 * panel shows how HER data would route there.
 * ------------------------------------------------------------------ */

export function Ecosystem({ compact = false }: { compact?: boolean }) {
  const d = useDerived();
  const [focus, setFocus] = useState<Org>(ORGS[0]);
  const route = routeFor(focus.id, d);
  return (
    <section id="ecosystem" className="ecosystem">
      {compact ? (
        <p className="wrap faint small eco-hint">
          <Icon name="hand" size={14} /> Drag or swipe the orbit, use ← → keys, or tap a team. Outside clinics only fill the gaps — like egg-freezing procedures.
        </p>
      ) : (
      <div className="wrap eco-head">
        <span className="eyebrow">
          <span className="dot" /> Ecosystem
        </span>
        <h2 className="title-lg">
          Not a referral app. <span className="serif grad-text">A whole team</span>, behind one front door.
        </h2>
        <p className="lede">Twelve teams around one core. Drag or swipe the orbit, use the arrow keys, or tap a team. Outside clinics only fill the gaps — like egg-freezing procedures.</p>
      </div>
      )}
      <OrbitRing
        items={ORGS}
        label="Ecosystem teams"
        onFocus={setFocus}
        center={
          <div className="eco-core">
            <Orb state="idle" size={110} />
            <b>OVEREO</b>
          </div>
        }
        render={(o, f) => (
          <div className={`glass eco-card ${f ? "focus holo" : ""}`} style={{ ["--h" as string]: o.hue }}>
            <span className="eco-ic">{o.name.slice(0, 1)}</span>
            <b>{o.name}</b>
            <span className="small muted">{o.role}</span>
          </div>
        )}
      />
      <div className="wrap">
        <div className="glass eco-panel holo" key={focus.id}>
          <div className="eco-panel-l">
            <span className="eco-ic big" style={{ ["--h" as string]: focus.hue }}>
              {focus.name.slice(0, 1)}
            </span>
            <div>
              <h3 className="title-sm">{focus.name}</h3>
              <span className="small muted">
                {focus.role} · {focus.city}
              </span>
              <p className="small" style={{ margin: "8px 0 0" }}>
                {focus.gives}
              </p>
            </div>
          </div>
          <div className="eco-panel-r">
            <span className="faint small">For {d.profile.name}, OVEREO would…</span>
            <p style={{ margin: "6px 0 12px" }}>{route}</p>
            <div className="sig-actions">
              <button className="btn ghost sm" onClick={() => openSI(`What does ${focus.name} do for her?`)}>
                <Icon name="sparkle" size={15} /> Ask SI
              </button>
              {focus.url && (
                <a className="btn ghost sm" href={focus.url} target="_blank" rel="noreferrer">
                  Visit <Icon name="arrow" size={15} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function routeFor(id: string, d: ReturnType<typeof useDerived>): string {
  const endo = d.signals.find((s) => s.id === "endo");
  const iron = d.signals.find((s) => s.id === "iron");
  switch (id) {
    case "neyu":
      return `book a virtual visit about her ${endo ? "cyclical pelvic pain pattern" : "symptoms"}, with the dossier attached, and arrange at-home blood collection.`;
    case "labs":
      return `run a repeat ferritin and CBC${iron ? ` (ferritin has fallen to ${d.profile.labs.find((l) => l.key === "ferritin")!.points.at(-1)!.value})` : ""}, and store AMH on the same assay next time.`;
    case "drugs":
      return "check any protocol against her CYP2C19 result and female-specific dosing before suggesting it.";
    case "bio":
      return `add her female layer — Ovarian Clock ${d.clock.markerAge}, cycle phases — to her Biongevity digital twin.`;
    case "acc":
      return "keep a cardio-metabolic baseline now, and route any heart symptoms here — fast.";
    case "nea":
      return "connect late-cycle breakouts and gut health to a hormone-aware skin plan.";
    case "emr":
      return "deliver every signal into the clinician's own record, not a separate portal.";
    case "mynd":
      return "time sleep support to the five days before her period, when her sleep drops.";
    case "sport":
      return "sync training load to her cycle and iron status.";
    case "gut":
      return "plan iron-rich, microbiome-aware meals with a registered dietitian.";
    case "bp":
      return "add remote blood-pressure monitoring if readings ever drift.";
    default:
      return "contribute her de-identified data — only if she opts in — to women-specific research.";
  }
}
