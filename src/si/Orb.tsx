"use client";

import { useEffect, useRef } from "react";
import { useStore } from "../core/store";

/* ------------------------------------------------------------------ *
 * The SI orb — a living particle sphere. States:
 *   idle      slow breathing
 *   listening surface ripples with the microphone level
 *   thinking  particles swirl into bands
 *   speaking  rhythmic pulses
 * Canvas 2D with additive glow; ~1–2 ms per frame.
 * ------------------------------------------------------------------ */

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export function Orb({ state, level = 0, size = 220, className }: { state: OrbState; level?: number; size?: number; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const theme = useStore((s) => s.theme);
  const live = useRef({ state, level, theme });
  live.current = { state, level, theme };

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.scale(dpr, dpr);
    const N = size > 150 ? 700 : size > 60 ? 320 : 140;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, seed: Math.random() * 10 };
    });
    // pause entirely while off-screen
    let visible = true;
    const io = new IntersectionObserver((es) => (visible = es[0]?.isIntersecting ?? true));
    io.observe(c);
    let raf = 0;
    let t = 0;
    let energy = 0;
    let swirl = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      const L = live.current;
      t += dt;
      const targetE = L.state === "listening" ? 0.25 + L.level * 1.4 : L.state === "speaking" ? 0.35 + 0.25 * Math.abs(Math.sin(t * 7)) : L.state === "thinking" ? 0.3 : 0.08;
      energy += (targetE - energy) * Math.min(1, dt * 6);
      swirl += ((L.state === "thinking" ? 2.4 : 0.35) - swirl) * Math.min(1, dt * 2);
      const dark = L.theme === "dark";
      ctx.clearRect(0, 0, size, size);
      const R = size * 0.32 * (1 + 0.04 * Math.sin(t * 1.6) + energy * 0.12);
      const cx = size / 2;
      const cy = size / 2;

      // soft core glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      g.addColorStop(0, dark ? "rgba(234,166,188,.35)" : "rgba(248,220,229,.8)");
      g.addColorStop(0.5, dark ? "rgba(185,130,161,.12)" : "rgba(185,130,161,.12)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      const ry = t * swirl * 0.5;
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const rx = 0.35 + Math.sin(t * 0.3) * 0.1;
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      for (const p of pts) {
        // displacement: breathing + bands while thinking + ripples while listening
        const band = L.state === "thinking" ? Math.sin(p.y * 9 + t * 5) * 0.08 : 0;
        const ripple = Math.sin(p.seed * 3 + t * 6 + p.y * 7) * energy * 0.22;
        const k = 1 + band + ripple;
        let x = p.x * k;
        let y = p.y * k;
        let z = p.z * k;
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        x = x1;
        y = y1;
        z = z2;
        const depth = (z + 1.3) / 2.3;
        const px = cx + x * R;
        const py = cy + y * R;
        const hue = 330 + (p.y + 1) * 18 + Math.sin(t + p.seed) * 6;
        ctx.fillStyle = dark
          ? `hsla(${hue}, 45%, ${70 + depth * 14}%, ${0.15 + depth * 0.7})`
          : `hsla(${hue - 10}, 26%, ${34 + depth * 22}%, ${0.12 + depth * 0.65})`;
        const s = 0.6 + depth * 1.5;
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      ctx.globalCompositeOperation = "source-over";
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [size]);

  return <canvas ref={cv} className={`orb ${className ?? ""}`} style={{ width: size, height: size }} aria-hidden="true" />;
}
