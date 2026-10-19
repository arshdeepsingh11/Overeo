"use client";

import { useState } from "react";
import { EvervaultCard } from "../fx/Evervault";
import { openSI, toast, resetProfile } from "../core/store";
import { Icon } from "../ui/Icon";
import { useDerived } from "../core/derived";
import { latest } from "../core/persona";

/* ------------------------------------------------------------------ *
 * Privacy as part of the product. Each kind of information has its own
 * switches; genetic data starts off. The scrambled cards are a visual
 * metaphor (hover to decode) — they encrypt nothing themselves.
 * ------------------------------------------------------------------ */

type Cat = "cycle" | "labs" | "genome";
type Use = "insights" | "care" | "research";

const CATS: { id: Cat; label: string; secret: string; note: string }[] = [
  { id: "cycle", label: "Cycle & symptoms", secret: "Day 24 · luteal · pain 2/10", note: "Logged by her, read by SI." },
  { id: "labs", label: "Lab results", secret: "Ferritin 22 ng/mL · AMH 1.3", note: "From BioAro Labs." },
  { id: "genome", label: "Genome", secret: "CYP2C19 *1/*2 · BRCA not tested", note: "Can reveal things about relatives. Off by default." },
];
const USES: { id: Use; label: string }[] = [
  { id: "insights", label: "Personal insights" },
  { id: "care", label: "Share with care team" },
  { id: "research", label: "Science Commons" },
];

export function Privacy() {
  const d = useDerived();
  const last = d.profile.logs[d.profile.logs.length - 1];
  const secrets: Record<Cat, string> = {
    cycle: `Day ${d.today.cycleDay} · ${d.today.phase} · pain ${last.pain}/10`,
    labs: `Ferritin ${latest(d.profile.labs.find((l) => l.key === "ferritin")!).value} · AMH ${d.profile.markers.amh}`,
    genome: CATS[2].secret,
  };
  const [perm, setPerm] = useState<Record<Cat, Record<Use, boolean>>>({
    cycle: { insights: true, care: true, research: false },
    labs: { insights: true, care: true, research: false },
    genome: { insights: false, care: false, research: false },
  });
  const flip = (c: Cat, u: Use) => setPerm((p) => ({ ...p, [c]: { ...p[c], [u]: !p[c][u] } }));
  const summary = CATS.map((c) => {
    const on = USES.filter((u) => perm[c.id][u.id]).map((u) => u.label.toLowerCase());
    return `${c.label}: ${on.length ? on.join(", ") : "not used at all"}.`;
  });
  return (
    <section id="privacy" className="section privacy">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> Privacy & consent
          </span>
          <h2 className="title-lg">
            Your biology. <span className="serif grad-text">Your decisions.</span>
          </h2>
          <p className="lede">Privacy isn't a policy page — it's a control for every kind of information and every use of it.</p>
        </div>
        <div className="priv-grid">
          {CATS.map((c) => {
            const locked = !perm[c.id].insights;
            return (
              <div key={c.id} className="priv-col">
                <EvervaultCard label={c.label} secret={secrets[c.id]} locked={locked}>
                  <span className={`badge ${locked ? "" : "good"}`}>
                    <Icon name={locked ? "lock" : "eye"} size={12} /> {locked ? "Sealed" : "Hover to decode"}
                  </span>
                </EvervaultCard>
                <div className="glass priv-ctrls">
                  <span className="small muted">{c.note}</span>
                  {USES.map((u) => (
                    <label key={u.id} className="mk-switch">
                      <span className="small">{u.label}</span>
                      <button className="switch" role="switch" aria-checked={perm[c.id][u.id]} aria-label={`${c.label}: ${u.label}`} onClick={() => flip(c.id, u.id)} />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="glass priv-summary">
          <div>
            <b>What your choices mean</b>
            <ul className="small">
              {summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="sig-actions">
            <button className="btn ghost sm" onClick={() => openSI("How is genetic data handled?")}>
              <Icon name="sparkle" size={15} /> Ask SI
            </button>
            <button
              className="btn ghost sm"
              onClick={() => {
                resetProfile();
                toast("Everything you changed has been erased from this browser");
              }}
            >
              <Icon name="refresh" size={15} /> Erase my edits
            </button>
          </div>
        </div>
        <p className="note">Demonstration controls — not yet a legally effective consent mechanism. The scrambled text is a visual metaphor; no encryption standard is claimed.</p>
      </div>
    </section>
  );
}
