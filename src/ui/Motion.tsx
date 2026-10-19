"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNear, useVisible, useReducedMotion } from "../lib/hooks";

/* =====================================================================
   Motion primitives: NumberTicker, MorphingText, Text3DFlip,
   LayoutTextFlip, CircularProgress, ShineBorder, AnimatedList,
   Reveal (skeleton → content).
   ===================================================================== */

/* ----------------------------- NumberTicker ----------------------------- */
export function NumberTicker({
  value,
  decimals = 0,
  duration = 1.8,
  prefix = "",
  suffix = "",
  className,
  startOnView = true,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  startOnView?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const vis = useVisible(ref, "-10% 0px");
  const reduce = useReducedMotion();
  const from = useRef(0);
  const [v, setV] = useState(startOnView ? 0 : value);
  useEffect(() => {
    if (startOnView && !vis) return;
    if (reduce) {
      setV(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const e = 1 - Math.pow(1 - t, 4); // easeOutQuart
      const cur = a + (value - a) * e;
      setV(cur);
      if (t < 1) raf = requestAnimationFrame(loop);
      else from.current = value;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value, vis, duration, reduce, startOnView]);
  return (
    <span ref={ref} className={`tnum ${className ?? ""}`}>
      {prefix}
      {v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ------------------------------ MorphingText ----------------------------- */
/* Two layers cross-fade through a deepening blur, so one word seems to
   dissolve into the next. */
export function MorphingText({ words, interval = 2600, className }: { words: string[]; interval?: number; className?: string }) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduce) {
      const t = setInterval(() => setIdx((i) => (i + 1) % words.length), interval);
      return () => clearInterval(t);
    }
    let raf = 0;
    let i = 0;
    let t0 = performance.now();
    const morphTime = 1.1;
    const loop = (now: number) => {
      const el1 = a.current;
      const el2 = b.current;
      if (!el1 || !el2) return;
      const elapsed = (now - t0) / 1000;
      const hold = interval / 1000 - morphTime;
      if (elapsed < hold) {
        el1.textContent = words[i % words.length];
        el1.style.filter = "";
        el1.style.opacity = "1";
        el2.style.opacity = "0";
      } else {
        const f = Math.min(1, (elapsed - hold) / morphTime);
        el1.textContent = words[i % words.length];
        el2.textContent = words[(i + 1) % words.length];
        el2.style.filter = `blur(${Math.min(8 / (f + 0.0001) - 8, 24)}px)`;
        el2.style.opacity = `${Math.pow(f, 0.4) * 100}%`;
        const inv = 1 - f;
        el1.style.filter = `blur(${Math.min(8 / (inv + 0.0001) - 8, 24)}px)`;
        el1.style.opacity = `${Math.pow(inv, 0.4) * 100}%`;
        if (f >= 1) {
          i++;
          t0 = now;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [words, interval, reduce]);
  if (reduce) return <span className={className}>{words[idx]}</span>;
  return (
    <span className={`morph ${className ?? ""}`}>
      <span className="morph-stage" aria-hidden="true">
        <span ref={a} className="morph-word" />
        <span ref={b} className="morph-word" />
      </span>
      <span className="sr-only">{words.join(", ")}</span>
    </span>
  );
}

/* ------------------------------- Text3DFlip ------------------------------ */
export function Text3DFlip({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`flip3d ${className ?? ""}`} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="flip3d-ch" style={{ "--i": i } as CSSProperties} aria-hidden="true">
          <span className="f">{ch === " " ? " " : ch}</span>
          <span className="b">{ch === " " ? " " : ch}</span>
        </span>
      ))}
    </span>
  );
}

/* ----------------------------- LayoutTextFlip ---------------------------- */
/* The changing word sits in a glass pill; the pill's width springs to the
   new word so the surrounding sentence re-flows smoothly. */
export function LayoutTextFlip({ before, words, after, interval = 2200 }: { before?: string; words: string[]; after?: string; interval?: number }) {
  const [i, setI] = useState(0);
  const [w, setW] = useState<number | undefined>();
  const measure = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  useLayoutEffect(() => {
    if (measure.current) setW(measure.current.offsetWidth);
  }, [i]);
  return (
    <span className="ltf">
      {before && <span>{before} </span>}
      <span className="ltf-pill glass-thin" style={{ width: w ? w + 28 : undefined }}>
        <span ref={measure} className="ltf-measure" aria-hidden="true">
          {words[i]}
        </span>
        <span key={i} className="ltf-word">
          {words[i]}
        </span>
      </span>
      {after && <span> {after}</span>}
    </span>
  );
}

/* ---------------------------- CircularProgress --------------------------- */
export function CircularProgress({
  value,
  max = 100,
  size = 180,
  stroke = 12,
  label,
  sub,
  gradientId = "cp-grad",
  colors = ["#8A5A77", "#A86F8E", "#EAA6BC"],
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sub?: ReactNode;
  gradientId?: string;
  colors?: string[];
  children?: ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const vis = useVisible(ref);
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  useEffect(() => {
    if (!vis) return;
    // time-based (not frame-based) so it lands on time even at low frame rates;
    // easeOutBack gives a small physical overshoot
    let raf = 0;
    const from = shownRef.current;
    const t0 = performance.now();
    const dur = 1100;
    const ease = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    const loop = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const v = from + (value - from) * ease(t);
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value, vis]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, shown / max));
  return (
    <div className="cprog" style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={typeof label === "string" ? label : undefined}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {colors.map((c2, i) => (
              <stop key={i} offset={i / (colors.length - 1)} stopColor={c2} />
            ))}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: "drop-shadow(0 0 8px rgba(var(--glow), .55))" }}
        />
      </svg>
      <div className="cprog-c">
        {children ?? (
          <>
            <div className="cprog-v tnum">{label ?? Math.round(shown)}</div>
            {sub && <div className="cprog-s">{sub}</div>}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- ShineBorder ----------------------------- */
export function ShineBorder({ children, className, radius = 999, as = "div" }: { children: ReactNode; className?: string; radius?: number; as?: "div" | "span" }) {
  const Tag = as;
  return (
    <Tag className={`shine ${className ?? ""}`} style={{ borderRadius: radius }}>
      {children}
    </Tag>
  );
}

/* ------------------------------- AnimatedList ---------------------------- */
export function AnimatedList<T extends { id: string }>({
  items,
  render,
  max = 6,
  className,
}: {
  items: T[];
  render: (item: T, i: number) => ReactNode;
  max?: number;
  className?: string;
}) {
  return (
    <ul className={`alist ${className ?? ""}`}>
      {items.slice(0, max).map((it, i) => (
        <li key={it.id} className="alist-item" style={{ "--d": `${i * 40}ms` } as CSSProperties}>
          {render(it, i)}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- Reveal -------------------------------- */
/* Skeleton progressive reveal: shows a shimmering placeholder of the right
   shape until the section is near, then mounts and animates the content. */
export function Reveal({
  children,
  height = 420,
  className,
  delay = 260,
  shape = "panel",
}: {
  children: ReactNode;
  height?: number | string;
  className?: string;
  delay?: number;
  shape?: "panel" | "chart" | "orb" | "list";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNear(ref, "200px");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!near) return;
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [near, delay]);
  return (
    <div ref={ref} className={className} style={{ minHeight: ready ? undefined : height }}>
      {ready ? (
        <div className="reveal-in">{children}</div>
      ) : (
        <SkeletonShape shape={shape} height={height} />
      )}
    </div>
  );
}

export function SkeletonShape({ shape, height }: { shape: string; height: number | string }) {
  if (shape === "orb")
    return (
      <div style={{ height, display: "grid", placeItems: "center" }}>
        <div className="skeleton" style={{ width: "min(70%, 360px)", aspectRatio: "1", borderRadius: "50%" }} />
      </div>
    );
  if (shape === "list")
    return (
      <div style={{ height, display: "grid", gap: 12, alignContent: "start" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 64, borderRadius: 18, opacity: 1 - i * 0.18 }} />
        ))}
      </div>
    );
  if (shape === "chart")
    return (
      <div className="skeleton" style={{ height, display: "flex", alignItems: "end", gap: 8, padding: 24 }}>
        {Array.from({ length: 18 }, (_, i) => (
          <div key={i} style={{ flex: 1, height: `${30 + ((i * 37) % 60)}%`, borderRadius: 6, background: "color-mix(in srgb, var(--fg) 6%, transparent)" }} />
        ))}
      </div>
    );
  return <div className="skeleton" style={{ height }} />;
}
