"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../ui/Icon";
import { navigate } from "../../../core/routes";
import { teamById, type TeamId } from "../../../agents/team";
import { routeTo, talk, type Reply } from "../../../agents/client";
import { logChat as saveChat } from "../../../cloud/sync";
import type { CharState } from "./Character";
import { Avatar } from "./Avatar";
import { AgentStage } from "./AgentStage";

/* =====================================================================
   Agent console — chat with one teammate.
   Every reply shows where it came from (mode), its sources, a figure
   check if any number couldn't be verified, and only whitelisted
   buttons. Hand-offs switch to the right teammate in one tap.
   ===================================================================== */

type Turn = { role: "user"; text: string } | { role: "agent"; agent: TeamId; reply: Reply; key?: string; upgraded?: boolean } | { role: "switch"; from: TeamId; to: TeamId };

export const MODE_LABEL: Record<string, string> = {
  device: "From your data · on your device",
  live: "Live brain (Xevyo) · checked",
  demo: "Demo · OVEREO's content",
  fallback: "On this device · live brain unavailable",
  guarded: "Kept within OVEREO's rules",
  instant: "Instant · from OVEREO's guides · getting more detail…",
  guides: "From OVEREO's checked guides",
};

export function AgentConsole({ initial, onClose }: { initial: TeamId; onClose: () => void }) {
  const [agentId, setAgentId] = useState<TeamId>(initial);
  const agent = teamById(agentId)!;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<CharState>("idle");
  const busy = state === "thinking";
  const convId = useRef(Math.random().toString(36).slice(2));
  const inflight = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = matchMedia("(max-width: 720px), (max-height: 520px)");
    const f = () => setNarrow(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);

  useEffect(() => {
    input.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [turns, state]);

  const send = async (text: string, deeper = false) => {
    const t = text.trim();
    if (!t || busy || inflight.current) return;
    inflight.current = true;
    setQ("");
    // whose job is this question? the right teammate steps in
    const who = deeper ? agentId : routeTo(t, agentId);
    const next: Turn[] = [...turns, { role: "user", text: t }, ...(who !== agentId ? [{ role: "switch" as const, from: agentId, to: who }] : [])];
    setTurns(next);
    if (who !== agentId) setAgentId(who);
    setState("thinking");
    // the answering agent's conversation (plus this question)
    const history = next
      .filter((x): x is Exclude<Turn, { role: "switch" }> => x.role !== "switch")
      .filter((x) => x.role === "user" || x.agent === who)
      .map((x) => (x.role === "user" ? { role: "user" as const, content: x.text } : { role: "assistant" as const, content: x.reply.text }))
      .slice(-8);
    const key = Math.random().toString(36).slice(2);
    let shown = false;
    const reply = await talk(who, history, {
      deeper,
      onInstant: (r) => {
        shown = true;
        setTurns((x) => [...x, { role: "agent", agent: who, reply: r, key }]);
        setState("speaking");
      },
    });
    setTurns((x) => (shown ? x.map((t) => (t.role === "agent" && t.key === key ? { ...t, reply: reply.mode === "live" ? reply : { ...t.reply, mode: reply.mode === "guarded" ? "guarded" : "guides", note: reply.note }, upgraded: reply.mode === "live" } : t)) : [...x, { role: "agent", agent: who, reply }]));
    inflight.current = false;
    saveChat(convId.current, "agent", t, [
      { id: key + "q", role: "user", text: t },
      { id: key + "a", role: "assistant", agent: who, text: reply.text, meta: { mode: reply.mode } },
    ]);
    setState("speaking");
    setTimeout(() => setState((s) => (s === "speaking" ? "idle" : s)), 1800);
  };

  const lastUser = [...turns].reverse().find((x) => x.role === "user") as { text: string } | undefined;

  return (
    <div className="asheet-root" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`asheet console ${narrow ? "" : "has-stage"}`} role="dialog" aria-modal="true" aria-label={`Chat with ${agent.name}`} style={{ ["--h" as string]: agent.hue }}>
        <div className="console-head">
          {narrow && <Avatar agent={agent} state={state} size={58} />}
          <div className="console-who">
            <b>{agent.name}</b>
            <span>{agent.title}</span>
            <span className="faint small">{agent.personality}</span>
          </div>
          <button className="asheet-x" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="console-body">
        {!narrow && <AgentStage agent={agentId} state={state} size={160} roster={false} />}
        <div className="console-main">
        <div className="console-list" ref={list} aria-live="polite">
          {!turns.length && (
            <div className="console-intro">
              <p>{agent.role}</p>
              <p className="faint small">
                I cover {agent.does.slice(0, 3).join(", ")}. I don't do {agent.doesNot.slice(0, 2).join(" or ")}.
              </p>
              <div className="console-starters">
                {agent.starters.map((s) => (
                  <button key={s} className="chip" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="cq">
                {t.text}
              </div>
            ) : t.role === "switch" ? (
              <SwitchNote key={i} from={t.from} to={t.to} />
            ) : (
              <div key={i} className="ca-wrap">
                {turns.some((x) => x.role === "switch") && (
                  <span className="ca-who" style={{ ["--h" as string]: teamById(t.agent)!.hue }}>
                    {teamById(t.agent)!.name}
                  </span>
                )}
                <AgentBubble reply={t.reply} upgraded={t.upgraded} onHandoff={(id) => setAgentId(id)} onDeeper={() => lastUser && void send(lastUser.text, true)} />
              </div>
            ),
          )}
          {busy && (
            <div className="ca thinking" role="status">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>{" "}
              {agent.name} is checking your data and OVEREO's guides…
            </div>
          )}
        </div>

        <form
          className="console-input"
          onSubmit={(e) => {
            e.preventDefault();
            void send(q);
          }}
        >
          <input ref={input} className="ainput" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => state === "idle" && setState("listening")} onBlur={() => state === "listening" && setState("idle")} placeholder={`Ask ${agent.name}…`} aria-label={`Message ${agent.name}`} maxLength={1200} />
          <button className="btn" type="submit" disabled={!q.trim() || busy} aria-label="Send">
            <Icon name="send" size={16} />
          </button>
        </form>
        </div>
        </div>
        <p className="console-foot faint small">Educational, not a diagnosis · in an emergency call your local emergency number</p>
      </div>
    </div>
  );
}

function SwitchNote({ from, to }: { from: TeamId; to: TeamId }) {
  const a = teamById(from)!;
  const b = teamById(to)!;
  return (
    <div className="ca-switch" role="status" style={{ ["--h" as string]: b.hue }}>
      <Avatar agent={b} size={34} still label={false} />
      <span>
        <b>{b.name}</b> took this one — {b.title.toLowerCase()} is {b.name}'s job. <span className="faint">({a.name} passed it on.)</span>
      </span>
    </div>
  );
}

export function AgentBubble({ reply, onHandoff, onDeeper, upgraded }: { reply: Reply; onHandoff?: (id: TeamId) => void; onDeeper?: () => void; upgraded?: boolean }) {
  return (
    <div className={`ca mode-${reply.mode} ${upgraded ? "is-upgraded" : ""}`}>
      <div className="ca-text">
        {reply.text.split(/\n+/).map((l, i) => (/^\s*[-•*]\s/.test(l) ? <li key={i}>{l.replace(/^\s*[-•*]\s*/, "")}</li> : <p key={i}>{l}</p>))}
      </div>
      <div className="ca-meta">
        <span className={`ca-mode ${reply.mode}`}>{MODE_LABEL[reply.mode]}{upgraded ? " · updated with more detail ✓" : ""}</span>
        {reply.flags.unverified.length > 0 && (
          <span className="ca-flag" title="A sentence with these figures was removed: they aren't in OVEREO's sources or your data">
            <Icon name="alert" size={12} /> Figure check: removed {reply.flags.unverified.join(", ")} — not in OVEREO's sources
          </span>
        )}
      </div>
      {reply.note && <p className="faint small ca-note">{reply.note}</p>}
      {reply.sources.length > 0 && (
        <div className="ca-sources">
          {reply.sources.map((s) =>
            s.href ? (
              s.href.startsWith("/") ? (
                <Link key={s.source} className="src-chip" href={s.href}>
                  {s.source}
                </Link>
              ) : (
                <a key={s.source} className="src-chip" href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.source} <Icon name="external" size={10} />
                </a>
              )
            ) : (
              <span key={s.source} className="src-chip">
                {s.source}
              </span>
            ),
          )}
        </div>
      )}
      {(reply.actions.length > 0 || reply.handoff || (reply.mode === "device" && onDeeper)) && (
        <div className="ca-actions">
          {reply.actions.map((a) => (
            <button key={a.route} className="btn ghost sm" onClick={() => navigate(a.route)}>
              {a.label} <Icon name="arrow" size={12} />
            </button>
          ))}
          {reply.handoff && onHandoff && (
            <button className="btn sm" onClick={() => onHandoff(reply.handoff!.id)}>
              Ask {reply.handoff.name} ({reply.handoff.title.toLowerCase()})
            </button>
          )}
          {reply.mode === "device" && onDeeper && (
            <button className="chip" onClick={onDeeper}>
              <Icon name="sparkle" size={12} /> Explain more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
