"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../core/store";
import { tick } from "../lib/audio";

/* =====================================================================
   Orbit Ring — the ecosystem as planets around one core.

   Cards sit evenly spaced on a tilted orbit (a projected 3D ellipse),
   always facing you so text stays crisp. The card at the front is in
   focus. It drifts slowly on its own, follows your scroll a little,
   and you can drag or swipe it — it coasts with inertia, then settles
   with a spring so a card always lands front and centre.

   Performance: 2D transforms only (no blur, no 3D layers), one rAF loop
   that sleeps when off-screen, idle, or the tab is hidden.
   ===================================================================== */

const TAU = Math.PI * 2;

export function OrbitRing<T extends { id: string }>({
  items,
  render,
  center,
  onFocus,
  label = "Orbit",
}: {
  items: T[];
  render: (item: T, focused: boolean) => ReactNode;
  center?: ReactNode;
  onFocus?: (item: T) => void;
  label?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useStore((s) => s.reducedMotion);
  const [focus, setFocus] = useState(0);
  const api = useRef<{ go: (i: number) => void }>({ go: () => {} });
  const n = items.length;
  const step = TAU / n;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const st = {
      a: 0, // ring angle (rad); card i sits at a + i*step, front = 0
      v: 0, // angular velocity (rad/frame @60fps)
      target: null as number | null,
      drag: false,
      hover: false,
      idleUntil: 0,
      rx: 300,
      ry: 70,
      visible: false,
      raf: 0,
      last: 0,
      focus: -1,
      /** an explicit "go to card" ignores scroll nudges until it lands */
      until: 0,
    };

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // phones: a wider ring so the front card and its two neighbours read like a carousel
      st.rx = w < 640 ? w * 0.6 : Math.min(w * 0.42, 480);
      st.ry = Math.min(h * 0.3, st.rx * (w < 640 ? 0.3 : 0.36));
      draw();
    };

    const draw = () => {
      let best = 0;
      let bestZ = -2;
      for (let i = 0; i < n; i++) {
        const c = cards.current[i];
        if (!c) continue;
        const t = st.a + i * step;
        const z = Math.cos(t); // 1 front … -1 back
        const x = Math.sin(t) * st.rx;
        const y = z * st.ry;
        const k = (z + 1) / 2;
        const s = 0.52 + 0.48 * k;
        c.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
        c.style.opacity = (0.1 + 0.9 * Math.pow(k, 2.2)).toFixed(3);
        c.style.pointerEvents = k > 0.3 ? "auto" : "none";
        c.style.zIndex = String(Math.round(k * 100));
        c.tabIndex = k > 0.75 ? 0 : -1;
        if (z > bestZ) {
          bestZ = z;
          best = i;
        }
      }
      if (best !== st.focus) {
        st.focus = best;
        setFocus(best);
        if (st.drag) tick(2600, 0.008);
      }
    };

    const nearest = () => {
      // angle that puts the nearest card exactly in front
      const k = Math.round(-st.a / step);
      return -k * step;
    };

    const loop = (now: number) => {
      st.raf = 0;
      const dt = Math.min(3, (now - (st.last || now)) / 16.67);
      st.last = now;
      let moving = false;
      if (st.drag) {
        moving = true;
      } else if (Math.abs(st.v) > 0.0004) {
        st.a += st.v * dt;
        st.v *= Math.pow(0.94, dt);
        moving = true;
        if (Math.abs(st.v) < 0.0025 && st.target == null) st.target = nearest();
      } else if (st.target != null) {
        // critically-damped-ish spring onto the target
        const d = st.target - st.a;
        st.a += d * Math.min(1, 0.14 * dt);
        if (Math.abs(d) < 0.0008) {
          st.a = st.target;
          st.target = null;
          st.idleUntil = now + 2600;
        }
        moving = true;
      } else if (!reduce && !st.hover && now > st.idleUntil) {
        // slow drift: one full orbit every ~90 s
        st.a -= (TAU / 5400) * dt;
        moving = true;
      }
      draw();
      if (moving && st.visible && !document.hidden) st.raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!st.raf && st.visible) {
        st.last = 0;
        st.raf = requestAnimationFrame(loop);
      }
    };

    api.current.go = (i: number) => {
      // shortest way round to card i
      const want = -i * step;
      let d = (want - st.a) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      st.v = 0;
      st.target = st.a + d;
      st.until = performance.now() + 1500;
      wake();
    };

    /* pointer: drag to spin; a short press stays a click on the card */
    let x0 = 0;
    let lastX = 0;
    let lastT = 0;
    let pid = -1;
    let armed = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      armed = true;
      pid = e.pointerId;
      x0 = lastX = e.clientX;
      lastT = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (!armed || e.pointerId !== pid) return;
      const dx = e.clientX - lastX;
      if (!st.drag && Math.abs(e.clientX - x0) > 6) {
        st.drag = true;
        st.target = null;
        el.setPointerCapture(pid);
        el.classList.add("dragging");
        wake();
      }
      if (!st.drag) return;
      const now = performance.now();
      const da = dx / st.rx;
      st.a += da;
      st.v = 0.7 * (da / Math.max(1, (now - lastT) / 16.67)) + 0.3 * st.v;
      lastX = e.clientX;
      lastT = now;
    };
    const up = () => {
      armed = false;
      if (!st.drag) return;
      st.drag = false;
      el.classList.remove("dragging");
      st.v = Math.max(-0.12, Math.min(0.12, st.v));
      if (Math.abs(st.v) < 0.0025) st.target = nearest();
      wake();
    };
    const swallowClick = (e: MouseEvent) => {
      if (Math.abs(lastX - x0) > 6) {
        e.stopPropagation();
        e.preventDefault();
        x0 = lastX;
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", swallowClick, true);
    const enter = () => (st.hover = true);
    const leave = () => {
      st.hover = false;
      wake();
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);

    /* scroll nudges the orbit while it's on screen */
    let lastY = scrollY;
    const onScroll = () => {
      const dy = scrollY - lastY;
      lastY = scrollY;
      if (!st.visible || st.drag || reduce || performance.now() < st.until) return;
      st.v -= Math.max(-0.02, Math.min(0.02, dy * 0.00012));
      st.target = null;
      wake();
    };
    addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(([e]) => {
      st.visible = e.isIntersecting;
      if (st.visible) wake();
    });
    io.observe(el);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const vis = () => !document.hidden && wake();
    document.addEventListener("visibilitychange", vis);
    measure();

    return () => {
      cancelAnimationFrame(st.raf);
      io.disconnect();
      ro.disconnect();
      removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", vis);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", swallowClick, true);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, [n, step, reduce]);

  useEffect(() => {
    if (items[focus]) onFocus?.(items[focus]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") api.current.go((focus + 1) % n);
    else if (e.key === "ArrowLeft") api.current.go((focus - 1 + n) % n);
    else return;
    e.preventDefault();
  };

  return (
    <div className="orbit">
      <div ref={stage} className="orbit-stage" role="listbox" aria-label={label} aria-activedescendant={`orb-${items[focus]?.id}`} tabIndex={0} onKeyDown={keys}>
        <svg className="orbit-path" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="50" cy="20" rx="49.5" ry="19.5" />
        </svg>
        {center && <div className="orbit-core">{center}</div>}
        {items.map((it, i) => (
          <button
            key={it.id}
            id={`orb-${it.id}`}
            ref={(r) => {
              cards.current[i] = r;
            }}
            role="option"
            aria-selected={focus === i}
            className={`orbit-card ${focus === i ? "focus" : ""}`}
            onClick={() => api.current.go(i)}
          >
            {render(it, focus === i)}
          </button>
        ))}
      </div>
      <div className="orbit-dots" role="tablist" aria-label={`${label} — jump to`}>
        {items.map((it, i) => (
          <button key={it.id} role="tab" aria-selected={focus === i} aria-label={`Show ${String((it as unknown as { name?: string }).name ?? it.id)}`} className={`orbit-dot ${focus === i ? "on" : ""}`} onClick={() => api.current.go(i)} />
        ))}
      </div>
    </div>
  );
}
