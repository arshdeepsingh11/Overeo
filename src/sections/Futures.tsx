"use client";

import { useEffect, useRef, useState } from "react";
import { useDerived } from "../core/derived";
import { useStore, store, openSI } from "../core/store";
import { LEVERS, type FuturePoint } from "../core/engines/futures";
import { NumberTicker, Reveal } from "../ui/Motion";
import { Tilt } from "../ui/Controls";
import { Icon } from "../ui/Icon";
import { attachGestures } from "../lib/gesture";
import { tick } from "../lib/audio";

/* ------------------------------------------------------------------ *
 * Future Self — two futures from one present. Path A (today's habits)
 * and Path B (the levers she switches on) diverge across the decades;
 * drag the scrubber through time to meet her future self at any age.
 * ------------------------------------------------------------------ */

type Dim = "avg" | "bone" | "heart" | "energy";
const DIMS: { k: Dim; label: string }[] = [
  { k: "avg", label: "Overall" },
  { k: "bone", label: "Bone" },
  { k: "heart", label: "Heart & metabolism" },
  { k: "energy", label: "Energy" },
];
const val = (p: FuturePoint, k: Dim) => (k === "avg" ? (p.bone + p.heart + p.energy) / 3 : p[k]);

export function Futures() {
  const d = useDerived();
  const levers = useStore((s) => s.levers);
  const [dim, setDim] = useState<Dim>("avg");
  const [age, setAge] = useState(55);
  const f = d.futures;
  const ages = f.a.map((p) => p.age);
  const at = (arr: FuturePoint[]) => arr.find((p) => p.age === Math.round(age)) ?? arr[arr.length - 1];
  const A = at(f.a);
  const B = at(f.b);
  const anyOn = Object.values(levers).some(Boolean);

  return (
    <section id="futures" className="section futures">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> Future Self
          </span>
          <h2 className="title-lg">
            One present. <span className="serif grad-text">Two futures.</span>
          </h2>
          <p className="lede">Switch on a lever and watch the decades bend. Menopause is when most women's curves change shape — which makes the years before it the best time to act.</p>
        </div>

        <div className="fut-grid">
          <div className="glass fut-chart-card">
            <div className="lens-controls">
              <div className="seg glass-thin" role="radiogroup" aria-label="Dimension">
                {DIMS.map((x) => (
                  <button key={x.k} role="radio" aria-checked={dim === x.k} className={`chip ${dim === x.k ? "on" : ""}`} onClick={() => setDim(x.k)}>
                    {x.label}
                  </button>
                ))}
              </div>
              <span className="small faint">Illustrative model · index 0–100</span>
            </div>
            <Reveal height={340} shape="chart">
              <FutureChart a={f.a} b={f.b} dim={dim} age={age} setAge={setAge} ages={ages} showB={anyOn} />
            </Reveal>
            <div className="lens-legend small">
              <span>
                <i className="dash" /> Path A · today's habits
              </span>
              <span>
                <i style={{ background: "var(--accent)" }} /> Path B · with levers
              </span>
              <span>
                <i style={{ background: "var(--gold)" }} /> Menopause ≈ 51
              </span>
            </div>
          </div>

          <div className="fut-side">
            <Tilt max={7}>
              <div className="glass holo fut-self">
                <span className="faint small">Meet her at</span>
                <div className="fut-age tnum">{Math.round(age)}</div>
                <div className="fut-rows">
                  {(["bone", "heart", "energy"] as const).map((k) => (
                    <div key={k} className="fut-row">
                      <span className="small">{k === "heart" ? "Heart" : k[0].toUpperCase() + k.slice(1)}</span>
                      <span className="fut-bars">
                        <span className="fb a" style={{ width: `${A[k]}%` }} />
                        <span className="fb b" style={{ width: `${anyOn ? B[k] : A[k]}%` }} />
                      </span>
                      <span className="tnum small">
                        {Math.round(anyOn ? B[k] : A[k])}
                        {anyOn && B[k] - A[k] >= 1 && <span className="good"> +{Math.round(B[k] - A[k])}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="small muted fut-story">{story(Math.round(age), A, B, anyOn)}</p>
              </div>
            </Tilt>
            <div className="glass fut-span">
              <div>
                <span className="faint small">Healthspan index ≥ 60 until</span>
                <div className="fut-span-nums">
                  <span className="tnum">{f.healthspanA}</span>
                  <Icon name="arrow" size={18} />
                  <span className="tnum grad-text">{f.healthspanB >= 80 ? "80+" : f.healthspanB}</span>
                </div>
              </div>
              <div className="fut-gain">
                <NumberTicker value={f.gain} prefix={f.gain > 0 ? "+" : ""} startOnView={false} duration={0.8} />
                <span className="faint small">years</span>
              </div>
            </div>
          </div>
        </div>

        <div className="levers">
          {LEVERS.map((l) => (
            <button
              key={l.key}
              className={`glass lever ${levers[l.key] ? "on" : ""}`}
              onClick={() => {
                tick(levers[l.key] ? 900 : 1500);
                store.set((s) => ({ levers: { ...s.levers, [l.key]: !s.levers[l.key] } }));
              }}
              aria-pressed={levers[l.key]}
            >
              <span className="switch" role="presentation" aria-checked={levers[l.key]} />
              <span>
                <b>{l.label}</b>
                <span className="small muted">{l.detail}</span>
              </span>
            </button>
          ))}
          <button className="glass lever ask" onClick={() => openSI("What if she starts strength training?")}>
            <Icon name="sparkle" size={20} />
            <span>
              <b>Ask SI to simulate</b>
              <span className="small muted">“What if she treats her iron and sleeps 7.5 h?”</span>
            </span>
          </button>
        </div>
        <p className="note">Illustrative trajectories to support a conversation with a clinician — not a prediction of anyone's health.</p>
      </div>
    </section>
  );
}

function story(age: number, A: FuturePoint, B: FuturePoint, on: boolean) {
  const after = age > 51;
  const bone = on ? B.bone : A.bone;
  if (!on) return after ? `Past menopause, bone and heart curves steepen. Switch on a lever to see what changes.` : `Before menopause the curves are gentle — this is the window where levers compound.`;
  const gain = Math.round((B.bone + B.heart + B.energy - A.bone - A.heart - A.energy) / 3);
  return `At ${age}, Path B runs about ${gain} points higher overall${after ? `; bone index ${Math.round(bone)} after menopause` : ""}. Small, early habits — big later difference.`;
}

function FutureChart({ a, b, dim, age, setAge, ages, showB }: { a: FuturePoint[]; b: FuturePoint[]; dim: Dim; age: number; setAge: (n: number) => void; ages: number[]; showB: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  const H = 320;
  const pad = { l: 36, r: 16, t: 20, b: 32 };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const a0 = ages[0];
  const a1 = ages[ages.length - 1];
  const X = (x: number) => pad.l + ((x - a0) / (a1 - a0)) * (w - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - 20) / 80) * (H - pad.t - pad.b);
  const path = (arr: FuturePoint[]) => arr.map((p, i) => `${i ? "L" : "M"}${X(p.age).toFixed(1)},${Y(val(p, dim)).toFixed(1)}`).join("");
  const area = (arr: FuturePoint[], other: FuturePoint[]) =>
    `${path(arr)} ${other
      .slice()
      .reverse()
      .map((p) => `L${X(p.age).toFixed(1)},${Y(val(p, dim)).toFixed(1)}`)
      .join(" ")} Z`;

  // drag the scrubber (pointer / touch)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const toAge = (x: number) => {
      const r = el.getBoundingClientRect();
      const t = (x - r.left - pad.l) / (w - pad.l - pad.r);
      return Math.max(a0, Math.min(a1, a0 + t * (a1 - a0)));
    };
    let dragging = false;
    const off = attachGestures(
      el,
      {
        onDragStart: (x) => {
          dragging = true;
          setAge(toAge(x));
        },
        onDrag: (_dx, _dy, x) => dragging && setAge(toAge(x)),
        onDragEnd: () => (dragging = false),
      },
      { wheelPassive: true },
    );
    return off;
  }, [w, a0, a1, setAge, pad.l, pad.r]);

  const A = a.find((p) => p.age === Math.round(age)) ?? a[0];
  const B = b.find((p) => p.age === Math.round(age)) ?? b[0];
  return (
    <div ref={box} className="fut-chart" role="slider" aria-label="Age scrubber" aria-valuemin={a0} aria-valuemax={a1} aria-valuenow={Math.round(age)} tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setAge(Math.min(a1, age + 1));
        if (e.key === "ArrowLeft") setAge(Math.max(a0, age - 1));
      }}
    >
      <svg width={w} height={H}>
        <defs>
          <linearGradient id="fut-gap" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".05" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity=".28" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={Y(v)} y2={Y(v)} stroke="var(--chart-grid)" strokeDasharray={v === 60 ? "4 4" : undefined} />
            <text x={pad.l - 8} y={Y(v) + 4} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        ))}
        {ages
          .filter((x) => x % 10 === 0)
          .map((x) => (
            <text key={x} x={X(x)} y={H - 10} textAnchor="middle" className="axis">
              {x}
            </text>
          ))}
        <rect x={X(51)} y={pad.t} width={X(59) - X(51)} height={H - pad.t - pad.b} fill="var(--gold)" opacity=".12" />
        <line x1={X(51)} x2={X(51)} y1={pad.t} y2={H - pad.b} stroke="var(--gold)" strokeWidth="1.5" />
        <text x={X(51) + 6} y={pad.t + 12} className="axis strong">
          menopause ≈ 51
        </text>
        {showB && <path d={area(b, a)} fill="url(#fut-gap)" />}
        <path d={path(a)} fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeDasharray="5 5" />
        {showB && <path d={path(b)} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" className="lens-draw" />}
        {/* scrubber */}
        <line x1={X(age)} x2={X(age)} y1={pad.t} y2={H - pad.b} stroke="var(--accent)" strokeWidth="1.5" />
        <circle cx={X(age)} cy={Y(val(A, dim))} r={5} fill="var(--bg-2)" stroke="var(--fg-3)" strokeWidth="2" />
        {showB && <circle cx={X(age)} cy={Y(val(B, dim))} r={6} fill="var(--accent)" />}
        <g transform={`translate(${X(age)}, ${H - pad.b})`}>
          <rect x={-22} y={-2} width={44} height={22} rx={11} fill="var(--accent)" />
          <text x={0} y={13} textAnchor="middle" className="axis inv">
            {Math.round(age)}
          </text>
        </g>
      </svg>
    </div>
  );
}
