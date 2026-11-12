"use client";

import { useId } from "react";
import type { Shape, TeamAgent } from "../../../agents/team";
import { iconPath } from "../../../ui/Icon";

/* =====================================================================
   The light version of each agent — the same "living light" being as
   the 3D one (liquid core, nucleus with her symbol, orbiting rings,
   sparks) in pure SVG + CSS. Shown first, on slow devices and in small
   chips. States: idle · listening · thinking · speaking · done ·
   handoff · waiting. Reduced motion → still.
   ===================================================================== */

export type CharState = "idle" | "listening" | "thinking" | "speaking" | "done" | "handoff" | "waiting";

// ring pattern per species (matches stage3d)
const RINGS: Record<Shape, [number, number][]> = {
  moon: [[50, 62]],
  flask: [[47, 90], [53, 90]],
  leaf: [[50, 34]],
  bird: [[48, 57], [54, 109]],
  hex: [[50, 17], [50, 90], [50, 52]],
  star: [[52, 74]],
  flower: [[46, 90], [53, 69], [53, 111]],
  wave: [[50, 80], [56, 80]],
  shield: [[50, 0], [50, 90]],
  orb: [[50, 69], [56, 109]],
  echo: [[46, 90], [52, 90], [58, 90]],
};
const GLYPH: Record<string, string> = { cycle: "moon", labs: "flask", visit: "doc", reminders: "bell", meds: "pill", mood: "smile", fertility: "heart", meno: "waves", echo: "globe", ora: "shield", si: "sparkle" };

export function Character({ agent, state = "idle", size = 72, label = true }: { agent: Pick<TeamAgent, "name" | "hue" | "shape" | "id"> & { glyph?: string }; state?: CharState; size?: number; label?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const h = agent.hue;
  const glyph = agent.glyph ?? GLYPH[agent.id] ?? "sparkle";
  const rings = RINGS[agent.shape] ?? RINGS.orb;
  return (
    <span className={`ch ch-${agent.shape} ch-${state}`} style={{ ["--h" as string]: h, width: size, height: size }} role={label ? "img" : undefined} aria-label={label ? `${agent.name}, ${state === "idle" ? "ready" : state}` : undefined} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <radialGradient id={`c${uid}`} cx="38%" cy="32%" r="72%">
            <stop offset="0" stopColor={`hsl(${h + 10} 100% 92%)`} />
            <stop offset="0.45" stopColor={`hsl(${h} 85% 66%)`} />
            <stop offset="1" stopColor={`hsl(${h + 55} 85% 46%)`} />
          </radialGradient>
          <radialGradient id={`a${uid}`}>
            <stop offset="0.45" stopColor={`hsl(${h} 100% 70%)`} stopOpacity="0.55" />
            <stop offset="1" stopColor={`hsl(${h} 100% 70%)`} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`n${uid}`}>
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.6" stopColor={`hsl(${h + 10} 100% 80%)`} stopOpacity="0.7" />
            <stop offset="1" stopColor={`hsl(${h + 10} 100% 80%)`} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`b${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${h + 60} 100% 75%)`} stopOpacity="0" />
            <stop offset="0.5" stopColor={`hsl(${h + 60} 100% 80%)`} stopOpacity="0.9" />
            <stop offset="1" stopColor={`hsl(${h - 30} 100% 75%)`} stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle className="ch-aura" cx="60" cy="60" r="58" fill={`url(#a${uid})`} />
        {rings.map(([r, tilt], i) => (
          <g key={i} transform={`rotate(${tilt} 60 60)`}>
            <ellipse className={`ch-ring r${i}`} cx="60" cy="60" rx={r} ry={r * 0.32} stroke={`hsl(${h + 30 + i * 25} 100% 76%)`} strokeDasharray={`${r * 2.2} ${r * 0.9}`} />
          </g>
        ))}
        <g className="ch-core">
          <circle cx="60" cy="60" r="34" fill={`url(#c${uid})`} />
          <ellipse className="ch-band" cx="60" cy="60" rx="34" ry="12" fill={`url(#b${uid})`} />
          <circle className="ch-rim" cx="60" cy="60" r="34" />
          <ellipse cx="49" cy="45" rx="11" ry="6" fill="#fff" opacity="0.55" transform="rotate(-28 49 45)" />
        </g>
        <circle className="ch-nucleus" cx="60" cy="61" r="17" fill={`url(#n${uid})`} />
        <g transform="translate(48 49)">
          <path className="ch-glyph" d={iconPath(glyph)} />
        </g>
        <g className="ch-sparks">
          <circle cx="104" cy="44" r="1.8" />
          <circle cx="16" cy="70" r="1.4" />
          <circle cx="92" cy="98" r="1.2" />
          <circle cx="30" cy="22" r="1.6" />
        </g>
      </svg>
    </span>
  );
}
