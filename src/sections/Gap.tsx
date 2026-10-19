"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FACTS, DELAYS } from "../core/research";
import { NumberTicker, LayoutTextFlip, CircularProgress, Text3DFlip } from "../ui/Motion";
import { openSI } from "../core/store";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * The gap — cinematic data reveal. Facts rise out of depth as you
 * scroll; numbers count up; delay bars grow to scale. Every number is
 * cited and clickable for Overeo SI to explain.
 * ------------------------------------------------------------------ */

export function Gap() {
  const root = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  // one gentle reveal when the section arrives (no scroll-scrubbing)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const max = Math.max(...DELAYS.map((d) => d.years));
  return (
    <section id="gap" className={`section gap ${seen ? "in" : ""}`} ref={root}>
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> The gap
          </span>
          <h2 className="title-lg">
            <LayoutTextFlip before="Women are diagnosed" words={["later.", "differently.", "last."]} />
          </h2>
          <p className="lede">It isn't a feeling. It's measurable — and patterns are how you close it.</p>
        </div>

        <div className="facts">
          {FACTS.map((f, i) => (
            <button key={f.id} className="fact glass" style={{ "--i": i } as CSSProperties} onClick={() => openSI(f.id === "dx" ? "Why are women diagnosed later?" : f.id === "endo" ? "Tell me about endometriosis" : f.id === "meno" ? "Tell me about menopause care" : f.id === "adr" ? "Why do women get more drug side effects?" : "Why are women diagnosed later?")}>
              <span className="fact-num grad-text">
                <NumberTicker value={f.value} suffix={f.suffix} prefix={f.prefix} />
              </span>
              <span className="fact-label">{f.label}</span>
              <span className="fact-detail small muted">{f.detail}</span>
              <span className="fact-src faint">
                {f.source} <Icon name="sparkle" size={12} />
              </span>
            </button>
          ))}
          <div className="fact glass fact-ring">
            <CircularProgress value={84} size={150} stroke={12} gradientId="gap-cp" label={<NumberTicker value={84} suffix="%" />} sub="didn't seek menopause care" />
          </div>
        </div>

        <div className="delays glass">
          <div className="delays-head">
            <h3 className="title-sm">Years lost to waiting</h3>
            <span className="faint small">Average delay, from the studies above</span>
          </div>
          {DELAYS.map((d, i) => (
            <div key={d.label} className="delay-row">
              <span className="delay-label">{d.label}</span>
              <span className="delay-track">
                <span className="delay-fill" style={{ width: `${(d.years / max) * 100}%`, "--i": i } as CSSProperties}>
                  <span className="delay-val tnum">{d.years} yrs</span>
                </span>
              </span>
              <span className="faint small delay-note">{d.note}</span>
            </div>
          ))}
        </div>

        <h3 className="title-md gap-close">
          <Text3DFlip text="Patterns" /> close the gap. <span className="muted">That's what OVEREO reads for.</span>
        </h3>
      </div>
    </section>
  );
}
