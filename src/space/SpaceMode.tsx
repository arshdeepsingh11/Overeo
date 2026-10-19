"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore, store, updateProfile, openSI, toast } from "../core/store";
import { useDerived } from "../core/derived";
import { withTodayLog, latest } from "../core/persona";
import { PHASE_META, metricSeries } from "../core/engines/forecast";
import { levelLabel } from "../core/engines/signals";
import { LEVERS } from "../core/engines/futures";
import { narrateProfileChange } from "../core/insights";
import { fmtDate, addDays } from "../core/rng";
import { CircularProgress, AnimatedList } from "../ui/Motion";
import { Icon } from "../ui/Icon";
import { Orb } from "../si/Orb";
import { attachGestures } from "../lib/gesture";
import { Spring } from "../lib/hooks";
import { tick } from "../lib/audio";

/* =====================================================================
   Space — spatial 3D dashboard. Her whole picture as glass panels on a
   curved stage. Drag/swipe or ←/→ to turn, pinch or ⌘-scroll to move
   closer, click a panel to bring it forward, Esc to leave. Every panel
   is live: log today's symptoms or add a lab result and every other
   panel (and the story page) recalculates.
   ===================================================================== */

interface PanelDef {
  id: string;
  title: string;
  icon: Parameters<typeof Icon>[0]["name"];
  body: ReactNode;
}

export function SpaceMode() {
  const mode = useStore((s) => s.mode);
  if (mode !== "space") return null;
  return <Space />;
}

