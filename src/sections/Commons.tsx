"use client";

import { useState } from "react";
import { WorldMap } from "../fx/WorldMap";
import { NumberTicker, Reveal } from "../ui/Motion";
import { openSI, toast } from "../core/store";
import { HUBS } from "../core/ecosystem";
import { FACTS } from "../core/research";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * The Women's Science Commons — opt-in research. Contributions flow
 * to the hubs on a live world map (simulated), and findings flow back
 * to the women who contributed, first.
 * ------------------------------------------------------------------ */

export function Commons() {
  const [stats, setStats] = useState({ contributions: 18240, countries: 61 });
  const [joined, setJoined] = useState(false);
  const gap = FACTS.find((f) => f.id === "gap")!;
  return (
    <section id="commons" className="section commons">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> Women's Science Commons
          </span>
          <h2 className="title-lg">
            Medicine studied men. <span className="serif grad-text">Let's study her.</span>
          </h2>
          <p className="lede">
            With explicit opt-in, women can share de-identified data with BioAro research — see exactly which studies it powers — and get the findings back first. Women spend ~{gap.value}% more of their lives in poor health; data is how that changes.
          </p>
        </div>
        <div className="glass commons-map">
          <Reveal height={520} shape="panel">
            <WorldMap onStats={setStats} />
          </Reveal>
          <div className="commons-stats">
            <div className="glass-thin stat">
              <span className="stat-n tnum">
                <NumberTicker value={stats.contributions} startOnView={false} duration={0.6} />
              </span>
              <span className="faint small">consented contributions · simulated</span>
            </div>
            <div className="glass-thin stat">
              <span className="stat-n tnum">{stats.countries}</span>
              <span className="faint small">countries</span>
            </div>
            <div className="glass-thin stat">
              <span className="stat-n tnum">12</span>
              <span className="faint small">women-specific studies</span>
            </div>
          </div>
          <div className="commons-hubs small">
            {HUBS.map((h) => (
              <span key={h.name} className="chip">
                <Icon name="pin" size={13} /> {h.name} · {h.orgs}
              </span>
            ))}
            <span className="faint">Drag to pan · pinch, ⌘/Ctrl-scroll or double-click to zoom · hover a country</span>
          </div>
        </div>
        <div className="commons-cta">
          <button
            className={`btn ${joined ? "ghost" : ""}`}
            onClick={() => {
              setJoined(!joined);
              toast(joined ? "You've left the Commons (prototype)" : "You'd join the Commons — nothing is shared in this prototype");
            }}
          >
            <Icon name={joined ? "check" : "plus"} size={16} /> {joined ? "In the Commons" : "Opt in to the Commons"}
          </button>
          <button className="btn ghost" onClick={() => openSI("How do I contribute to research?")}>
            <Icon name="sparkle" size={16} /> How does consent work?
          </button>
        </div>
      </div>
    </section>
  );
}
