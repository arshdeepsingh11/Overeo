"use client";

import { useId } from "react";
import type { Shape, TeamAgent } from "../../../agents/team";

/* =====================================================================
   Team characters — one soft glass creature per agent, each with its
   own silhouette and emblem. States follow the conversation:
   idle · listening · thinking · speaking · done · handoff.
   Pure SVG + CSS (no WebGL), so it is light on phones; reduced-motion
   users get still poses.
   ===================================================================== */

export type CharState = "idle" | "listening" | "thinking" | "speaking" | "done" | "handoff" | "waiting";

const BODY: Record<Shape, string> = {
  moon: "M60 22a40 40 0 1 1 0 80 40 40 0 0 1 0-80z",
  flask: "M47 18h26v20l21 40c5 10-2 22-13 22H39c-11 0-18-12-13-22l21-40z",
  leaf: "M60 16c30 12 40 50 20 78-9 12-31 12-40 0-20-28-10-66 20-78z",
  bird: "M60 26c24 0 40 18 40 40s-16 36-40 36-40-14-40-36 16-40 40-40z",
  hex: "M60 18l34 19.5v39L60 96 26 76.5v-39z",
  star: "M60 16l11 26 28 3-21 18 6 28-24-14-24 14 6-28-21-18 28-3z",
  flower: "M60 30a30 30 0 1 1 0 60 30 30 0 0 1 0-60z",
  wave: "M20 90c0-38 18-64 40-64s40 26 40 64c-7 6-13 6-20 0s-13-6-20 0-13 6-20 0-13-6-20 0z",
  shield: "M60 16l36 12v26c0 24-16 40-36 48-20-8-36-24-36-48V28z",
  orb: "M60 22a40 40 0 1 1 0 80 40 40 0 0 1 0-80z",
  echo: "M60 24c22 0 38 15 38 34s-16 34-38 34c-5 0-10-1-14-2l-14 8 3-13c-8-7-13-16-13-27 0-19 16-34 38-34z",
};

const EMBLEM: Record<Shape, string> = {
  moon: "M84 18a14 14 0 1 0 10 24 11 11 0 1 1-10-24z",
  flask: "M54 12h12M57 52h6",
  leaf: "M60 30v54M60 52l-10-8M60 64l10-8",
  bird: "M98 58l10 4-10 4M44 22c4-8 12-10 16-4",
  hex: "M52 40h16M60 32v16",
  star: "M60 4v8M60 4l-3 3M60 4l3 3",
  flower: "",
  wave: "M30 18a10 10 0 0 1 16 0M38 10v4",
  shield: "M50 86l7 7 14-14",
  orb: "M18 64a42 14 0 0 0 84 0",
  echo: "M104 44a22 22 0 0 1 0 28M112 36a34 34 0 0 1 0 44M16 44a22 22 0 0 0 0 28",
};

function Petals() {
  return (
    <g className="ch-petals">
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={r} cx="60" cy="34" rx="12" ry="18" transform={`rotate(${r} 60 60)`} />
      ))}
    </g>
  );
}

export function Character({ agent, state = "idle", size = 72, label = true }: { agent: Pick<TeamAgent, "name" | "hue" | "shape" | "id">; state?: CharState; size?: number; label?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const h = agent.hue;
  return (
    <span className={`ch ch-${agent.shape} ch-${state}`} style={{ ["--h" as string]: h, width: size, height: size }} role={label ? "img" : undefined} aria-label={label ? `${agent.name}, ${state === "idle" ? "ready" : state}` : undefined} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <radialGradient id={`g${uid}`} cx="38%" cy="30%" r="80%">
            <stop offset="0" stopColor={`hsl(${h} 90% 92%)`} />
            <stop offset="0.55" stopColor={`hsl(${h} 62% 74%)`} />
            <stop offset="1" stopColor={`hsl(${h} 48% 52%)`} />
          </radialGradient>
          <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse className="ch-shadow" cx="60" cy="110" rx="30" ry="5" />
        <g className="ch-body">
          {agent.shape === "flower" && <Petals />}
          <path d={BODY[agent.shape]} fill={`url(#g${uid})`} className="ch-fill" />
          <path d={BODY[agent.shape]} fill="none" className="ch-rim" />
          <ellipse cx="48" cy="40" rx="14" ry="7" fill={`url(#s${uid})`} transform="rotate(-24 48 40)" />
          {EMBLEM[agent.shape] && <path d={EMBLEM[agent.shape]} className="ch-emblem" />}
          {agent.shape === "orb" && <circle cx="60" cy="62" r="46" className="ch-ring" />}
          <g className="ch-face">
            <ellipse className="ch-eye" cx="49" cy="62" rx="4" ry="5" />
            <ellipse className="ch-eye" cx="71" cy="62" rx="4" ry="5" />
            <path className="ch-mouth" d="M53 75q7 6 14 0" />
            <circle className="ch-blush" cx="41" cy="72" r="4" />
            <circle className="ch-blush" cx="79" cy="72" r="4" />
          </g>
        </g>
        <g className="ch-dots">
          <circle cx="96" cy="26" r="3.2" />
          <circle cx="104" cy="36" r="2.6" />
          <circle cx="108" cy="48" r="2" />
        </g>
      </svg>
    </span>
  );
}
