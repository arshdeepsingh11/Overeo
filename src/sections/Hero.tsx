"use client";

import { useEffect, useRef } from "react";
import { BeamFlow } from "../fx/BeamFlow";
import { Marquee3D, type MarqueeIcon } from "../fx/Marquee3D";
import { MorphingText, ShineBorder, CircularProgress } from "../ui/Motion";
import { Tilt, Magnetic } from "../ui/Controls";
import { Icon } from "../ui/Icon";
import { VideoSlot } from "../ui/VideoSlot";
import { openSI } from "../core/store";
import { useDerived } from "../core/derived";
import { run } from "../core/bus";
import { PHASE_META } from "../core/engines/forecast";
import { levelLabel } from "../core/engines/signals";

const ICONS: MarqueeIcon[] = [
  { id: "cycle", icon: "cycle", label: "Cycle", hue: 340, ask: "Which phase is she in?" },
  { id: "temp", icon: "waves", label: "Temperature", hue: 20, ask: "What does skin temperature show?" },
  { id: "heart", icon: "heart", label: "Heart", hue: 330, ask: "Tell me about women's heart health" },
  { id: "sleep", icon: "moon", label: "Sleep", hue: 300, ask: "Why does sleep drop before her period?" },
  { id: "labs", icon: "flask", label: "Labs", hue: 25, ask: "What does AMH 1.3 mean?" },
  { id: "dna", icon: "dna", label: "Genome", hue: 310, ask: "How is genetic data handled?" },
  { id: "micro", icon: "target", label: "Microbiome", hue: 35, ask: "What does her microbiome show?" },
  { id: "pain", icon: "drop", label: "Symptoms", hue: 335, ask: "Is this endometriosis?" },
  { id: "meds", icon: "shield", label: "Medicines", hue: 290, ask: "Why do women get more drug side effects?" },
  { id: "clock", icon: "clock", label: "Ovarian Clock", hue: 320, ask: "Explain her Ovarian Clock" },
  { id: "radar", icon: "radar", label: "Signals", hue: 328, ask: "What patterns have you noticed?" },
  { id: "future", icon: "trend", label: "Future Self", hue: 22, ask: "What if she starts strength training?" },
  { id: "care", icon: "users", label: "Care team", hue: 305, ask: "Who will see her results?" },
  { id: "privacy", icon: "lock", label: "Privacy", hue: 315, ask: "Who sees my data?" },
];

export function Hero() {
  const d = useDerived();
  const spot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--hx", `${e.clientX - r.left}px`);
      el.style.setProperty("--hy", `${e.clientY - r.top}px`);
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, []);
  const top = d.signals[0];
  return (
    <section id="hero" className="hero" ref={spot}>
      <BeamFlow className="hero-beam" />
      <div className="hero-dots" aria-hidden="true" />
      <div className="hero-dots spot" aria-hidden="true" />
      <div className="wrap hero-brand">
        <span className="wordmark">
          <span className="wm-mark" aria-hidden="true" />
          OVEREO
        </span>
        <span className="badge">Prototype · sample data</span>
      </div>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" /> OVEREO · Women's precision health
          </span>
          <h1 className="title-xl hero-title">
            <span className="line">Your body.</span>
            <span className="line">
              Your <span className="serif grad-text">biology.</span>
            </span>
            <span className="line">
              Your <mark className="hl">future.</mark>
            </span>
          </h1>
          <p className="hero-morph title-sm">
            Women's health, <MorphingText words={["understood.", "predicted.", "connected.", "yours."]} />
          </p>
          <p className="lede">
            One intelligence that reads her cycle, labs, genome and wearables together — notices what medicine has missed for decades — and routes her to the right person.
          </p>
          <div className="hero-ctas">
            <Magnetic>
              <ShineBorder>
                <button className="btn" onClick={() => openSI()}>
                  <Icon name="sparkle" size={18} /> Ask Overeo SI <span className="kbd kbd-inv">O</span>
                </button>
              </ShineBorder>
            </Magnetic>
            <button
              className="btn ghost"
              onClick={() => document.getElementById("hub")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Explore your hub <Icon name="down" size={18} />
            </button>
          </div>
        </div>

        <Tilt className="hero-live" max={8}>
          <div className="glass holo hero-card">
            <div className="hero-card-head">
              <span className="eyebrow" style={{ color: "var(--signal)" }}>
                <span className="dot" /> Live · {d.profile.name}
              </span>
              <span className="badge">Sample data</span>
            </div>
            <div className="hero-card-ring">
              <CircularProgress value={d.clock.span * 100} size={150} stroke={11} gradientId="hero-cp">
                <div className="tnum" style={{ fontSize: 38, fontWeight: 650, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {d.clock.markerAge}
                </div>
                <div className="faint" style={{ fontSize: 12 }}>
                  Ovarian Clock
                </div>
              </CircularProgress>
              <div className="hero-card-stats">
                <div>
                  <span className="faint small">Calendar age</span>
                  <b className="tnum">{d.clock.calendarAge}</b>
                </div>
                <div>
                  <span className="faint small">Cycle day</span>
                  <b className="tnum">
                    {d.today.cycleDay} <span className="faint small">{PHASE_META[d.today.phase].label}</span>
                  </b>
                </div>
                <div>
                  <span className="faint small">Next period</span>
                  <b className="tnum">in {d.today.daysUntil} d</b>
                </div>
              </div>
            </div>
            {top && (
              <button className="hero-signal" onClick={() => run({ type: "goto", section: "radar" })}>
                <span className={`sig-dot ${top.level}`} />
                <span>
                  <b>{top.title}</b>
                  <span className="faint small"> · {levelLabel[top.level]}</span>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            )}
          </div>
        </Tilt>
      </div>

      <div className="hero-marquee">
        <Marquee3D icons={ICONS} />
        <p className="faint small center">Fourteen streams, read together. Hover to focus · click to ask SI.</p>
      </div>
      <div className="wrap film-wrap" id="film">
        <VideoSlot src="/videos/overeo-brand-film.mp4" poster="/videos/overeo-brand-film.jpg" title="The OVEREO brand film" kicker="Brand film" />
      </div>
    </section>
  );
}
