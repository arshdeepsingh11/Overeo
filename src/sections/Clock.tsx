"use client";

import { useMemo, useRef, useState, lazy, Suspense } from "react";
import { useDerived } from "../core/derived";
import { updateProfile, openSI, useStore } from "../core/store";
import { run } from "../core/bus";
import { narrateProfileChange } from "../core/insights";
import { medianAmh } from "../core/engines/clock";
import { OVARY_FACT } from "../core/research";
import { NumberTicker, CircularProgress, SkeletonShape } from "../ui/Motion";
import { Icon } from "../ui/Icon";
import { useNear } from "../lib/hooks";
import type { Moon, PlanetType } from "../fx/PlanetSystem";

const PlanetSystem = lazy(() => import("../fx/PlanetSystem").then((m) => ({ default: m.PlanetSystem })));

/* ------------------------------------------------------------------ *
 * The Ovarian Clock — her signature view. The planet is her biology,
 * the ring is the reproductive timeline, the moons are her markers.
 * "Make it yours" edits the ONE shared profile, so every chart,
 * signal and SI answer on the page updates with it.
 * ------------------------------------------------------------------ */

let debounce = 0;
const announce = (what: string) => {
  clearTimeout(debounce);
  debounce = window.setTimeout(() => narrateProfileChange(what), 500);
};

