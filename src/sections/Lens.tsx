"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDerived } from "../core/derived";
import { useStore, store, openSI } from "../core/store";
import { metricSeries, METRICS, PHASE_META, type Metric, type SeriesPoint } from "../core/engines/forecast";
import { fmtDate } from "../core/rng";
import { CircularProgress, Reveal } from "../ui/Motion";
import { Icon } from "../ui/Icon";
import { latest } from "../core/persona";

/* ------------------------------------------------------------------ *
 * The Cycle-Aware Lens — every signal read against her phase.
 * Phase bands sit behind the data; a learned forecast with a widening
 * uncertainty cone extends 35 days ahead (predictive overlay); hover
 * anywhere for an SI whisper about that day.
 * ------------------------------------------------------------------ */

export function Lens() {
  const d = useDerived();
  const metric = useStore((s) => s.lensMetric);
  const view = useStore((s) => s.lensView);
  const series = useMemo(() => metricSeries(d.profile, metric), [d.profile, metric]);
  const t = d.today;
  const p = d.profile;

  return (
    <section id="lens" className="section lens">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> The Cycle-Aware Lens
          </span>
          <h2 className="title-lg">
            The same number means
            <br />
            <span className="serif grad-text">different things</span> on different days.
          </h2>
          <p className="lede">
            Medicine mostly reads women's data as if hormones were flat. OVEREO reads every value through her phase — and learns her own rhythm to look ahead.
          </p>
        </div>

        <div className="lens-grid">
          <div className="glass lens-chart-card">
            <div className="lens-controls">
              <div className="seg glass-thin" role="radiogroup" aria-label="Metric">
                {(Object.keys(METRICS) as Metric[]).map((m) => (
                  <button key={m} role="radio" aria-checked={metric === m} className={`chip ${metric === m ? "on" : ""}`} onClick={() => store.set({ lensMetric: m })}>
                    {METRICS[m].label}
                  </button>
                ))}
              </div>
              <label className="lens-toggle small">
                Read through phase
                <button className="switch" role="switch" aria-checked={view === "phase"} onClick={() => store.set({ lensView: view === "phase" ? "raw" : "phase" })} />
              </label>
            </div>
            <Reveal height={360} shape="chart">
              <LensChart series={series} metric={metric} phased={view === "phase"} today={p.today} />
            </Reveal>
            <div className="lens-legend small">
              {Object.entries(PHASE_META).map(([k, v]) => (
                <span key={k}>
                  <i style={{ background: v.color }} /> {v.label}
                </span>
              ))}
              <span>
                <i className="dash" /> Forecast · cone = uncertainty
              </span>
            </div>
          </div>

          <div className="lens-side">
            <div className="glass lens-today">
              <CircularProgress value={(t.cycleDay / t.meanLength) * 100} size={128} stroke={10} gradientId="lens-cp">
                <div className="tnum" style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.03em" }}>
                  {t.cycleDay}
                </div>
                <div className="faint" style={{ fontSize: 11 }}>
                  cycle day
                </div>
              </CircularProgress>
              <div>
                <span className="badge" style={{ background: `${PHASE_META[t.phase].color}55`, color: "var(--fg)" }}>
                  {PHASE_META[t.phase].label}
                </span>
                <p className="small muted" style={{ margin: "8px 0" }}>
                  {PHASE_META[t.phase].desc}
                </p>
                <div className="small">
                  Next period <b suppressHydrationWarning>{fmtDate(t.nextStart)}</b> · in {t.daysUntil} days
                </div>
                <div className="faint small">
                  Confidence {Math.round(t.confidence * 100)}% · cycles {t.meanLength} ± {t.sdLength} d
                </div>
              </div>
            </div>
            <div className="glass lens-labs">
              <div className="small faint" style={{ marginBottom: 10 }}>
                Lab values read in context
              </div>
              {p.labs
                .filter((l) => l.phaseNote)
                .map((l) => (
                  <button key={l.key} className="lab-row" onClick={() => openSI(l.key === "amh" ? "What does AMH 1.3 mean?" : `Why does ${l.name} depend on the cycle?`)}>
                    <span>
                      <b>{l.name}</b> <span className="mono small">{latest(l).value} {l.unit}</span>
                    </span>
                    <span className="small muted">{l.phaseNote}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LensChart({ series, metric, phased, today }: { series: SeriesPoint[]; metric: Metric; phased: boolean; today: Date }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const H = 340;
  const pad = { l: 44, r: 16, t: 18, b: 34 };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const vals = series.flatMap((s) => (s.predicted ? [s.lo!, s.hi!] : [s.v]));
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = hi - lo || 1;
  lo -= span * 0.08;
  hi += span * 0.08;
  const n = series.length;
  const X = (i: number) => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const todayIdx = series.findIndex((s) => s.predicted) - 1;

  // smoothed paths
  const past = series.slice(0, todayIdx + 1);
  const fut = series.slice(todayIdx);
  const smooth = (pts: SeriesPoint[], off: number, key: "v" = "v") => {
    const arr = pts.map((p, i) => [X(i + off), Y(p[key])] as const);
    return arr.reduce((acc, [x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = arr[i - 1];
      const cx = (px + x) / 2;
      return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
    }, "");
  };
  // 7-day rolling mean for the "signal" line
  const rolled = past.map((p, i) => {
    const s = past.slice(Math.max(0, i - 3), i + 4);
    return { ...p, v: s.reduce((a, b) => a + b.v, 0) / s.length };
  });
  const cone =
    fut.length > 1
      ? `M${X(todayIdx)},${Y(fut[0].v)} ` +
        fut.slice(1).map((p, i) => `L${X(todayIdx + 1 + i)},${Y(p.hi!)}`).join(" ") +
        " " +
        fut
          .slice(1)
          .reverse()
          .map((p, i) => `L${X(n - 1 - i)},${Y(p.lo!)}`)
          .join(" ") +
        " Z"
      : "";

  const ticks = 4;
  const hv = hover != null ? series[hover] : null;
  const fmt = METRICS[metric].fmt;
  const whisper = hv ? whisperFor(hv, metric) : "";

  return (
    <div
      ref={box}
      className="lens-chart"
      onPointerMove={(e) => {
        const r = box.current!.getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (n - 1));
        setHover(i >= 0 && i < n ? i : null);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={w} height={H} role="img" aria-label={`${METRICS[metric].label} over 90 days with a 35-day forecast`}>
        <defs>
          <linearGradient id="lens-line" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent-2)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
          <linearGradient id="lens-cone" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent-2)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--accent-2)" stopOpacity=".06" />
          </linearGradient>
        </defs>
        {/* phase bands */}
        {phased &&
          series.map((s, i) => (
            <rect
              key={i}
              x={X(i) - (w - pad.l - pad.r) / (n - 1) / 2}
              y={pad.t}
              width={(w - pad.l - pad.r) / (n - 1) + 0.5}
              height={H - pad.t - pad.b}
              fill={PHASE_META[s.phase].color}
              opacity={s.predicted ? 0.1 : 0.2}
            />
          ))}
        {/* grid */}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = lo + ((hi - lo) * i) / ticks;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={Y(v)} y2={Y(v)} stroke="var(--chart-grid)" />
              <text x={pad.l - 8} y={Y(v) + 4} textAnchor="end" className="axis">
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {series
          .filter((_, i) => i % 21 === 0)
          .map((s) => {
            const i = series.indexOf(s);
            return (
              <text key={i} x={X(i)} y={H - 10} textAnchor="middle" className="axis">
                {fmtDate(s.date)}
              </text>
            );
          })}
        {/* forecast cone + line */}
        <path d={cone} fill="url(#lens-cone)" />
        <path d={smooth(fut, todayIdx)} fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeDasharray="5 5" />
        {/* raw daily dots + smoothed signal */}
        {past.map((s, i) => (
          <circle key={i} cx={X(i)} cy={Y(s.v)} r={1.8} fill="var(--fg-3)" opacity=".55" />
        ))}
        <path d={smooth(rolled, 0)} fill="none" stroke="url(#lens-line)" strokeWidth="2.6" strokeLinecap="round" className="lens-draw" />
        {/* today */}
        <line x1={X(todayIdx)} x2={X(todayIdx)} y1={pad.t} y2={H - pad.b} stroke="var(--accent)" strokeDasharray="2 4" />
        <text x={X(todayIdx) + 6} y={pad.t + 12} className="axis strong">
          Today · {fmtDate(today)}
        </text>
        {/* hover */}
        {hv && hover != null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--fg-2)" strokeOpacity=".35" />
            <circle cx={X(hover)} cy={Y(hv.v)} r={5} fill="var(--bg-2)" stroke="var(--accent)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hv && hover != null && (
        <div className="lens-tip glass-thin" style={{ left: Math.min(w - 250, Math.max(0, X(hover) + 12)) }}>
          <div className="small">
            <b>{fmtDate(hv.date)}</b> · {PHASE_META[hv.phase].label} {hv.predicted && <span className="badge">forecast</span>}
          </div>
          <div className="mono">
            {fmt(hv.v)} {METRICS[metric].unit}
            {hv.predicted && hv.lo != null && (
              <span className="faint small">
                {" "}
                ({fmt(hv.lo)} – {fmt(hv.hi!)})
              </span>
            )}
          </div>
          <div className="small muted lens-whisper">
            <Icon name="sparkle" size={12} /> {whisper}
          </div>
        </div>
      )}
    </div>
  );
}

function whisperFor(s: SeriesPoint, m: Metric) {
  const ph = s.phase;
  if (s.predicted) return ph === "menstrual" ? "Forecast: period likely here — energy usually dips; plan lighter days." : ph === "luteal" ? "Forecast: luteal rise expected; sleep may shorten in the last few days." : "Forecast from her own past cycles, widening with uncertainty.";
  if (m === "temp") return ph === "luteal" ? "Progesterone lifts temperature after ovulation." : ph === "ovulatory" ? "The shift right after this marks ovulation." : "Lower in the follicular phase.";
  if (m === "rhr") return ph === "luteal" ? "Resting heart rate runs 2–3 bpm higher now — normal for her." : "Lower baseline outside the luteal phase.";
  if (m === "sleep") return ph === "luteal" ? "Late-luteal nights are her shortest." : ph === "menstrual" ? "Pain and flow cost her sleep these days." : "Her steadiest sleep window.";
  return ph === "menstrual" ? "Energy dips with heavy flow — and falling iron makes it deeper." : "Energy tracks iron and sleep more than the calendar.";
}
