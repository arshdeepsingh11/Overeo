"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { useVisible } from "../lib/hooks";
import { openSI } from "../core/store";

/* ------------------------------------------------------------------ *
 * Focused 3D Marquee — physical 3D app icons drift across a central
 * lens. Icons scale and turn toward you as they cross the lens.
 *
 * Hover (or tap) an icon and the stream glides to a stop and an info
 * card opens under it — it stays put while you read, and you can move
 * into the card to use its links. Leave both and the stream drifts on.
 * ------------------------------------------------------------------ */

export interface MarqueeIcon {
  id: string;
  icon: IconName;
  label: string;
  hue: number;
  ask: string;
}

const CRUISE = 60;
const SLOW = 8;

export function Marquee3D({ icons, renderInfo }: { icons: MarqueeIcon[]; renderInfo?: (id: string, close: () => void) => ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const vis = useVisible(track, "60px");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const st = useRef({ x: 0, speed: CRUISE, target: CRUISE, hover: false, active: -1, pinned: false, holdUntil: 0 });
  const closeT = useRef(0);

  const open = (id: string, pinned = false) => {
    clearTimeout(closeT.current);
    if (pop.current && st.current.active !== icons.findIndex((x) => x.id === id)) delete pop.current.dataset.fit;
    const i = icons.findIndex((x) => x.id === id);
    st.current.active = i;
    st.current.pinned = pinned;
    st.current.target = 0;
    setActive(id);
  };
  const close = () => {
    clearTimeout(closeT.current);
    if (pop.current) delete pop.current.dataset.fit;
    st.current.active = -1;
    st.current.pinned = false;
    st.current.target = st.current.hover ? SLOW : CRUISE;
    setActive(null);
  };
  const closeSoon = () => {
    // the page is easing to make room for the card — boundary events then aren't the user leaving
    if (st.current.pinned || performance.now() < st.current.holdUntil) return;
    clearTimeout(closeT.current);
    closeT.current = window.setTimeout(close, 650);
  };

  useEffect(() => {
    if (!vis) return;
    const el = track.current;
    const host = wrap.current;
    if (!el || !host) return;
    const nodes = [...el.querySelectorAll<HTMLElement>(".mq-item")];
    const GAP = innerWidth < 640 ? 100 : 112;
    const total = nodes.length * GAP;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = st.current;
      // stop quickly and completely when a card is open, so it can be read
      s.speed += (s.target - s.speed) * Math.min(1, dt * (s.target === 0 ? 7 : 4));
      if (s.target === 0 && Math.abs(s.speed) < 3) s.speed = 0;
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
        const lift = s.active === i ? 0.12 : 0;
        const scale = 1 + 0.75 * Math.max(0, 1 - ad * 1.6) ** 2 + lift;
        const rot = s.active === i ? 0 : Math.max(-62, Math.min(62, d * 70));
        const z = -ad * 160;
        n.style.transform = `translate3d(${px - 40}px, -50%, ${z}px) rotateY(${-rot}deg) scale(${scale})`;
        n.style.opacity = String(s.active === i ? 1 : Math.max(0, 1 - ad * 0.85));
        n.style.filter = ad > 0.5 && s.active !== i ? `blur(${((ad - 0.5) * 3).toFixed(1)}px)` : "none";
        n.style.zIndex = String(s.active === i ? 200 : 100 - Math.round(ad * 100));
        if (Math.abs(px - cx) < bestD) {
          bestD = Math.abs(px - cx);
          best = i;
        }
      });
      // keep the card pinned to its icon while the stream settles — it opens
      // upward over the hero; if there isn't room above, it drops below
      if (s.active >= 0 && pop.current) {
        const ic = (nodes[s.active].querySelector(".mq-icon") ?? nodes[s.active]).getBoundingClientRect();
        const lab = nodes[s.active].getBoundingClientRect();
        const h = host.getBoundingClientRect();
        const pw = pop.current.offsetWidth;
        const ph = pop.current.offsetHeight;
        const left = Math.max(8, Math.min(h.width - pw - 8, ic.left - h.left + ic.width / 2 - pw / 2));
        // always open upward: if there isn't room, ease the page down once so there is
        let up = ic.top - ph - 14 > 64;
        if (!up && pop.current.dataset.fit !== "1") {
          pop.current.dataset.fit = "1";
          const need = ph + 14 + 72 - ic.top;
          if (scrollY >= need) {
            s.holdUntil = performance.now() + 1200;
            scrollBy({ top: -need, behavior: "smooth" });
            up = true;
          }
        }
        if (pop.current.dataset.fit === "1" && scrollY > 0) up = true;
        const top = up ? ic.top - h.top - ph - 14 : lab.bottom - h.top + 10;
        pop.current.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
        pop.current.style.setProperty("--ax", `${(ic.left - h.left + ic.width / 2 - left).toFixed(1)}px`);
        if (pop.current.dataset.side !== (up ? "up" : "down")) pop.current.dataset.side = up ? "up" : "down";
      }
      const id = s.active >= 0 ? icons[s.active].id : s.hover && best >= 0 ? icons[best].id : null;
      setFocusId((f) => (f === id ? f : id));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vis, icons]);

  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    addEventListener("keydown", key);
    addEventListener("pointerdown", away);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("pointerdown", away);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div ref={wrap} className={`mq-wrap ${active ? "has-pop" : ""}`}>
      <div
        className="mq"
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          st.current.hover = true;
          if (st.current.active < 0) st.current.target = SLOW;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          st.current.hover = false;
          if (st.current.active < 0) st.current.target = CRUISE;
        }}
      >
        <div className="mq-lens" aria-hidden="true" />
        <div ref={track} className="mq-track" role="list" aria-label="What OVEREO reads">
          {icons.map((it) => (
            <button
              key={it.id}
              role="listitem"
              className={`mq-item ${focusId === it.id ? "focus" : ""} ${active === it.id ? "on" : ""}`}
              style={{ "--h": it.hue } as CSSProperties}
              aria-expanded={renderInfo ? active === it.id : undefined}
              aria-label={renderInfo ? `${it.label} — show details` : `${it.label} — ask Overeo SI`}
              onPointerMove={(e) => {
                // real movement only — a page scrolling under a resting cursor doesn't open cards
                if (e.pointerType !== "mouse" || !renderInfo || st.current.pinned) return;
                // still on the open icon: keep its card open
                if (active === it.id) return clearTimeout(closeT.current);
                if (e.movementX === 0 && e.movementY === 0) return;
                open(it.id);
              }}
              onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
              onFocus={(e) => renderInfo && e.currentTarget.matches(":focus-visible") && open(it.id)}
              onClick={() => {
                if (!renderInfo) return openSI(it.ask);
                if (active === it.id && st.current.pinned) close();
                else open(it.id, true);
              }}
            >
              <span className="mq-icon">
                <Icon name={it.icon} size={34} stroke={1.6} />
              </span>
              <span className="mq-label">{it.label}</span>
            </button>
          ))}
        </div>
      </div>
      {renderInfo && (
        <div
          ref={pop}
          className={`mq-pop ${active ? "open" : ""}`}
          role="dialog"
          aria-hidden={!active}
          aria-label={active ? `${icons.find((x) => x.id === active)?.label} details` : undefined}
          onPointerEnter={() => clearTimeout(closeT.current)}
          onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
        >
          {active && renderInfo(active, close)}
        </div>
      )}
    </div>
  );
}
