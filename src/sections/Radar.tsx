"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDerived } from "../core/derived";
import { useStore, openSI, store, toast, updateProfile } from "../core/store";
import { ownCommand, run } from "../core/bus";
import { levelLabel, type Signal } from "../core/engines/signals";
import { useVisible } from "../lib/hooks";
import { Printer, type DossierLine } from "../fx/Printer";
import { Icon } from "../ui/Icon";
import { fmtFull, fmtDate } from "../core/rng";
import { latest } from "../core/persona";

/* ------------------------------------------------------------------ *
 * Silent Signal Radar. A sweeping scope places each pattern by
 * strength — the stronger it is, the closer to the centre. Hover or
 * select a blip for its predictive overlay; print a doctor-ready
 * dossier on a physical printer and tear it off.
 * ------------------------------------------------------------------ */

export function Radar() {
  const d = useDerived();
  const [sel, setSel] = useState<string | null>(null);
  const [job, setJob] = useState(0);
  const printerRef = useRef<HTMLDivElement>(null);
  const signals = d.signals;
  const active = signals.find((s) => s.id === sel) ?? signals[0];
  const urgent = signals.find((s) => s.level === "urgent");

  useEffect(
    () =>
      ownCommand("print-dossier", () => {
        {
          setTimeout(() => {
            printerRef.current?.scrollIntoView({ behavior: store.get().reducedMotion ? "auto" : "smooth", block: "center" });
            setJob((j) => j + 1);
            store.set((s) => ({ dossierCount: s.dossierCount + 1 }));
          }, 700);
        }
      }),
    [],
  );

  const dossier = useMemo(() => buildDossier(d), [d]);

  return (
    <section id="radar" className="section radar">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> Silent Signals
          </span>
          <h2 className="title-lg">
            What's easy to miss in one visit is <span className="serif grad-text">obvious</span> across six months.
          </h2>
          <p className="lede">The radar reads every entry for patterns that research shows are recognised late in women — and routes each to a person, not a pamphlet.</p>
        </div>

        {urgent && (
          <div className="urgent glass" role="alert">
            <Icon name="heart" size={22} />
            <div>
              <b>{urgent.title} — {urgent.short}.</b> {urgent.context}
            </div>
            <button className="btn ghost sm" onClick={() => updateProfile((p) => ({ ...p, redFlags: { chestPain: false, breathless: false, jawPain: false } }))}>
              Clear flag
            </button>
          </div>
        )}

        <div className="radar-grid">
          <div className="glass radar-scope-card">
            <Scope signals={signals} selected={active?.id ?? null} onSelect={setSel} />
            <div className="scope-legend small faint">Closer to centre = more consistent pattern · sweep = continuous reading</div>
          </div>

          <div className="radar-list">
            {signals.map((s) => (
              <button key={s.id} className={`glass sig-card ${active?.id === s.id ? "on" : ""}`} onClick={() => setSel(s.id)} aria-pressed={active?.id === s.id}>
                <div className="sig-top">
                  <span className={`sig-dot ${s.level}`} />
                  <b>{s.title}</b>
                  <span className={`badge ${s.level === "strong" || s.level === "urgent" ? "signal" : ""}`}>{levelLabel[s.level]}</span>
                </div>
                <div className="sig-bar">
                  <span className={`sig-fill ${s.level}`} style={{ width: `${Math.round(s.strength * 100)}%` }} />
                </div>
                <div className="small muted">{s.short}</div>
              </button>
            ))}
          </div>
        </div>

        {active && (
          <div className="glass sig-detail" key={active.id}>
            <div className="sig-detail-col">
              <span className="faint small">Evidence in her entries</span>
              <ul>
                {active.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 10 }}>
                {active.context}
              </p>
            </div>
            <div className="sig-detail-col">
              <span className="faint small">Routes to</span>
              <div className="route">
                <Icon name="users" size={18} />
                <div>
                  <b>{active.route.team}</b>
                  <div className="small muted">{active.route.via}</div>
                </div>
              </div>
              {active.questions.length > 0 && (
                <>
                  <span className="faint small">Questions to bring</span>
                  {active.questions.map((q) => (
                    <div key={q} className="qline small">
                      “{q}”
                    </div>
                  ))}
                </>
              )}
              <div className="sig-actions">
                <button className="btn sm" onClick={() => run({ type: "print-dossier" })}>
                  <Icon name="printer" size={15} /> Print doctor-ready dossier
                </button>
                <button className="btn ghost sm" onClick={() => openSI(active.id === "endo" ? "Is this endometriosis?" : active.id === "iron" ? "Why is she so tired?" : active.id === "rhythm" ? "Tell me about PCOS" : "Why does sleep drop before her period?")}>
                  <Icon name="sparkle" size={15} /> Ask SI
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    run({ type: "goto", section: "agent" });
                    setTimeout(() => run({ type: "run-agent" }), 900);
                  }}
                >
                  <Icon name="bolt" size={15} /> Send to care team
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={printerRef} className="printer-wrap">
          <Printer lines={dossier} job={job} onTorn={() => toast("Dossier torn off and added to her care-team packet")} />
          {job === 0 && (
            <div className="printer-empty glass">
              <Icon name="printer" size={22} />
              <div>
                <b>Nothing printed yet.</b>
                <div className="small muted">SI can assemble her strongest patterns, evidence and questions into one page a clinician reads in a minute.</div>
              </div>
              <button className="btn sm" onClick={() => run({ type: "print-dossier" })}>
                Print it
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Scope({ signals, selected, onSelect }: { signals: Signal[]; selected: string | null; onSelect: (id: string) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const vis = useVisible(box, "60px");
  const theme = useStore((s) => s.theme);
  const [hover, setHover] = useState<string | null>(null);
  const live = useRef({ signals, selected, theme, vis, hover });
  live.current = { signals, selected, theme, vis, hover };
  const [size, setSize] = useState(420);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.min(520, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const R = size / 2 - 10;
    const cx = size / 2;
    const cy = size / 2;
    const glowAt: Record<string, number> = {};
    let raf = 0;
    let a = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const L = live.current;
      if (!L.vis) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      a = (a + dt * 1.1) % (Math.PI * 2);
      const dark = L.theme === "dark";
      const ink = dark ? "246,238,240" : "88,54,79";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      // rings + spokes
      for (let i = 1; i <= 4; i++) {
        ctx.strokeStyle = `rgba(${ink},${0.07 + i * 0.015})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2;
        ctx.strokeStyle = `rgba(${ink},0.06)`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
        ctx.stroke();
      }
      // sweep
      const g = ctx.createConicGradient ? ctx.createConicGradient(a - 0.9, cx, cy) : null;
      if (g) {
        g.addColorStop(0, "rgba(234,166,188,0)");
        g.addColorStop(0.14, dark ? "rgba(234,166,188,.28)" : "rgba(184,81,122,.18)");
        g.addColorStop(0.145, "rgba(234,166,188,0)");
        g.addColorStop(1, "rgba(234,166,188,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = dark ? "rgba(255,214,228,.85)" : "rgba(184,81,122,.75)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();

      // blips
      for (const s of L.signals) {
        const ang = (s.angle * Math.PI) / 180;
        const r = (1 - s.strength) * R * 0.85 + R * 0.1;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        let diff = (a - ang) % (Math.PI * 2);
        if (diff < 0) diff += Math.PI * 2;
        if (diff < 0.08) glowAt[s.id] = now;
        const since = (now - (glowAt[s.id] ?? 0)) / 1000;
        const glow = Math.max(0, 1 - since / 2.4);
        const isSel = L.selected === s.id || L.hover === s.id;
        const col = s.level === "urgent" ? "176,84,70" : s.level === "strong" ? (dark ? "222,160,190" : "138,90,119") : s.level === "emerging" ? (dark ? "222,190,160" : "196,160,120") : "185,130,161";
        ctx.fillStyle = `rgba(${col},${0.15 + glow * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, 10 + glow * 14 + (isSel ? 8 : 0), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${col},1)`;
        ctx.shadowColor = `rgba(${col},1)`;
        ctx.shadowBlur = 10 + glow * 18;
        ctx.beginPath();
        ctx.arc(x, y, 4 + s.strength * 3 + (isSel ? 2 : 0), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isSel) {
          ctx.strokeStyle = `rgba(${col},.9)`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.arc(x, y, 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // centre
      ctx.fillStyle = dark ? "rgba(255,214,228,.9)" : "rgba(88,54,79,.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const R = size / 2 - 10;
  const pos = (s: Signal) => {
    const ang = (s.angle * Math.PI) / 180;
    const r = (1 - s.strength) * R * 0.85 + R * 0.1;
    return { x: size / 2 + Math.cos(ang) * r, y: size / 2 + Math.sin(ang) * r };
  };
  const hs = signals.find((s) => s.id === hover);

  return (
    <div ref={box} className="scope" style={{ height: size }}>
      <canvas ref={cv} style={{ width: size, height: size }} aria-hidden="true" />
      {signals.map((s) => {
        const p = pos(s);
        return (
          <button
            key={s.id}
            className="blip-hit"
            style={{ left: p.x - 18, top: p.y - 18 }}
            onClick={() => onSelect(s.id)}
            onPointerEnter={() => setHover(s.id)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(s.id)}
            onBlur={() => setHover(null)}
            aria-label={`${s.title}: ${levelLabel[s.level]}, ${Math.round(s.strength * 100)}% consistency`}
          />
        );
      })}
      {hs && (
        <div className="blip-tip glass-thin" style={{ left: Math.min(size - 220, pos(hs).x + 16), top: pos(hs).y + 10 }}>
          <b className="small">{hs.title}</b>
          <span className="small mono">{Math.round(hs.strength * 100)}% consistency</span>
          <span className="small muted">
            <Icon name="sparkle" size={11} /> {predictText(hs)}
          </span>
        </div>
      )}
    </div>
  );
}

function predictText(s: Signal) {
  if (s.id === "endo") return "Likely to recur on days 1–3 of her next period.";
  if (s.id === "iron") return "Ferritin likely lower again at the next test unless treated.";
  if (s.id === "luteal") return "Expect shorter sleep ~5 days before her next period.";
  if (s.id === "rhythm") return "One more long cycle would strengthen this pattern.";
  return "Keep logging — the pattern sharpens with each cycle.";
}

function buildDossier(d: ReturnType<typeof useDerived>): DossierLine[] {
  const p = d.profile;
  const ferr = p.labs.find((l) => l.key === "ferritin")!;
  const L: DossierLine[] = [
    { t: "OVEREO", style: "h" },
    { t: "Doctor-ready dossier", style: "c" },
    { t: `${fmtFull(p.today)} · ${p.name}${p.isSample ? " (SAMPLE)" : ""}, ${p.age}`, style: "c" },
    { t: "", style: "rule" },
    { t: `Cycle day ${d.today.cycleDay} · avg ${d.today.meanLength}±${d.today.sdLength} d`, style: "s" },
    { t: `Next period ~${fmtDate(d.today.nextStart)}`, style: "s" },
    { t: `Ovarian Clock: ${d.clock.markerAge} (cal. ${d.clock.calendarAge})`, style: "s" },
    { t: "", style: "rule" },
    { t: "PATTERNS", style: "b" },
  ];
  d.signals
    .filter((s) => s.level !== "watch")
    .forEach((s) => {
      L.push({ t: `▲ ${s.title} — ${levelLabel[s.level]} (${Math.round(s.strength * 100)}%)`, style: "b" });
      s.evidence.forEach((e) => L.push({ t: `  · ${e}` }));
    });
  L.push({ t: "", style: "rule" }, { t: "LABS", style: "b" });
  p.labs.slice(0, 6).forEach((l) => L.push({ t: `${l.name.padEnd(18, ".")} ${latest(l).value} ${l.unit}` }));
  L.push({ t: `Ferritin trend: ${ferr.points.map((x) => x.value).join(" → ")}` });
  L.push({ t: "", style: "rule" }, { t: "QUESTIONS", style: "b" });
  d.signals
    .filter((s) => s.level !== "watch")
    .flatMap((s) => s.questions.slice(0, 2))
    .forEach((q) => L.push({ t: `□ ${q}` }));
  L.push(
    { t: "", style: "rule" },
    { t: "Educational summary of self-reported", style: "s" },
    { t: "entries and results. Not a diagnosis.", style: "s" },
    { t: "", style: "gap" },
    { t: `OVR-${p.today.getTime().toString(36).toUpperCase()}`, style: "qr" },
    { t: "Scan to open in BioEMR (demo)", style: "c" },
  );
  return L;
}
