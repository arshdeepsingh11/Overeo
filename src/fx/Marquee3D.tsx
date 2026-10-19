"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { useVisible } from "../lib/hooks";
import { openSI } from "../core/store";

/* ------------------------------------------------------------------ *
 * Focused 3D Marquee — physical 3D app icons drift across a central
 * lens. Icons scale and turn toward you as they cross the lens; hover
 * slows the stream to a near stop and focuses the closest icon into a
 * crisp central zoom. Click an icon to ask Overeo SI about it.
 * ------------------------------------------------------------------ */

export interface MarqueeIcon {
  id: string;
  icon: IconName;
  label: string;
  hue: number;
  ask: string;
}

export function Marquee3D({ icons }: { icons: MarqueeIcon[] }) {
  const track = useRef<HTMLDivElement>(null);
  const vis = useVisible(track, "60px");
  const [focusId, setFocusId] = useState<string | null>(null);
  const st = useRef({ x: 0, speed: 60, target: 60, hover: false });

  useEffect(() => {
    if (!vis) return;
    const el = track.current;
    if (!el) return;
    const nodes = [...el.querySelectorAll<HTMLElement>(".mq-item")];
    const GAP = 112;
    const total = nodes.length * GAP;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = st.current;
      s.speed += (s.target - s.speed) * Math.min(1, dt * 3.2);
      s.x = (s.x + s.speed * dt) % total;
      const w = el.clientWidth;
      const cx = w / 2;
      let best = -1;
      let bestD = Infinity;
      nodes.forEach((n, i) => {
        let x = (i * GAP - s.x) % total;
        if (x < -GAP) x += total;
        const px = x - total / 2 + cx;
        const d = (px - cx) / (w / 2); // -1..1 across the lens
        const ad = Math.min(1.4, Math.abs(d));
        const scale = 1 + 0.75 * Math.max(0, 1 - ad * 1.6) ** 2;
        const rot = Math.max(-62, Math.min(62, d * 70));
        const z = -ad * 160;
        n.style.transform = `translate3d(${px - 40}px, -50%, ${z}px) rotateY(${-rot}deg) scale(${scale})`;
        n.style.opacity = String(Math.max(0, 1 - ad * 0.85));
        n.style.filter = ad > 0.5 ? `blur(${((ad - 0.5) * 3).toFixed(1)}px)` : "none";
        n.style.zIndex = String(100 - Math.round(ad * 100));
        if (Math.abs(px - cx) < bestD) {
          bestD = Math.abs(px - cx);
          best = i;
        }
      });
      const id = s.hover && best >= 0 ? icons[best].id : null;
      setFocusId((f) => (f === id ? f : id));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vis, icons]);

  return (
    <div
      className="mq"
      onPointerEnter={() => {
        st.current.hover = true;
        st.current.target = 6;
      }}
      onPointerLeave={() => {
        st.current.hover = false;
        st.current.target = 60;
      }}
    >
      <div className="mq-lens" aria-hidden="true" />
      <div ref={track} className="mq-track" role="list" aria-label="What OVEREO reads">
        {icons.map((it) => (
          <button
            key={it.id}
            role="listitem"
            className={`mq-item ${focusId === it.id ? "focus" : ""}`}
            style={{ "--h": it.hue } as CSSProperties}
            onClick={() => openSI(it.ask)}
            aria-label={`${it.label} — ask Overeo SI`}
          >
            <span className="mq-icon">
              <Icon name={it.icon} size={34} stroke={1.6} />
            </span>
            <span className="mq-label">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
