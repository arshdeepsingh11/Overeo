"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollTrigger } from "../lib/gsap";
import { attachGestures } from "../lib/gesture";
import { Spring } from "../lib/hooks";
import { useStore } from "../core/store";
import { tick } from "../lib/audio";

/* ------------------------------------------------------------------ *
 * 3D Cards Carousel — scroll-driven coverflow with high-fidelity
 * perspective. Scrolling through the section moves the active card;
 * swipe, drag, arrow keys or a click take over at any time. A spring
 * carries the position so every move feels physical.
 * ------------------------------------------------------------------ */

export function Coverflow<T extends { id: string; title: string }>({ items, render }: { items: T[]; render: (it: T, active: boolean) => ReactNode }) {
  const section = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduce = useStore((s) => s.reducedMotion);
  const [active, setActive] = useState(0);
  const pos = useRef(new Spring(0, 140, 22));

  useEffect(() => {
    const sec = section.current;
    const stg = stage.current;
    if (!sec || !stg) return;
    const cards = [...stg.querySelectorAll<HTMLElement>(".cf-card")];
    const n = items.length;
    let raf = 0;
    let last = performance.now();
    let visible = false;
    const io = new IntersectionObserver((es) => (visible = es[0]?.isIntersecting ?? false), { rootMargin: "100px" });
    io.observe(stg);
    const render = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!visible) {
        raf = requestAnimationFrame(render);
        return;
      }
      const p = pos.current.step(dt);
      const w = stg.clientWidth;
      const spacing = Math.min(260, w * 0.24);
      cards.forEach((c, i) => {
        const o = i - p;
        const ao = Math.abs(o);
        const rot = Math.max(-55, Math.min(55, -o * 48));
        const x = o * spacing * (ao < 1 ? 1 : 0.62 + 0.38 / ao);
        const z = -Math.min(3, ao) * 170;
        const s = ao < 1 ? 1 + 0.08 * (1 - ao) : 1;
        c.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${rot}deg) scale(${s})`;
        c.style.zIndex = String(100 - Math.round(ao * 10));
        c.style.opacity = String(ao > 3.2 ? 0 : 1 - ao * 0.12);
        c.style.filter = ao > 0.6 ? `brightness(${1 - Math.min(0.35, ao * 0.12)})` : "none";
      });
      const a = Math.round(Math.max(0, Math.min(n - 1, p)));
      setActive((x) => (x === a ? x : a));
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const trig = ScrollTrigger.create({
      trigger: sec,
      // no pinning: cards advance as the section passes through view
      start: "top 75%",
      end: "bottom 25%",
      onUpdate: (self) => {
        pos.current.target = self.progress * (n - 1);
      },
    });

    let startTarget = 0;
    const off = attachGestures(stg, {
      onDragStart: () => (startTarget = pos.current.target),
      onDrag: (dx) => {
        startTarget -= dx / 220;
        pos.current.target = Math.max(-0.3, Math.min(n - 0.7, startTarget));
      },
      onDragEnd: (vx) => {
        const t = Math.round(Math.max(0, Math.min(n - 1, pos.current.target - vx / 18)));
        pos.current.target = t;
        tick(1200);
      },
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      trig.kill();
      off();
    };
  }, [items.length, reduce]);

  const go = (i: number) => {
    pos.current.target = Math.max(0, Math.min(items.length - 1, i));
    tick(1200);
  };

  return (
    <div ref={section} className="cf-section">
      <div
        ref={stage}
        className="cf-stage"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="App screens"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(active + 1);
          if (e.key === "ArrowLeft") go(active - 1);
        }}
      >
        {items.map((it, i) => (
          <div
            key={it.id}
            className={`cf-card ${i === active ? "active" : ""}`}
            onClick={() => go(i)}
            aria-hidden={i !== active}
            aria-label={it.title}
          >
            {render(it, i === active)}
          </div>
        ))}
      </div>
      <div className="cf-dots" role="tablist">
        {items.map((it, i) => (
          <button key={it.id} role="tab" aria-selected={i === active} aria-label={it.title} className={i === active ? "on" : ""} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}
