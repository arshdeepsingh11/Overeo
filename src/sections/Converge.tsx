"use client";

import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { ScrollTrigger } from "../lib/gsap";
import { useDerived } from "../core/derived";
import { useStore, openSI } from "../core/store";
import { latest } from "../core/persona";
import { SkeletonShape } from "../ui/Motion";
import { useNear } from "../lib/hooks";
import { Icon } from "../ui/Icon";
import type { Source } from "../fx/SignalConvergence";

const SignalConvergence = lazy(() => import("../fx/SignalConvergence").then((m) => ({ default: m.SignalConvergence })));

/* ------------------------------------------------------------------ *
 * Convergence — the section pins while eight of her data streams
 * light up one by one and converge on the OVEREO hub.
 * ------------------------------------------------------------------ */

const EXPLAIN: Record<string, string> = {
  cycle: "Six cycles of start dates and daily logs — the timeline everything else is read against.",
  temp: "Skin temperature rises ~0.3 °C after ovulation; it dates her phases even without a log.",
  rhr: "Resting heart rate lifts in the luteal phase and has crept up as iron fell.",
  labs: "BioAro Labs results: ferritin, hormones, thyroid, metabolic markers — with dates.",
  genome: "Pharmacogenomic and risk flags, each behind its own consent.",
  micro: "Gut and vaginal microbiome from BioAro and NEA.",
  symptoms: "Pain, flow and fatigue she logs — or simply says to SI.",
  notes: "Clinician notes from BioEMR close the loop with her care team.",
};

export function Converge() {
  const d = useDerived();
  const reduce = useStore((s) => s.reducedMotion);
  const pinRef = useRef<HTMLDivElement>(null);
  const near = useNear(pinRef, "400px");
  const [progress, setProgress] = useState(reduce ? 1 : 0);
  const [hover, setHover] = useState<string | null>(null);

  const sources: Source[] = useMemo(() => {
    const p = d.profile;
    const last = p.logs[p.logs.length - 1];
    const ferr = p.labs.find((l) => l.key === "ferritin")!;
    return [
      { id: "cycle", label: "Cycle", value: `day ${d.today.cycleDay}` },
      { id: "temp", label: "Skin temp", value: `${last.temp >= 0 ? "+" : ""}${last.temp.toFixed(2)} °C` },
      { id: "rhr", label: "Resting HR", value: `${last.rhr} bpm` },
      { id: "labs", label: "BioAro Labs", value: `ferritin ${latest(ferr).value}` },
      { id: "genome", label: "Genome", value: "CYP2C19 IM" },
      { id: "micro", label: "Microbiome", value: "L. crispatus" },
      { id: "symptoms", label: "Symptoms", value: `pain ${Math.max(...p.logs.slice(-40).map((l) => l.pain))}/10` },
      { id: "notes", label: "BioEMR", value: "2 notes" },
    ];
  }, [d]);

  useEffect(() => {
    const el = pinRef.current;
    if (!el || reduce) return;
    // Pin on tablet/desktop for the scroll story; on phones the streams
    // light up as the section scrolls past (pinning feels heavy on touch).
    const pin = innerWidth >= 768;
    const st = ScrollTrigger.create({
      trigger: el,
      start: pin ? "top top" : "top 70%",
      end: pin ? "+=140%" : "bottom 30%",
      pin,
      scrub: true,
      onUpdate: (s) => setProgress(s.progress),
    });
    return () => st.kill();
  }, [reduce]);

  const lit = Math.floor(progress * (sources.length + 1));
  const focus = hover ? sources.find((s) => s.id === hover) : sources[Math.min(sources.length - 1, Math.max(0, lit - 1))];

  return (
    <section id="converge" className="converge">
      <div ref={pinRef} className="converge-pin">
        <div className="wrap converge-copy">
          <span className="eyebrow">
            <span className="dot" /> Convergence
          </span>
          <h2 className="title-lg">
            Eight streams.
            <br />
            <span className="serif grad-text">One reading.</span>
          </h2>
          <ol className="conv-list">
            {sources.map((s, i) => (
              <li key={s.id} className={i < lit ? "on" : ""} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
                <span className="conv-dot" /> {s.label}
              </li>
            ))}
          </ol>
          {focus && (
            <div className="glass conv-explain" key={focus.id}>
              <b>{focus.label}</b>
              <span className="mono small">{focus.value}</span>
              <p className="small muted" style={{ margin: 0 }}>
                {EXPLAIN[focus.id]}
              </p>
              <button className="chip" onClick={() => openSI(`What does ${focus.label.toLowerCase()} tell you about her?`)}>
                <Icon name="sparkle" size={13} /> Ask SI
              </button>
            </div>
          )}
          <div className="conv-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
        <div className="converge-stage">
          {near ? (
            <Suspense fallback={<SkeletonShape shape="orb" height="100%" />}>
              <SignalConvergence sources={sources} progress={progress} onHover={setHover} />
            </Suspense>
          ) : (
            <SkeletonShape shape="orb" height="100%" />
          )}
        </div>
      </div>
    </section>
  );
}
