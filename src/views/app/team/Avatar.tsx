"use client";

import { useEffect, useRef, useState } from "react";
import type { TeamAgent } from "../../../agents/team";
import { Character, type CharState } from "./Character";

/* =====================================================================
   Agent avatar: the 3D character when the device can draw it, the flat
   character otherwise (and until 3D is ready — so first paint is fast
   and server/client markup always match).
   ===================================================================== */

type Stage = typeof import("./stage3d");
let stageP: Promise<Stage> | null = null;
const loadStage = () => (stageP ??= import("./stage3d"));

export function Avatar({ agent, state = "idle", size = 72, label = true }: { agent: Pick<TeamAgent, "name" | "hue" | "shape" | "id">; state?: CharState; size?: number; label?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef<import("./stage3d").View | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let off: (() => void) | null = null;
    let alive = true;
    void loadStage().then((st) => {
      const el = ref.current;
      if (!alive || !el || !st.webglOk()) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(size * 1.3 * dpr);
      el.height = Math.round(size * 1.3 * dpr);
      const v = { el, shape: agent.shape, hue: agent.hue, state, visible: true, seed: (agent.id.charCodeAt(0) % 7) * 0.9 };
      view.current = v;
      off = st.register(v);
      if (off) setLive(true);
    });
    return () => {
      alive = false;
      off?.();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.shape, agent.hue, size]);

  useEffect(() => {
    if (!view.current) return;
    view.current.state = state;
    void loadStage().then((st) => view.current && st.update(view.current));
  }, [state]);

  return (
    <span className={`av ${live ? "is-3d" : ""} av-${state}`} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label ? `${agent.name}, ${state === "idle" ? "ready" : state}` : undefined} aria-hidden={label ? undefined : true}>
      <Character agent={agent} state={state} size={size} label={false} />
      <canvas ref={ref} className="av-3d" aria-hidden="true" style={{ width: size * 1.3, height: size * 1.3 }} />
    </span>
  );
}
