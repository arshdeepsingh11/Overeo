"use client";

import { useEffect, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoInterpolate, geoContains, type GeoProjection } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { useStore } from "../core/store";
import { useVisible } from "../lib/hooks";
import { attachGestures } from "../lib/gesture";
import { HUBS } from "../core/ecosystem";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * Digital World Map — Natural Earth (public domain) rendered as a
 * dotted, glowing canvas. Live great-circle arcs carry (simulated)
 * consented contributions to the research hubs. Hover a country for
 * details; drag to pan; pinch, ⌘/Ctrl + scroll or the buttons to zoom.
 * ------------------------------------------------------------------ */

type Props = { n: string; c: string; p: number };
type World = FeatureCollection<Geometry, Props>;

const CITIES: [string, number, number][] = [
  ["Vancouver", -123.1, 49.3], ["Toronto", -79.4, 43.7], ["Montréal", -73.6, 45.5], ["New York", -74, 40.7],
  ["San Francisco", -122.4, 37.8], ["Mexico City", -99.1, 19.4], ["São Paulo", -46.6, -23.5], ["Bogotá", -74.1, 4.7],
  ["London", -0.1, 51.5], ["Paris", 2.35, 48.86], ["Berlin", 13.4, 52.5], ["Madrid", -3.7, 40.4], ["Stockholm", 18.1, 59.3],
  ["Lagos", 3.4, 6.5], ["Nairobi", 36.8, -1.3], ["Cape Town", 18.4, -33.9], ["Cairo", 31.2, 30],
  ["Mumbai", 72.9, 19.1], ["Delhi", 77.2, 28.6], ["Singapore", 103.8, 1.35], ["Tokyo", 139.7, 35.7],
  ["Seoul", 127, 37.6], ["Sydney", 151.2, -33.9], ["Riyadh", 46.7, 24.7], ["Istanbul", 29, 41],
];

interface Arc {
  from: [number, number];
  to: [number, number];
  t: number;
  speed: number;
  hue: number;
}