export function Clock() {
  const d = useDerived();
  const host = useRef<HTMLDivElement>(null);
  const near = useNear(host, "500px");
  const [type, setType] = useState<PlanetType>("bloom");
  const sample = useStore((s) => s.profile.isSample);
  const c = d.clock;
  const p = d.profile;

  const moons: Moon[] = useMemo(() => {
    const e2 = p.labs.find((l) => l.key === "e2")!.points.at(-1)!.value;
    return [
      { id: "amh", label: "AMH", value: `${p.markers.amh} ng/mL`, size: 0.55 + Math.min(1, p.markers.amh / 4) * 0.9 },
      { id: "fsh", label: "FSH", value: `${p.markers.fsh} IU/L`, size: 0.5 + Math.min(1, p.markers.fsh / 20) * 0.9 },
      { id: "e2", label: "Oestradiol", value: `${e2} pg/mL`, size: 0.5 + Math.min(1, e2 / 100) * 0.8 },
      { id: "dnam", label: "DNAm age", value: `${(p.age + p.markers.epigeneticDelta).toFixed(1)} y`, size: 0.7 },
    ];
  }, [p]);

  const calSpan = Math.max(0, Math.min(1, (p.age - 15) / 36));
  const set = (fn: Parameters<typeof updateProfile>[0], what: string) => {
    updateProfile((x) => ({ ...fn(x), isSample: false }));
    announce(what);
  };

  return (
    <section id="clock" className="section clock" ref={host}>
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> Signature · The Ovarian Clock
          </span>
          <h2 className="title-lg">
            The organ that ages <span className="serif grad-text">first</span> sets the tempo for the rest.
          </h2>
          <p className="lede">
            {OVARY_FACT.text}{" "}
            <a className="faint" href={OVARY_FACT.url} target="_blank" rel="noreferrer">
              {OVARY_FACT.source}
            </a>
          </p>
        </div>

        <div className="clock-grid">
          <div className="clock-stage glass">
            {near ? (
              <Suspense fallback={<SkeletonShape shape="orb" height="100%" />}>
                <PlanetSystem type={type} span={c.span} calendarSpan={calSpan} moons={moons} />
              </Suspense>
            ) : (
              <SkeletonShape shape="orb" height="100%" />
            )}
            <div className="clock-types glass-thin" role="radiogroup" aria-label="Planet surface">
              {(["bloom", "equinox", "ember"] as PlanetType[]).map((t) => (
                <button key={t} role="radio" aria-checked={type === t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="clock-hint faint small">
              <Icon name="hand" size={14} /> Drag to spin · move to light · pinch to zoom
            </div>
          </div>

          <div className="clock-panel glass holo">
            <div className="clock-nums">
              <div>
                <span className="faint small">Marker age</span>
                <span className="clock-big grad-text">
                  <NumberTicker value={c.markerAge} decimals={1} startOnView={false} duration={0.9} />
                </span>
              </div>
              <div className="clock-vs faint">vs</div>
              <div>
                <span className="faint small">Calendar age</span>
                <span className="clock-big">{c.calendarAge}</span>
              </div>
              <CircularProgress value={c.span * 100} size={96} stroke={8} gradientId="clock-cp">
                <div className="tnum" style={{ fontWeight: 650, fontSize: 18 }}>{Math.round(c.span * 100)}%</div>
                <div className="faint" style={{ fontSize: 10 }}>of span</div>
              </CircularProgress>
            </div>
            <p className={`clock-verdict ${c.delta > 1.5 ? "ahead" : ""}`}>
              Her markers are <b>{c.verdict}</b>. Likely range {c.band[0]}–{c.band[1]}.
            </p>

            <div className="factors">
              {c.factors.map((f) => (
                <div key={f.label} className="factor">
                  <span className="factor-l">{f.label}</span>
                  <span className="factor-bar">
                    <span className={`factor-fill ${f.years >= 0 ? "pos" : "neg"}`} style={{ width: `${Math.min(100, Math.abs(f.years) * 12)}%` }} />
                  </span>
                  <span className="factor-v tnum">
                    {f.years >= 0 ? "+" : ""}
                    {f.years} y
                  </span>
                </div>
              ))}
            </div>

            <hr className="soft" />
            <div className="make-yours">
              <div className="mk-head">
                <b>Make it yours</b>
                <span className="faint small">{sample ? "Edits update the whole page" : "Your values — everything recalculated"}</span>
              </div>
              <Slider label="Age" value={p.age} min={18} max={55} step={1} unit="y" onChange={(v) => set((x) => ({ ...x, age: v }), `Age ${v}`)} />
              <Slider
                label="AMH"
                value={p.markers.amh}
                min={0.1}
                max={8}
                step={0.1}
                unit="ng/mL"
                hint={`typical at ${p.age}: ~${medianAmh(p.age).toFixed(1)}`}
                onChange={(v) => set((x) => ({ ...x, markers: { ...x.markers, amh: v } }), `AMH ${v}`)}
              />
              <Slider label="FSH (day 3)" value={p.markers.fsh} min={2} max={30} step={0.1} unit="IU/L" onChange={(v) => set((x) => ({ ...x, markers: { ...x.markers, fsh: v } }), `FSH ${v}`)} />
              <label className="mk-switch">
                <span>Early menopause in a close relative</span>
                <button
                  className="switch"
                  role="switch"
                  aria-checked={p.markers.familyEarlyMeno}
                  onClick={() => set((x) => ({ ...x, markers: { ...x.markers, familyEarlyMeno: !x.markers.familyEarlyMeno } }), "Family history updated")}
                />
              </label>
            </div>

            <div className="clock-actions">
              <button className="btn sm" onClick={() => openSI("Explain her Ovarian Clock")}>
                <Icon name="sparkle" size={15} /> Explain with SI
              </button>
              <button className="btn ghost sm" onClick={() => run({ type: "mode", value: "ar" })}>
                <Icon name="ar" size={15} /> View in AR
              </button>
              <button className="btn ghost sm" onClick={() => openSI("Should she think about egg freezing?")}>
                Egg freezing?
              </button>
            </div>
            <p className="note">
              Illustrative model for this prototype. AMH reflects egg quantity, not quality, and doesn't predict natural conception. Clinical use needs an assay-specific, validated nomogram.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <span className="slider-top">
        <span>{label}</span>
        <span className="tnum mono">
          {step < 1 ? value.toFixed(1) : value} <span className="faint">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ["--p" as string]: `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
      />
      {hint && <span className="faint small">{hint}</span>}
    </label>
  );
}
