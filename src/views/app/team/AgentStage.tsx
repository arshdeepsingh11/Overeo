"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TEAM, teamById, type TeamId } from "../../../agents/team";
import { Avatar, loadStage } from "./Avatar";
import type { CharState } from "./Character";

/* =====================================================================
   The agent stage — who is answering, right now, in full view.

   Sits beside a chat (Overeo SI, a teammate chat). Her whole body stands
   on a glowing floor; her name, job and what she is doing are under her.
   When a question belongs to someone else, the current agent steps back
   and the next one beams in, waves, and takes over — so a hand-over is
   something you see, not a line of text.

   compact = a slim bar for phones (head and shoulders + name + state).
   ===================================================================== */

export const STATE_LABEL: Record<CharState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Answering",
  done: "Done",
  handoff: "Taking over",
  waiting: "Resting",
};

const ROSTER: TeamId[] = ["cycle", "labs", "visit", "reminders", "meds", "mood", "fertility", "meno"];

export function AgentStage({ agent: agentId, state, compact = false, size = 206, roster = true }: { agent: TeamId; state: CharState; compact?: boolean; size?: number; roster?: boolean }) {
  const agent = teamById(agentId) ?? teamById("si")!;
  const [prev, setPrev] = useState<TeamId | null>(null);
  const [arriving, setArriving] = useState(false);
  const last = useRef(agentId);

  // a hand-over: the last agent steps back, the new one beams in and waves
  useEffect(() => {
    if (last.current === agentId) return;
    setPrev(last.current);
    setArriving(true);
    last.current = agentId;
    const a = setTimeout(() => setPrev(null), 700);
    const b = setTimeout(() => setArriving(false), 1400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [agentId]);

  // build every teammate's character while the page is quiet, so a hand-over is instant
  useEffect(() => {
    let alive = true;
    const idle = (fn: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200)))(fn);
    void loadStage().then((st) => {
      if (!st.webglOk()) return;
      const ids = [...ROSTER, "si" as TeamId];
      const next = () => {
        const id = ids.shift();
        if (!alive || !id) return;
        const a = teamById(id);
        if (a) st.prepareAgent(a.id, a.hue);
        idle(next);
      };
      idle(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const shown: CharState = arriving ? "handoff" : state;
  const from = prev ? teamById(prev) : undefined;

  return (
    <aside className={`astage ${compact ? "is-compact" : ""} st-${shown}`} style={{ "--h": agent.hue, "--h0": from?.hue ?? agent.hue } as CSSProperties} aria-label={`${agent.name} is answering`} data-agent={agent.id}>
      <div className="astage-char">
        <span className="astage-floor" aria-hidden="true" />
        {from && !compact && (
          <span className="astage-slot is-leaving" key={`out-${from.id}`} aria-hidden="true">
            <Avatar agent={from} state="idle" frame="full" size={size} label={false} />
          </span>
        )}
        <span className="astage-slot is-here" key={`in-${agent.id}`}>
          {arriving && <span className="astage-beam" aria-hidden="true" />}
          <Avatar agent={agent} state={shown} frame={compact ? "bust" : "full"} size={compact ? 58 : size} label={false} />
        </span>
      </div>
      <div className="astage-info">
        <b className="astage-name" key={agent.id}>
          {agent.name}
        </b>
        <span className="astage-title">{agent.title}</span>
        <span className="astage-state" role="status" aria-live="polite">
          <i aria-hidden="true" />
          {from ? `${agent.name} takes this from ${from.name}` : STATE_LABEL[shown]}
        </span>
        {!compact && agent.does.length > 0 && <span className="astage-does">Helps with {agent.does.slice(0, 3).join(" · ")}</span>}
      </div>
      {roster && !compact && (
        <div className="astage-team" aria-hidden="true">
          {ROSTER.map((id) => {
            const a = TEAM.find((x) => x.id === id)!;
            return (
              <span key={id} className={`astage-mini ${id === agent.id ? "on" : ""}`} style={{ "--h": a.hue } as CSSProperties} title={`${a.name} · ${a.title}`}>
                <Avatar agent={a} size={30} still label={false} />
              </span>
            );
          })}
        </div>
      )}
    </aside>
  );
}