export function WorldMap({ onStats }: { onStats?: (s: { contributions: number; countries: number }) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const vis = useVisible(host, "100px");
  const theme = useStore((s) => s.theme);
  const [world, setWorld] = useState<World | null>(null);
  const [err, setErr] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; continent: string; count: number } | null>(null);
  const view = useRef({ k: 1, x: 0, y: 0, tk: 1, tx: 0, ty: 0 });
  const live = useRef({ vis, theme });
  live.current = { vis, theme };

  useEffect(() => {
    let alive = true;
    fetch("/data/world-110m.json")
      .then((r) => r.json())
      .then((j: World) => alive && setWorld(j))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!world) return;
    const el = host.current!;
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    let proj: GeoProjection = geoNaturalEarth1();
    let dots: { x: number; y: number; r: number; ph: number }[] = [];
    const counts = new Map<string, number>();
    world.features.forEach((f, i) => counts.set(f.properties.n, 40 + ((i * 7919) % 900)));

    const baseFit = () => {
      proj = geoNaturalEarth1().fitExtent(
        [
          [12, 12],
          [W - 12, H - 12],
        ],
        { type: "Sphere" } as never,
      );
      const s0 = proj.scale();
      const [tx0, ty0] = proj.translate();
      const v = view.current;
      proj.scale(s0 * v.k).translate([tx0 * v.k + v.x - (W / 2) * (v.k - 1), ty0 * v.k + v.y - (H / 2) * (v.k - 1)]);
    };

    // Rasterise land into a grid of dots (re-sampled on zoom/resize).
    const sample = () => {
      baseFit();
      const off = document.createElement("canvas");
      off.width = Math.ceil(W);
      off.height = Math.ceil(H);
      const o = off.getContext("2d", { willReadFrequently: true })!;
      const path = geoPath(proj, o);
      o.fillStyle = "#000";
      o.beginPath();
      path(world as never);
      o.fill();
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(4, Math.round(6.4 / Math.sqrt(view.current.k)) + (W < 600 ? 1 : 0));
      dots = [];
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < W; x += step) {
          const i = ((y | 0) * off.width + (x | 0)) * 4 + 3;
          if (data[i] > 0) dots.push({ x, y, r: step * 0.26, ph: (Math.random() * 4) | 0 });
        }
      }
      sampled = { k: view.current.k, x: view.current.x, y: view.current.y };
    };
    let sampled = { k: 1, x: 0, y: 0 };

    const resize = () => {
      const r = el.getBoundingClientRect();
      W = r.width;
      H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      sample();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Arcs
    const arcs: Arc[] = [];
    const spawn = () => {
      const c = CITIES[(Math.random() * CITIES.length) | 0];
      const h = HUBS[Math.random() < 0.72 ? 0 : 1];
      arcs.push({ from: [c[1], c[2]], to: [h.lon, h.lat], t: 0, speed: 0.22 + Math.random() * 0.25, hue: 330 + Math.random() * 30 });
    };
    for (let i = 0; i < 6; i++) spawn();
    let contributions = 18240;
    onStats?.({ contributions, countries: 61 });

    // Interaction
    let resampleT = 0;
    const scheduleResample = () => {
      clearTimeout(resampleT);
      resampleT = window.setTimeout(sample, 120);
    };
    const zoomAt = (factor: number, cx: number, cy: number) => {
      // keep the screen point under the cursor fixed while zooming
      const v = view.current;
      const nk = Math.max(1, Math.min(6, v.tk * factor));
      const Px = W / 2 + cx;
      const Py = H / 2 + cy;
      const pbx = (Px - v.tx + (W / 2) * (v.tk - 1)) / v.tk;
      const pby = (Py - v.ty + (H / 2) * (v.tk - 1)) / v.tk;
      v.tx = Px - nk * pbx + (W / 2) * (nk - 1);
      v.ty = Py - nk * pby + (H / 2) * (nk - 1);
      v.tk = nk;
      if (nk === 1) {
        v.tx = 0;
        v.ty = 0;
      }
    };
    const off = attachGestures(el, {
      onDrag: (dx, dy) => {
        const v = view.current;
        if (v.tk <= 1) return;
        v.tx += dx;
        v.ty += dy;
      },
      onPinch: (s, cx, cy) => {
        const r = el.getBoundingClientRect();
        zoomAt(s, cx - r.left - W / 2, cy - r.top - H / 2);
      },
      onWheel: (_dx, dy, ctrl, e) => {
        if (!ctrl) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        zoomAt(Math.exp(-dy * 0.004), e.clientX - r.left - W / 2, e.clientY - r.top - H / 2);
      },
    });
    const onDbl = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      zoomAt(1.8, e.clientX - r.left - W / 2, e.clientY - r.top - H / 2);
    };
    el.addEventListener("dblclick", onDbl);
    (el as HTMLElement & { __zoom?: (f: number) => void }).__zoom = (f: number) => zoomAt(f, 0, 0);

    let hoverName: string | null = null;
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMove < 40) return;
      lastMove = now;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const ll = proj.invert?.([x, y]);
      let found: (typeof world.features)[number] | null = null;
      if (ll) for (const f of world.features) if (geoContains(f as never, ll)) { found = f; break; }
      hoverName = found?.properties.n ?? null;
      setTip(found ? { x, y, name: found.properties.n, continent: found.properties.c, count: counts.get(found.properties.n) ?? 0 } : null);
    };
    const onLeave = () => {
      hoverName = null;
      setTip(null);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let spawnT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const L = live.current;
      if (!L.vis) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      // ease the view toward its target and resample dots when zoom changes
      const v = view.current;
      const pk = v.k;
      v.k += (v.tk - v.k) * Math.min(1, dt * 6);
      v.x += (v.tx - v.x) * Math.min(1, dt * 6);
      v.y += (v.ty - v.y) * Math.min(1, dt * 6);
      if (Math.abs(v.k - pk) > 0.0005 || Math.abs(v.x - v.tx) > 0.3 || Math.abs(v.y - v.ty) > 0.3) {
        baseFit();
        if (Math.abs(v.k - v.tk) < 0.01) scheduleResample();
      }

      const dark = L.theme === "dark";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Dots: sampled once per settled view; while panning/zooming they're carried by an
      // affine transform (screen = a·screen₀ + b) so motion stays 60fps.
      const a = v.k / sampled.k;
      const bx = a * (-sampled.x + (W / 2) * (sampled.k - 1)) + v.x - (W / 2) * (v.k - 1);
      const by = a * (-sampled.y + (H / 2) * (sampled.k - 1)) + v.y - (H / 2) * (v.k - 1);
      ctx.setTransform(dpr * a, 0, 0, dpr * a, dpr * bx, dpr * by);
      const dotC = dark ? "246,238,240" : "88,54,79";
      const phase = Math.floor(time * 1.4);
      for (let bucket = 0; bucket < 4; bucket++) {
        const tw = ((bucket + phase) % 4) / 3;
        ctx.fillStyle = `rgba(${dotC},${(dark ? 0.14 : 0.16) + tw * 0.12})`;
        ctx.beginPath();
        for (const d of dots) {
          if (d.ph !== bucket) continue;
          ctx.moveTo(d.x + d.r, d.y);
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // hovered country outline
      if (hoverName) {
        const f = world.features.find((x) => x.properties.n === hoverName);
        if (f) {
          const path = geoPath(proj, ctx);
          ctx.beginPath();
          path(f as never);
          ctx.fillStyle = dark ? "rgba(234,166,188,.16)" : "rgba(184,81,122,.10)";
          ctx.fill();
          ctx.strokeStyle = dark ? "rgba(234,166,188,.75)" : "rgba(138,90,119,.7)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // arcs
      spawnT += dt;
      if (spawnT > 0.55 && arcs.length < 16) {
        spawnT = 0;
        spawn();
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        a.t += dt * a.speed;
        const interp = geoInterpolate(a.from, a.to);
        const head = Math.min(1, a.t);
        const tail = Math.max(0, a.t - 0.45);
        const steps = 36;
        ctx.lineCap = "round";
        let prev: [number, number] | null = null;
        for (let s = 0; s <= steps; s++) {
          const u = tail + (head - tail) * (s / steps);
          const ll = interp(u);
          const p0 = proj(ll);
          if (!p0) continue;
          // lift the arc above the surface
          const lift = Math.sin(u * Math.PI) * 26 * Math.min(1.6, v.k);
          const p: [number, number] = [p0[0], p0[1] - lift];
          if (prev) {
            const alpha = (s / steps) * (a.t > 1 ? Math.max(0, 1.45 - a.t) / 0.45 : 1);
            ctx.strokeStyle = `hsla(${a.hue}, 32%, ${dark ? 78 : 52}%, ${alpha * 0.9})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(p[0], p[1]);
            ctx.stroke();
          }
          prev = p;
        }
        if (prev && a.t <= 1) {
          ctx.fillStyle = dark ? "#fff" : "#8A5A77";
          ctx.shadowColor = `hsla(${a.hue}, 36%, 70%, 1)`;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(prev[0], prev[1], 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        if (a.t > 1.45) {
          arcs.splice(i, 1);
          contributions += 1 + ((Math.random() * 3) | 0);
          onStats?.({ contributions, countries: 61 });
        }
      }

      // hubs
      HUBS.forEach((h, i) => {
        const p = proj([h.lon, h.lat]);
        if (!p) return;
        const ph = (time * 0.8 + i * 0.5) % 1;
        ctx.strokeStyle = dark ? `rgba(234,166,188,${1 - ph})` : `rgba(138,90,119,${1 - ph})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4 + ph * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = dark ? "#F3D3DE" : "#58364F";
        ctx.shadowColor = "rgba(234,166,188,1)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Hanken Grotesk', sans-serif";
        ctx.fillStyle = dark ? "rgba(246,238,240,.9)" : "rgba(41,35,42,.85)";
        ctx.fillText(h.name, p[0] + 10, p[1] - 8);
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
      clearTimeout(resampleT);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  const zoom = (f: number) => (host.current as (HTMLDivElement & { __zoom?: (f: number) => void }) | null)?.__zoom?.(f);

  return (
    <div ref={host} className="wmap" role="img" aria-label="World map of simulated research contributions flowing to Calgary and Dubai">
      <canvas ref={canvas} />
      {!world && !err && <div className="wmap-loading skeleton" />}
      {err && <div className="wmap-loading small muted">Map data couldn't load.</div>}
      {tip && (
        <div className="wmap-tip glass-thin" style={{ transform: `translate(${tip.x + 14}px, ${tip.y + 14}px)` }}>
          <b>{tip.name}</b>
          <span className="faint small">{tip.continent}</span>
          <span className="mono small">{tip.count.toLocaleString()} contributors · sim</span>
        </div>
      )}
      <div className="wmap-zoom glass-thin">
        <button onClick={() => zoom(1.6)} aria-label="Zoom in">
          <Icon name="plus" size={16} />
        </button>
        <button onClick={() => zoom(1 / 1.6)} aria-label="Zoom out">
          <Icon name="minus" size={16} />
        </button>
      </div>
    </div>
  );
}
