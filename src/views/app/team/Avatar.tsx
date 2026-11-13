"use client";

import { useEffect, useRef, useState } from "react";
import type { TeamAgent } from "../../../agents/team";
import { Character, type CharState } from "./Character";

/* =====================================================================
   Agent avatar: her 3D character when the device can draw it, the light
   SVG version otherwise.

   frame "bust" (default) = head and shoulders, square.
   frame "full" = her whole body, portrait (size = width, height = 1.3×).
   still = drawn once per state (old chat messages, long lists).

   Until 3D is ready the spot shows a soft glow in her colour, so the
   light version never flashes in first and server/client markup match.
   ===================================================================== */

type Stage = typeof import("./stage3d");
let stageP: Promise<Stage> | null = null;
export const loadStage = () => (stageP ??= import("./stage3d"));

type Mode = "wait" | "3d" | "flat";

export function Avatar({
  agent,
  state = "idle",
  size = 72,
  label = true,
  frame = "bust",
  still = false,
}: {
  agent: Pick<TeamAgent, "name" | "hue" | "shape" | "id"> & { glyph?: string };
  state?: CharState;
  size?: number;
  label?: boolean;
  frame?: "bust" | "full";
  still?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef<import("./stage3d").View | null>(null);
  const [mode, setMode] = useState<Mode>("wait");
  const w = size;
  const h = frame === "full" ? Math.round(size * 1.3) : size;

  useEffect(() => {
    let off: (() => void) | null = null;
    let alive = true;
    void loadStage()
      .then((st) => {
        const el = ref.current;
        if (!alive || !el) return;
        if (!st.webglOk()) return setMode("flat");
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
        const v: import("./stage3d").View = {
          el,
          agent: agent.id,
          hue: agent.hue,
          state,
          frame,
          still,
          visible: true,
          seed: (agent.id.charCodeAt(0) % 7) * 0.9 + (agent.id.charCodeAt(1) % 5) * 0.37,
          onFallback: () => alive && setMode("flat"),
        };
        view.current = v;
        off = st.register(v);
        setMode(off ? "3d" : "flat");
      })
      .catch(() => alive && setMode("flat"));
    return () => {
      alive = false;
      off?.();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, agent.hue, w, h, frame, still]);

  useEffect(() => {
    if (!view.current) return;
    view.current.state = state;
    void loadStage().then((st) => view.current && st.update(view.current));
  }, [state]);

  return (
    <span
      className={`av av-${frame} is-${mode} av-${state}`}
      style={{ width: w, height: h, ["--h" as string]: agent.hue }}
      role={label ? "img" : undefined}
      aria-label={label ? `${agent.name}, ${state === "idle" ? "ready" : state}` : undefined}
      aria-hidden={label ? undefined : true}
      data-agent={agent.id}
    >
      {mode === "flat" && <Character agent={agent} state={state} size={Math.min(w, h)} label={false} />}
      <canvas ref={ref} className="av-3d" aria-hidden="true" style={{ width: w, height: h }} />
    </span>
  );
}
