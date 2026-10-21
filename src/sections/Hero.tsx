"use client";

import { useEffect, useRef } from "react";
import { BeamFlow } from "../fx/BeamFlow";
import { Marquee3D, type MarqueeIcon } from "../fx/Marquee3D";
import { MorphingText, ShineBorder, CircularProgress } from "../ui/Motion";
import { Tilt, Magnetic } from "../ui/Controls";
import { Icon } from "../ui/Icon";
import { Wordmark } from "../ui/Logo";
import { VideoSlot } from "../ui/VideoSlot";
import { openSI } from "../core/store";
import { useDerived } from "../core/derived";
import { run } from "../core/bus";
import { PHASE_META } from "../core/engines/forecast";
import { levelLabel } from "../core/engines/signals";
import { STREAMS, STRIP, type StreamId } from "../core/streams";
import { StreamPop } from "../ui/StreamPop";

const ICONS: MarqueeIcon[] = STRIP.map((id) => {
  const s = STREAMS[id];
  return { id, icon: s.icon, label: s.label, hue: s.hue, ask: s.ask };
});

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
        <Wordmark />
        <span className="badge byline">Overeo by BioAro</span>
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
            One intelligence that reads her cycle, symptoms, labs and genome together — notices what medicine has missed for decades — and routes her to the right person.
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
        <Marquee3D icons={ICONS} renderInfo={(id, close) => <StreamPop id={id as StreamId} onClose={close} />} />
        <p className="faint small center">Fourteen streams, read together. Hover or tap any one to see what it tells us.</p>
      </div>
      <div className="wrap film-wrap" id="film">
        <VideoSlot src="/videos/overeo-brand-film.mp4" poster="/videos/overeo-brand-film.jpg" title="The OVEREO brand film" kicker="OVEREO · Brand film" ratio="2560 / 1098" silent />
      </div>
    </section>
  );
}
