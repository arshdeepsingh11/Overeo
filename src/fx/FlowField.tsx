"use client";

import { useEffect, useRef } from "react";
import { useStore } from "../core/store";
import { useVisible } from "../lib/hooks";

/* ------------------------------------------------------------------ *
 * Fluid particle field — particles follow a curl-noise flow with
 * fading trails; the pointer stirs the fluid like a finger in water.
 * Used behind OVEREO Labs: "every period becomes data".
 * ------------------------------------------------------------------ */

function noise2(x: number, y: number) {
  // cheap smooth value noise
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function FlowField({ count = 650 }: { count?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const vis = useVisible(cv, "80px");
  const theme = useStore((s) => s.theme);
  const reduce = useStore((s) => s.reducedMotion);
  const live = useRef({ vis, theme, reduce });
  live.current = { vis, theme, reduce };

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let W = 0, H = 0;
    const resize = () => {
      const r = c.getBoundingClientRect();
      W = r.width;
      H = r.height;
      c.width = W * dpr;
      c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    const N = W < 700 ? Math.floor(count * 0.45) : count;
    const ps = Array.from({ length: N }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, life: Math.random() * 200 }));
    const m = { x: -999, y: -999, vx: 0, vy: 0, on: false };
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      const nx = e.clientX - r.left, ny = e.clientY - r.top;
      m.vx = nx - m.x;
      m.vy = ny - m.y;
      m.x = nx;
      m.y = ny;
      m.on = nx >= 0 && ny >= 0 && nx <= W && ny <= H;
    };
    addEventListener("pointermove", onMove, { passive: true });

    let raf = 0, t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const L = live.current;
      if (!L.vis) return;
      t += L.reduce ? 0.0005 : 0.004;
      const dark = L.theme === "dark";
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      const sc = 0.0026;
      for (const p of ps) {
        // smooth noise → flow direction; two octaves give eddies like a fluid
        const ang = (noise2(p.x * sc, p.y * sc + t) * 0.7 + noise2(p.x * sc * 2.3 + 7, p.y * sc * 2.3 - t) * 0.3) * Math.PI * 4;
        let ax = Math.cos(ang) * 1.9;
        let ay = Math.sin(ang) * 1.9;
        if (m.on) {
          const dx = p.x - m.x, dy = p.y - m.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 22000) {
            // the pointer drags the fluid and adds a gentle swirl
            const f = 1 - d2 / 22000;
            ax += m.vx * 0.35 * f - dy * 0.02 * f;
            ay += m.vy * 0.35 * f + dx * 0.02 * f;
          }
        }
        p.vx = p.vx * 0.86 + ax * 0.14;
        p.vy = p.vy * 0.86 + ay * 0.14;
        const ox = p.x, oy = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life < 0) {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.vx = p.vy = 0;
          p.life = 120 + Math.random() * 220;
          continue;
        }
        const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 2.4);
        const hue = 340 - sp * 40;
        ctx.strokeStyle = dark ? `hsla(${hue}, 40%, ${68 + sp * 12}%, ${0.22 + sp * 0.4})` : `hsla(${hue - 8}, 28%, ${60 - sp * 14}%, ${0.22 + sp * 0.38})`;
        ctx.lineWidth = 1.1 + sp * 1.2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      m.vx *= 0.8;
      m.vy *= 0.8;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
    };
  }, [count]);

  return <canvas ref={cv} className="flowfield" aria-hidden="true" />;
}