function Space() {
  const d = useDerived();
  const tasks = useStore((s) => s.agentTasks);
  const insights = useStore((s) => s.insights);
  const levers = useStore((s) => s.levers);
  const reduce = useStore((s) => s.reducedMotion);
  const [flat, setFlat] = useState(() => innerWidth < 720 || reduce);
  const [focus, setFocus] = useState(0);
  const scene = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const angle = useRef(new Spring(0, 90, 18));
  const zoom = useRef(new Spring(0, 120, 20));
  const [docPanel, setDocPanel] = useState(2);
  const t = d.today;
  const p = d.profile;
  const last = p.logs[p.logs.length - 1];

  const setLog = (patch: Parameters<typeof withTodayLog>[1], what: string) => {
    updateProfile((x) => ({ ...withTodayLog(x, patch), isSample: false }));
    narrateProfileChange(what);
  };

  const panels: PanelDef[] = [
    {
      id: "clock",
      title: "Ovarian Clock",
      icon: "clock",
      body: (
        <div className="sp-clock">
          <CircularProgress value={d.clock.span * 100} size={150} stroke={11} gradientId="sp-cp">
            <div className="tnum" style={{ fontSize: 36, fontWeight: 650, letterSpacing: "-0.04em" }}>
              {d.clock.markerAge}
            </div>
            <div className="faint" style={{ fontSize: 11 }}>
              marker age
            </div>
          </CircularProgress>
          <div className="small">
            <b>{d.clock.verdict}</b>
            <div className="faint">Calendar {d.clock.calendarAge} · band {d.clock.band[0]}–{d.clock.band[1]}</div>
          </div>
        </div>
      ),
    },
    {
      id: "today",
      title: "Today & forecast",
      icon: "cycle",
      body: (
        <div className="sp-today">
          <div className="sp-big">
            Day {t.cycleDay} <span className="badge">{PHASE_META[t.phase].label}</span>
          </div>
          <div className="si-phase-strip">
            {Array.from({ length: Math.round(t.meanLength) }, (_, i) => {
              const day = i + 1;
              const L = Math.round(t.meanLength);
              const ov = L - 14;
              const ph = day <= 5 ? "menstrual" : day < ov - 1 ? "follicular" : day <= ov + 1 ? "ovulatory" : "luteal";
              return <span key={i} className={day === t.cycleDay ? "today" : ""} style={{ background: PHASE_META[ph].color }} />;
            })}
          </div>
          <Spark series={metricSeries(p, "temp", 40, 20).map((s) => ({ v: s.v, f: !!s.predicted }))} />
          <div className="small">
            Next period <b>{fmtDate(t.nextStart)}</b> · in {t.daysUntil} days · ±{Math.max(1, Math.round(t.sdLength))}
          </div>
        </div>
      ),
    },
    {
      id: "signals",
      title: "Silent Signals",
      icon: "radar",
      body: (
        <div className="sp-signals">
          {d.signals.map((s) => (
            <div key={s.id} className="si-bar">
              <span className="small">{s.title}</span>
              <span className="si-bar-track">
                <span className={`si-bar-fill ${s.level}`} style={{ width: `${Math.round(s.strength * 100)}%` }} />
              </span>
              <span className="faint small">{levelLabel[s.level]}</span>
            </div>
          ))}
          <button className="btn ghost sm" onClick={() => openSI("Is this endometriosis?")}>
            <Icon name="sparkle" size={14} /> Ask SI
          </button>
        </div>
      ),
    },
    {
      id: "log",
      title: "Quick log · today",
      icon: "drop",
      body: (
        <div className="sp-log">
          <LogSlider label="Pain" value={last.pain} max={10} onChange={(v) => setLog({ pain: v }, `Pain logged ${v}/10`)} />
          <LogSlider label="Flow" value={last.flow} max={4} onChange={(v) => setLog({ flow: v }, `Flow logged ${v}/4`)} />
          <LogSlider label="Energy" value={last.energy} max={100} onChange={(v) => setLog({ energy: v }, `Energy logged ${v}`)} />
          <div className="sp-flags">
            {(
              [
                ["chestPain", "Chest discomfort"],
                ["breathless", "Breathless"],
                ["jawPain", "Jaw/arm pain"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                className={`chip ${p.redFlags[k] ? "on" : ""}`}
                onClick={() => {
                  updateProfile((x) => ({ ...x, redFlags: { ...x.redFlags, [k]: !x.redFlags[k] } }));
                  narrateProfileChange(`${label} ${p.redFlags[k] ? "cleared" : "logged"}`);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="faint small">Chest symptoms with breathlessness or jaw pain raise an urgent banner — try it.</span>
        </div>
      ),
    },
    {
      id: "labs",
      title: "Biomarkers",
      icon: "flask",
      body: (
        <div className="sp-labs">
          {p.labs.slice(0, 5).map((l) => {
            const v = latest(l).value;
            const low = v < l.range[0];
            return (
              <div key={l.key} className="sp-lab">
                <span className="small">{l.name}</span>
                <Spark series={l.points.map((x) => ({ v: x.value, f: false }))} w={70} h={22} />
                <span className={`mono small ${low ? "signal-t" : ""}`}>
                  {v} {l.unit}
                </span>
              </div>
            );
          })}
          <button
            className="btn ghost sm"
            onClick={() => {
              updateProfile((x) => ({
                ...x,
                isSample: false,
                labs: x.labs.map((l) =>
                  l.key === "ferritin" ? { ...l, points: [...l.points, { date: addDays(x.today, 0), value: Math.max(5, latest(l).value + 14) }] } : l,
                ),
              }));
              narrateProfileChange("New ferritin result added (+14 after iron treatment)");
              toast("Added a new ferritin result — watch the iron signal fall");
            }}
          >
            <Icon name="plus" size={14} /> Add ferritin after treatment
          </button>
        </div>
      ),
    },
    {
      id: "future",
      title: "Future Self",
      icon: "trend",
      body: (
        <div className="sp-future">
          <TwoLines a={d.futures.a.map((x) => (x.bone + x.heart + x.energy) / 3)} b={d.futures.b.map((x) => (x.bone + x.heart + x.energy) / 3)} />
          <div className="small">
            Healthspan index ≥60 until <b>{d.futures.healthspanA}</b> → <b className="grad-text">{d.futures.healthspanB >= 80 ? "80+" : d.futures.healthspanB}</b>
          </div>
          <div className="sp-levers">
            {LEVERS.slice(0, 4).map((l) => (
              <button key={l.key} className={`chip ${levers[l.key] ? "on" : ""}`} onClick={() => store.set((s) => ({ levers: { ...s.levers, [l.key]: !s.levers[l.key] } }))}>
                {l.label.split(" ")[0]} {l.label.split(" ")[1] ?? ""}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "agent",
      title: "Agent tasks",
      icon: "bolt",
      body:
        tasks.length === 0 ? (
          <div className="empty-smart">
            <Orb state="idle" size={56} />
            <span className="small muted">No tasks yet. SI suggests: repeat ferritin, a virtual visit for the pain pattern, and a 90-day retest.</span>
            <button
              className="btn sm"
              onClick={() => {
                store.set({ mode: "story" });
                setTimeout(() => {
                  document.getElementById("agent")?.scrollIntoView({ behavior: "smooth" });
                }, 50);
              }}
            >
              Draft the plan
            </button>
          </div>
        ) : (
          <div>
            {tasks.map((x) => (
              <div key={x.id} className="task">
                <span className={`task-dot ${x.status}`} />
                <span className="small">{x.title}</span>
                <span className="faint small">{x.when}</span>
              </div>
            ))}
          </div>
        ),
    },
    {
      id: "team",
      title: "Care team · live",
      icon: "users",
      body: (
        <div className="sp-team">
          {[
            ["FH", "Dr. Hasan", "Endocrinology · viewing Signals", 340],
            ["NV", "NEYU Virtual Care", "Nurse navigator · online", 20],
            [p.name.slice(0, 2).toUpperCase(), p.name, "You", 300],
          ].map(([i, n, r, h]) => (
            <div key={n as string} className="sp-person">
              <span className="avatar" style={{ ["--h" as string]: h as number }}>
                {i}
              </span>
              <span>
                <b className="small">{n}</b>
                <span className="faint small"> · {r}</span>
              </span>
              <span className="live-dot" />
            </div>
          ))}
          <span className="faint small">Simulated presence. Open this page in two tabs to see real live cursors.</span>
        </div>
      ),
    },
    {
      id: "insights",
      title: "SI Live",
      icon: "sparkle",
      body: (
        <AnimatedList
          items={insights}
          max={4}
          render={(it) => (
            <div className="sp-insight small">
              <span className="badge">{it.tag}</span> {it.text}
            </div>
          )}
        />
      ),
    },
  ];
  const N = panels.length;
  const STEP = 360 / N;

  // render loop for the spatial ring
  useEffect(() => {
    if (flat) return;
    const r = ring.current;
    const sc = scene.current;
    if (!r || !sc) return;
    let raf = 0;
    let last = performance.now();
    const R = () => Math.max(520, Math.min(980, innerWidth * 0.62));
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const a = angle.current.step(dt);
      const z = zoom.current.step(dt);
      r.style.transform = `translateZ(${-R() - 260 + z}px) rotateX(-6deg) rotateY(${-a}deg)`;
      const items = r.children;
      for (let i = 0; i < items.length; i++) {
        const el = items[i] as HTMLElement;
        let rel = ((i * STEP - a) % 360 + 540) % 360 - 180;
        const ar = Math.abs(rel);
        el.style.opacity = String(ar > 100 ? 0 : 1 - ar / 140);
        el.style.pointerEvents = ar > 70 ? "none" : "auto";
        el.style.filter = ar > 30 ? `blur(${Math.min(4, (ar - 30) / 15)}px) saturate(.8)` : "none";
      }
      const f = Math.round((((a / STEP) % N) + N) % N);
      setFocus((x) => (x === f ? x : f));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let base = 0;
    const off = attachGestures(sc, {
      onDragStart: () => (base = angle.current.target),
      onDrag: (dx) => {
        base -= dx * 0.12;
        angle.current.target = base;
      },
      onDragEnd: (vx) => {
        const t = angle.current.target - vx * 0.8;
        angle.current.target = Math.round(t / STEP) * STEP;
      },
      onPinch: (s) => (zoom.current.target = Math.max(-300, Math.min(420, zoom.current.target + (s - 1) * 900))),
      onWheel: (dx, dy, ctrl, e) => {
        e.preventDefault();
        if (ctrl) zoom.current.target = Math.max(-300, Math.min(420, zoom.current.target - dy * 2));
        else {
          angle.current.target += (Math.abs(dx) > Math.abs(dy) ? dx : dy) * 0.08;
          clearTimeout((sc as unknown as { _snap?: number })._snap);
          (sc as unknown as { _snap?: number })._snap = window.setTimeout(() => (angle.current.target = Math.round(angle.current.target / STEP) * STEP), 160);
        }
      },
    });
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") angle.current.target = (Math.round(angle.current.target / STEP) + 1) * STEP;
      if (e.key === "ArrowLeft") angle.current.target = (Math.round(angle.current.target / STEP) - 1) * STEP;
    };
    addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      off();
      removeEventListener("keydown", key);
    };
  }, [flat, N, STEP]);

  // simulated clinician wandering between panels
  useEffect(() => {
    const id = setInterval(() => setDocPanel((x) => (x + 1 + Math.floor(Math.random() * 3)) % N), 5200);
    return () => clearInterval(id);
  }, [N]);

  const goTo = (i: number) => {
    tick(1300);
    const cur = angle.current.target;
    const k = Math.round((cur - i * STEP) / 360);
    angle.current.target = i * STEP + k * 360;
  };

  return (
    <div className="space" role="dialog" aria-modal="true" aria-label="Space — spatial dashboard">
      <div className="space-floor" aria-hidden="true" />
      <header className="space-head">
        <div className="space-title">
          <Icon name="cube" size={20} />
          <b>Space</b>
          <span className="faint small">
            {p.name}
            {p.isSample ? " · sample" : ""} · {flat ? "grid" : "drag · pinch · ←/→"}
          </span>
        </div>
        <div className="space-actions">
          <div className="seg glass-thin">
            <button className={`chip ${!flat ? "on" : ""}`} onClick={() => setFlat(false)}>
              Spatial
            </button>
            <button className={`chip ${flat ? "on" : ""}`} onClick={() => setFlat(true)}>
              Grid
            </button>
          </div>
          <button className="btn ghost sm" onClick={() => openSI()}>
            <Icon name="sparkle" size={15} /> SI
          </button>
          <button className="si-close" onClick={() => store.set({ mode: "story" })} aria-label="Leave Space (Esc)">
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>

      {flat ? (
        <div className="space-grid">
          {panels.map((pl, i) => (
            <Panel key={pl.id} pl={pl} focused={false} doc={i === docPanel} />
          ))}
        </div>
      ) : (
        <div ref={scene} className="space-scene">
          <div ref={ring} className="space-ring">
            {panels.map((pl, i) => (
              <div
                key={pl.id}
                className="space-slot"
                style={{ transform: `rotateY(${i * STEP}deg) translateZ(${Math.max(520, Math.min(980, innerWidth * 0.62))}px)` }}
                onClick={() => i !== focus && goTo(i)}
              >
                <Panel pl={pl} focused={i === focus} doc={i === docPanel} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!flat && (
        <nav className="space-index glass-thin" aria-label="Panels">
          {panels.map((pl, i) => (
            <button key={pl.id} className={i === focus ? "on" : ""} onClick={() => goTo(i)} aria-label={pl.title} title={pl.title}>
              <Icon name={pl.icon} size={16} />
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function Panel({ pl, focused, doc }: { pl: PanelDef; focused: boolean; doc: boolean }) {
  return (
    <section className={`glass holo sp-panel ${focused ? "focused" : ""} ${doc ? "doc" : ""}`} aria-label={pl.title}>
      <header className="sp-ph">
        <Icon name={pl.icon} size={17} />
        <b>{pl.title}</b>
        {doc && (
          <span className="doc-tag">
            <span className="avatar xs" style={{ ["--h" as string]: 340 }}>
              FH
            </span>{" "}
            Dr. Hasan is here
          </span>
        )}
      </header>
      <div className="sp-pb">{pl.body}</div>
      {doc && <span className="doc-cursor" aria-hidden="true" />}
    </section>
  );
}

function LogSlider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span className="slider-top">
        <span className="small">{label}</span>
        <span className="mono small">
          {value}/{max}
        </span>
      </span>
      <input type="range" className="range" min={0} max={max} step={1} value={value} style={{ ["--p" as string]: `${(value / max) * 100}%` }} onChange={(e) => onChange(parseInt(e.target.value, 10))} aria-label={label} />
    </label>
  );
}

function Spark({ series, w = 240, h = 46 }: { series: { v: number; f: boolean }[]; w?: number; h?: number }) {
  const vs = series.map((s) => s.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const X = (i: number) => (i / Math.max(1, series.length - 1)) * w;
  const Y = (v: number) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6);
  const past = series.filter((s) => !s.f);
  const fi = past.length - 1;
  return (
    <svg width={w} height={h} className="spark" aria-hidden="true">
      <path d={past.map((s, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(s.v).toFixed(1)}`).join("")} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      {series.length > past.length && (
        <path
          d={series
            .slice(fi)
            .map((s, i) => `${i ? "L" : "M"}${X(fi + i).toFixed(1)},${Y(s.v).toFixed(1)}`)
            .join("")}
          fill="none"
          stroke="var(--accent-2)"
          strokeWidth="1.6"
          strokeDasharray="3 3"
        />
      )}
    </svg>
  );
}

function TwoLines({ a, b }: { a: number[]; b: number[] }) {
  const w = 260;
  const h = 70;
  const X = (i: number) => (i / (a.length - 1)) * w;
  const Y = (v: number) => h - ((v - 30) / 70) * h;
  const p = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path d={p(a)} fill="none" stroke="var(--fg-3)" strokeDasharray="4 4" strokeWidth="1.6" />
      <path d={p(b)} fill="none" stroke="var(--accent)" strokeWidth="2.4" />
    </svg>
  );
}
