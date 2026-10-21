"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { ScrollTrigger } from "../lib/gsap";
import { useDerived } from "../core/derived";
import { useStore, openSI } from "../core/store";
import { SkeletonShape } from "../ui/Motion";
import { useNear, useVisible } from "../lib/hooks";
import { Icon } from "../ui/Icon";
import { STRENGTH } from "../ui/StreamPop";
import { CONVERGE, LINKS, STREAMS, readStream, sampleNotes, streamFacts, type StreamFacts, type StreamId } from "../core/streams";
import type { Derived } from "../core/derived";
import type { Source } from "../fx/SignalConvergence";

const SignalConvergence = lazy(() => import("../fx/SignalConvergence").then((m) => ({ default: m.SignalConvergence })));

/* ------------------------------------------------------------------ *
 * Convergence — eight of her streams light up and converge on SI.
 *
 * The reading panel always shows one stream: while you scroll it
 * follows the stream that just lit; after that SI walks through them
 * in order, one every few seconds. Hover a node or tap a stream to
 * read it yourself — tapping pins it. Every chart and sentence is
 * computed from her data (sample profile), never shuffled at random.
 * ------------------------------------------------------------------ */

const AUTO_MS = 6500;

export function Converge() {
  const d = useDerived();
  const reduce = useStore((s) => s.reducedMotion);
  const pinRef = useRef<HTMLDivElement>(null);
  const near = useNear(pinRef, "400px");
  const vis = useVisible(pinRef, "0px");
  const [progress, setProgress] = useState(reduce ? 1 : 0);
  const [hover, setHover] = useState<StreamId | null>(null);
  const [pinned, setPinned] = useState<StreamId | null>(null);
  const [auto, setAuto] = useState(0);
  const [paused, setPaused] = useState(false);

  const facts = useMemo(() => streamFacts(d), [d]);
  const sources: Source[] = useMemo(() => CONVERGE.map((id) => ({ id, label: STREAMS[id].label, value: readStream(id, d, facts).value })), [d, facts]);

  useEffect(() => {
    const el = pinRef.current;
    if (!el || reduce) return;
    // Pin on tablet/desktop for the scroll story; on phones the streams
    // light up as the section scrolls past (pinning feels heavy on touch).
    const pin = innerWidth >= 768;
    const st = ScrollTrigger.create({
      trigger: el,
      start: pin ? "top top" : "top 70%",
      end: pin ? "+=140%" : "bottom 60%",
      pin,
      scrub: true,
      onUpdate: (s) => setProgress(s.progress),
    });
    return () => st.kill();
  }, [reduce]);

  const N = CONVERGE.length;
  const lit = Math.floor(progress * (N + 1));
  const done = progress > 0.96;
  const scrollFocus = Math.min(N - 1, Math.max(0, lit - 1));

  // While she scrolls, the panel follows the stream that just lit. When the
  // scrolling rests, SI carries on reading from there, one stream at a time.
  const [resting, setResting] = useState(true);
  useEffect(() => {
    if (reduce) return;
    setAuto(scrollFocus);
    setResting(false);
    const t = setTimeout(() => setResting(true), 2200);
    return () => clearTimeout(t);
  }, [scrollFocus, reduce]);

  const reading = resting && lit > 0 && !pinned && !paused && !hover && vis && !reduce;
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(() => setAuto((a) => (a + 1) % N), AUTO_MS);
    return () => clearInterval(t);
  }, [reading, N]);

  const shown: StreamId = hover ?? pinned ?? CONVERGE[auto];
  const idx = CONVERGE.indexOf(shown);

  const pick = (id: StreamId) => {
    if (!CONVERGE.includes(id)) return;
    setPinned((p) => (p === id ? null : id));
    setAuto(CONVERGE.indexOf(id));
  };
  const step = (dir: number) => {
    const next = CONVERGE[(Math.max(0, idx) + dir + N) % N];
    setPinned(next);
    setAuto(CONVERGE.indexOf(next));
  };

  return (
    <section id="converge" className="converge">
      <div ref={pinRef} className="converge-pin">
        <div className="wrap converge-copy">
          <span className="eyebrow">
            <span className="dot" /> Convergence
          </span>
          <h2 className="title-lg conv-title">
            Eight streams. <span className="serif grad-text">One reading.</span>
          </h2>
          <div className="conv-chips" role="tablist" aria-label="Her data streams">
            {CONVERGE.map((id, i) => (
              <button
                key={id}
                role="tab"
                aria-selected={shown === id}
                className={`conv-chip ${i < lit || done ? "on" : ""} ${shown === id ? "sel" : ""} ${pinned === id ? "pin" : ""}`}
                onClick={() => pick(id)}
                onMouseEnter={() => setHover(id)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="conv-dot" /> {STREAMS[id].label}
              </button>
            ))}
          </div>
          <ReadingPanel
            key={shown}
            id={shown}
            d={d}
            f={facts}
            pinned={pinned === shown}
            auto={reading}
            onPick={pick}
            onStep={step}
            onUnpin={() => setPinned(null)}
            onHold={setPaused}
            index={idx}
            total={N}
          />
          <div className="conv-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
        <div className="converge-stage">
          {near ? (
            <Suspense fallback={<SkeletonShape shape="orb" height="100%" />}>
              <SignalConvergence sources={sources} progress={progress} active={shown} onHover={(id) => setHover(id as StreamId | null)} onSelect={(id) => pick(id as StreamId)} />
            </Suspense>
          ) : (
            <SkeletonShape shape="orb" height="100%" />
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Reading panel ------------------------------ */

function ReadingPanel({
  id,
  d,
  f,
  pinned,
  auto,
  onPick,
  onStep,
  onUnpin,
  onHold,
  index,
  total,
}: {
  id: StreamId;
  d: Derived;
  f: StreamFacts;
  pinned: boolean;
  auto: boolean;
  onPick: (id: StreamId) => void;
  onStep: (dir: number) => void;
  onUnpin: () => void;
  onHold: (on: boolean) => void;
  index: number;
  total: number;
}) {
  const s = STREAMS[id];
  const read = readStream(id, d, f);
  const st = STRENGTH[read.strength];
  const words = read.insight.split(" ");
  return (
    <div className="glass conv-read" style={{ ["--h" as string]: s.hue }} onMouseEnter={() => onHold(true)} onMouseLeave={() => onHold(false)} aria-live="polite">
      <div className="conv-read-head">
        <span className="spop-ic">
          <Icon name={s.icon} size={18} />
        </span>
        <span className="conv-read-t">
          <b>{s.label}</b>
          <span className="faint small">{s.input}</span>
        </span>
        <span className="mono small spop-val">{read.value}</span>
      </div>

      <div className="conv-viz">
        <StreamViz id={id} d={d} f={f} />
      </div>

      <div className="spop-read">
        <span className="spop-k">
          <Icon name="sparkle" size={12} /> SI reading <span className={`badge ${st.tone}`}>{st.label}</span>
        </span>
        <p className="conv-typed">
          {words.map((w, i) => (
            <span key={i} style={{ animationDelay: `${Math.min(i, 60) * 18}ms` }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>

      <div className="conv-links">
        <span className="spop-k">Connects to</span>
        <div className="conv-link-row">
          {LINKS[id].map((l) => (
            <button key={l.to} className="chip" onClick={() => onPick(l.to)}>
              <Icon name={STREAMS[l.to].icon} size={12} /> {STREAMS[l.to].label} <span className="faint">· {l.why}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="conv-why small muted">
        {s.why}{" "}
        {s.source.url ? (
          <a className="spop-src" href={s.source.url} target="_blank" rel="noopener noreferrer">
            {s.source.label} <Icon name="external" size={11} />
          </a>
        ) : (
          <span className="spop-src">{s.source.label}</span>
        )}
      </p>

      <div className="conv-foot">
        <button className="chip" onClick={() => openSI(s.ask)}>
          <Icon name="sparkle" size={13} /> Ask SI
        </button>
        <Link className="chip" href={s.href}>
          Open <Icon name="arrow" size={13} />
        </Link>
        <span className="conv-nav">
          <button className="conv-step" onClick={() => onStep(-1)} aria-label="Previous stream">
            <Icon name="chevron" size={14} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span className="faint small tnum">
            {index + 1}/{total}
          </span>
          <button className="conv-step" onClick={() => onStep(1)} aria-label="Next stream">
            <Icon name="chevron" size={14} />
          </button>
        </span>
      </div>
      <div className={`conv-timer ${auto ? "run" : ""}`} aria-hidden="true" style={{ animationDuration: `${AUTO_MS}ms` }} />
      {pinned && (
        <button className="conv-pin faint small" onClick={onUnpin}>
          <Icon name="pin" size={12} /> Pinned · resume auto
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Mini charts ------------------------------ */

const W = 320;
const H = 92;

function line(values: number[], lo: number, hi: number, pad = 8) {
  const n = values.length;
  return values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
      const y = H - 14 - ((v - lo) / (hi - lo || 1)) * (H - 26);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
const yOf = (v: number, lo: number, hi: number) => H - 14 - ((v - lo) / (hi - lo || 1)) * (H - 26);
const smooth = (xs: number[], k = 7) => xs.map((_, i) => xs.slice(Math.max(0, i - k + 1), i + 1).reduce((a, b) => a + b, 0) / Math.min(k, i + 1));

function StreamViz({ id, d, f }: { id: StreamId; d: Derived; f: StreamFacts }) {
  const p = d.profile;
  switch (id) {
    case "cycle": {
      const lo = 18;
      const hi = 40;
      const bw = (W - 16) / f.lengths.length;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="sviz" role="img" aria-label={`Last ${f.lengths.length} cycle lengths`}>
          <rect x="8" y={yOf(35, lo, hi)} width={W - 16} height={yOf(21, lo, hi) - yOf(35, lo, hi)} className="sviz-band" />
          <text x={W - 10} y={yOf(35, lo, hi) - 3} className="sviz-t" textAnchor="end">
            21–35 d typical
          </text>
          {f.lengths.map((l, i) => (
            <g key={i} className="sviz-grow" style={{ animationDelay: `${i * 60}ms` }}>
              <rect x={8 + i * bw + bw * 0.22} y={yOf(l, lo, hi)} width={bw * 0.56} height={H - 14 - yOf(l, lo, hi)} rx="5" className="sviz-bar" />
              <text x={8 + i * bw + bw / 2} y={yOf(l, lo, hi) - 4} className="sviz-t" textAnchor="middle">
                {l}
              </text>
            </g>
          ))}
          <line x1="8" x2={W - 8} y1={yOf(f.cycleMean, lo, hi)} y2={yOf(f.cycleMean, lo, hi)} className="sviz-mean" />
        </svg>
      );
    }
    case "temp": {
      const v = f.current.map((l) => l.temp);
      const lo = -0.35;
      const hi = 0.55;
      const ox = f.ovDay ? 8 + ((f.ovDay - 1) / Math.max(1, v.length - 1)) * (W - 16) : null;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="sviz" role="img" aria-label="Temperature this cycle">
          <line x1="8" x2={W - 8} y1={yOf(0, lo, hi)} y2={yOf(0, lo, hi)} className="sviz-mean" />
          <text x="10" y={yOf(0, lo, hi) - 4} className="sviz-t">
            her baseline
          </text>
          {ox != null && (
            <>
              <line x1={ox} x2={ox} y1="8" y2={H - 14} className="sviz-mark" />
              <text x={ox + 4} y="14" className="sviz-t">
                ovulation ~ day {f.ovDay}
              </text>
            </>
          )}
          <path d={line(v, lo, hi)} className="sviz-line sviz-draw" pathLength={1} />
          <text x="8" y={H - 2} className="sviz-t">
            day 1
          </text>
          <text x={W - 8} y={H - 2} className="sviz-t" textAnchor="end">
            today · day {d.today.cycleDay}
          </text>
        </svg>
      );
    }
    case "heart": {
      const v = smooth(p.logs.map((l) => l.rhr));
      const lo = Math.min(...v) - 1;
      const hi = Math.max(...v) + 1;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="sviz" role="img" aria-label="Morning pulse, 7-day average">
          <path d={line(v, lo, hi)} className="sviz-line sviz-draw" pathLength={1} />
          <text x="8" y={H - 2} className="sviz-t">
            {f.rhrFirst} bpm · 7 months ago
          </text>
          <text x={W - 8} y={H - 2} className="sviz-t" textAnchor="end">
            {f.rhrNow} bpm now
          </text>
          <text x="8" y="12" className="sviz-t">
            luteal bumps +{f.rhrShift} bpm
          </text>
        </svg>
      );
    }
    case "labs": {
      const pts = f.ferritin.points.map((x) => x.value);
      const lo = 0;
      const hi = 60;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="sviz" role="img" aria-label="Ferritin over time">
          <rect x="8" y={yOf(30, lo, hi)} width={W - 16} height={yOf(0, lo, hi) - yOf(30, lo, hi)} className="sviz-band warn" />
          <text x={W - 10} y={yOf(30, lo, hi) - 4} className="sviz-t" textAnchor="end">
            under 30 = low iron stores
          </text>
          <path d={line(pts, lo, hi, 28)} className="sviz-line sviz-draw" pathLength={1} />
          {pts.map((v, i) => {
            const x = 28 + (i / Math.max(1, pts.length - 1)) * (W - 56);
            return (
              <g key={i} className="sviz-grow" style={{ animationDelay: `${300 + i * 120}ms` }}>
                <circle cx={x} cy={yOf(v, lo, hi)} r="4.5" className="sviz-dot" />
                <text x={x} y={yOf(v, lo, hi) - 9} className="sviz-t" textAnchor="middle">
                  {v}
                </text>
              </g>
            );
          })}
        </svg>
      );
    }
    case "symptoms": {
      const v = f.painByDay;
      const bw = (W - 16) / v.length;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="sviz" role="img" aria-label="Average pain by cycle day">
          {v.map((x, i) => (
            <g key={i} className="sviz-grow" style={{ animationDelay: `${i * 45}ms` }}>
              <rect x={8 + i * bw + bw * 0.18} y={yOf(x, 0, 10)} width={bw * 0.64} height={Math.max(1.5, H - 14 - yOf(x, 0, 10))} rx="4" className={`sviz-bar ${x >= 6 ? "hot" : ""}`} />
              <text x={8 + i * bw + bw / 2} y={H - 2} className="sviz-t" textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}
          <text x={W - 8} y="12" className="sviz-t" textAnchor="end">
            avg pain by cycle day · 6 cycles
          </text>
        </svg>
      );
    }
    case "genome":
      return (
        <div className="sviz-rows">
          {p.genome.map((g) => (
            <div key={g.label} className="sviz-row">
              <b className="mono">{g.label}</b>
              <span>{g.value}</span>
            </div>
          ))}
        </div>
      );
    case "micro":
      return (
        <div className="sviz-rows">
          {p.microbiome.map((m) => (
            <div key={m.label} className="sviz-row">
              <b>{m.label}</b>
              <span>{m.value}</span>
            </div>
          ))}
          <div className="sviz-row faint">
            <b>Source</b>
            <span>BioAro BioFemme + BioGut (sample)</span>
          </div>
        </div>
      );
    case "notes":
      return (
        <div className="sviz-rows">
          {sampleNotes(d).map((n) => (
            <div key={n.who} className="sviz-row note">
              <b className="tnum">{n.date.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</b>
              <span>
                <span className="faint">{n.who} — </span>
                {n.text}
              </span>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
