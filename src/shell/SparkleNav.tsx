"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { gsap } from "../lib/gsap";
import { useStore } from "../core/store";

/* =====================================================================
   Sparkle Navbar — a calm, professional navigation bar.

   Items never move on hover. The active item carries a glowing
   strike-through line that glides to whichever item becomes active
   (GSAP), throwing off a few sparks as it lands. Colours are themable
   (--sn-a / --sn-b), and it respects reduced motion.
   ===================================================================== */

export interface SparkleItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** opens something (a menu) rather than navigating */
  toggle?: boolean;
}

export function SparkleNav({
  items,
  active,
  trailing,
  colors,
  label = "Main",
}: {
  items: SparkleItem[];
  active: string | null;
  trailing?: ReactNode;
  colors?: { a: string; b: string };
  label?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const reduce = useStore((s) => s.reducedMotion);

  const place = (animate: boolean) => {
    const host = root.current;
    const el = host?.querySelector<HTMLElement>(`[data-sn="${active}"] .sn-label`);
    if (!host || !line.current || !glow.current) return;
    if (!el) {
      gsap.to([line.current, glow.current], { opacity: 0, duration: 0.25 });
      return;
    }
    const h = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = r.left - h.left - 4;
    const w = r.width + 8;
    const y = r.top - h.top + r.height / 2;
    const dur = animate && !reduce ? 0.6 : 0;
    gsap.to(line.current, { x, y, width: w, opacity: 1, duration: dur, ease: "power3.out" });
    gsap.to(glow.current, { x: x - 10, y: y - 14, width: w + 20, opacity: 1, duration: dur, ease: "power3.out" });
    if (animate && !reduce) sparks(host, x + w / 2, y, w);
  };

  useLayoutEffect(() => {
    place(!first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items.length]);

  useEffect(() => {
    const ro = new ResizeObserver(() => place(false));
    if (root.current) ro.observe(root.current);
    document.fonts?.ready.then(() => place(false));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <nav className="snav-wrap" aria-label={label}>
      <div ref={root} className="snav" style={colors ? ({ "--sn-a": colors.a, "--sn-b": colors.b } as CSSProperties) : undefined}>
        <span ref={glow} className="sn-glow" aria-hidden="true" />
        <span ref={line} className="sn-line" aria-hidden="true" />
        <ul className="sn-list">
          {items.map((it) => (
            <li key={it.id}>
              <button
                data-sn={it.id}
                className={`sn-item ${active === it.id ? "on" : ""}`}
                aria-current={active === it.id && !it.toggle ? "page" : undefined}
                aria-expanded={it.toggle ? active === it.id : undefined}
                onClick={it.onSelect}
              >
                {it.icon}
                <span className="sn-label">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {trailing && <div className="sn-trail">{trailing}</div>}
      </div>
    </nav>
  );
}

/** A small burst of sparks along the strike-through line. */
function sparks(host: HTMLElement, cx: number, cy: number, w: number) {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "sn-spark";
    host.appendChild(s);
    const sx = cx + (Math.random() - 0.5) * w;
    gsap.set(s, { x: sx, y: cy, scale: 0.4 + Math.random() * 0.8, opacity: 1 });
    gsap.to(s, {
      x: sx + (Math.random() - 0.5) * 36,
      y: cy + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 16),
      opacity: 0,
      scale: 0,
      duration: 0.55 + Math.random() * 0.35,
      ease: "power2.out",
      delay: 0.12 + Math.random() * 0.12,
      onComplete: () => s.remove(),
    });
  }
}
