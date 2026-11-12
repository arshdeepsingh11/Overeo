"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "../../../ui/Icon";
import { SPECIALISTS, TEAM, teamById, type TeamId } from "../../../agents/team";
import { runTeam, sharedFacts, type TeamEvent } from "../../../agents/client";
import type { Source } from "../../../agents/engine";
import { useSpace } from "../../../personal/space";
import { AppPage, Card } from "../kit";
import { Character, type CharState } from "./Character";
import { AgentConsole, MODE_LABEL } from "./AgentConsole";

/* =====================================================================
   Ask the team — several agents work on one request: the right
   specialists take their part, ORA checks every claim, Overeo SI
   presents one answer. Each agent lights up as it works.
   ===================================================================== */

const EXAMPLES = [
  "I'm 34 and thinking about freezing my eggs — what should I know and check?",
  "I'm always tired and my periods are heavy. What could be going on?",
  "Help me prepare for my gynaecologist about pelvic pain.",
  "Hot flashes and bad sleep — where do I start?",
];

type Final = Extract<TeamEvent, { type: "final" }>;

export function TeamScreen() {
  const ready = useSpace((s) => s.ready);
  const [q, setQ] = useState("");
  const [stages, setStages] = useState<TeamId[]>([]);
  const [st, setSt] = useState<Partial<Record<TeamId, CharState>>>({});
  const [notes, setNotes] = useState<{ agent: TeamId; summary: string; sources?: Source[] }[]>([]);
  const [verify, setVerify] = useState<{ kept: number; removed: number; removedText?: string[] } | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  const [running, setRunning] = useState(false);
  const [chat, setChat] = useState<TeamId | null>(null);
  const [showFacts, setShowFacts] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const go = async (text: string) => {
    const t = text.trim();
    if (!t || running) return;
    setQ(t);
    abort.current?.abort();
    abort.current = new AbortController();
    setRunning(true);
    setStages([]);
    setSt({});
    setNotes([]);
    setVerify(null);
    setFinal(null);
    await runTeam(
      t,
      (e) => {
        if (e.type === "plan") {
          setStages(e.stages);
          setSt(Object.fromEntries(e.stages.map((s) => [s, "waiting"])));
        } else if (e.type === "stage_start") setSt((x) => ({ ...x, [e.agent]: "thinking" }));
        else if (e.type === "stage_done") {
          setSt((x) => ({ ...x, [e.agent]: "done" }));
          setNotes((x) => [...x.filter((n) => n.agent !== e.agent), { agent: e.agent, summary: e.summary, sources: e.sources }]);
        } else if (e.type === "verify") {
          setVerify(e);
          // show each agent's notes only as ORA verified them
          if (e.notes) setNotes((x) => x.map((n) => (n.agent === "ora" || n.agent === "si" ? n : { ...n, summary: e.notes!.find((v) => v.agent === n.agent)?.text || "Nothing from this agent passed ORA's check." })));
        } else if (e.type === "final") {
          setFinal(e);
          setSt((x) => ({ ...x, si: "speaking" }));
        }
      },
      abort.current.signal,
    );
    setRunning(false);
  };

  if (!ready) return <AppPage title="Ask the team">{<div className="askel" />}</AppPage>;

  const active = new Set(stages);
  return (
    <AppPage title="Ask the team" sub="Your agents work on it together — every claim checked before you see it." icon="users">
      <div className="team-grid">
        <Card className="team-ask" title="What do you need?" icon="sparkle">
          <form
            className="team-form"
            onSubmit={(e) => {
              e.preventDefault();
              void go(q);
            }}
          >
            <textarea className="ainput" rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Describe what's going on, or what you want to plan…" aria-label="Your request" maxLength={1200} />
            <div className="team-form-row">
              <button className="btn" type="submit" disabled={!q.trim() || running}>
                <Icon name="users" size={16} /> {running ? "The team is working…" : "Ask the team"}
              </button>
              <button type="button" className="linkish small" aria-expanded={showFacts} onClick={() => setShowFacts((x) => !x)}>
                What the team can see about me
              </button>
            </div>
          </form>
          {showFacts && <SharedFacts />}
          {!stages.length && (
            <div className="console-starters">
              {EXAMPLES.map((x) => (
                <button key={x} className="chip" onClick={() => void go(x)}>
                  {x}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="team-net" title="The team" icon="radar" action={<span className="faint small">Tap anyone to chat</span>}>
          <div className={`net ${stages.length ? "running" : ""}`}>
            {SPECIALISTS.map((a, i) => {
              const s = st[a.id] ?? (stages.length && !active.has(a.id) ? "idle" : "idle");
              return (
                <button key={a.id} className={`net-node ${active.has(a.id) ? "on" : stages.length ? "dim" : ""} s-${s}`} style={{ ["--i" as string]: i, ["--h" as string]: a.hue }} onClick={() => setChat(a.id)} aria-label={`Chat with ${a.name}, ${a.title}`}>
                  <Character agent={a} state={s} size={58} label={false} />
                  <b>{a.name}</b>
                  <span>{a.title}</span>
                </button>
              );
            })}
            {(["ora", "si"] as TeamId[]).map((id) => {
              const a = teamById(id)!;
              return (
                <div key={id} className={`net-node core ${active.has(id) ? "on" : ""} s-${st[id] ?? "idle"}`} style={{ ["--h" as string]: a.hue }}>
                  <Character agent={a} state={st[id] ?? "idle"} size={58} label={false} />
                  <b>{a.name}</b>
                  <span>{a.title}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {(stages.length > 0 || final) && (
          <Card className="team-run" title="How the team worked" icon="radar">
            <ol className="run-steps">
              {stages.map((id) => {
                const a = teamById(id)!;
                const n = notes.find((x) => x.agent === id);
                const s = st[id];
                return (
                  <li key={id} className={`run-step s-${s}`}>
                    <Character agent={a} state={s ?? "waiting"} size={34} label={false} />
                    <div>
                      <b>
                        {a.name} <span className="faint">· {a.title}</span>
                      </b>
                      <p className="small">
                        {id === "ora" && verify ? (verify.removed ? `Checked every statement — removed ${verify.removed} that OVEREO's sources don't support.` : "Checked every statement against OVEREO's sources and your data.") : n ? n.summary : s === "thinking" ? "Working…" : "Waiting…"}
                      </p>
                      {id === "ora" && verify?.removedText && verify.removedText.length > 0 && (
                        <details className="small faint">
                          <summary>What was removed</summary>
                          <ul>
                            {verify.removedText.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        {final && (
          <Card className={`team-final mode-${final.mode}`} title="The team's answer" icon="check">
            <div className="ca-text">
              {final.text.split(/\n+/).map((l, i) => (/^\s*[-•*]\s/.test(l) ? <li key={i}>{l.replace(/^\s*[-•*]\s*/, "")}</li> : <p key={i}>{l}</p>))}
            </div>
            <div className="ca-meta">
              <span className={`ca-mode ${final.mode}`}>{MODE_LABEL[final.mode]}</span>
              {final.flags.unverified.length > 0 && (
                <span className="ca-flag">
                  <Icon name="alert" size={12} /> Figure check: removed {final.flags.unverified.join(", ")} — not in OVEREO's sources
                </span>
              )}
            </div>
            {final.note && <p className="faint small ca-note">{final.note}</p>}
            {final.sources.length > 0 && (
              <div className="ca-sources">
                {final.sources.map((s) =>
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
            <p className="faint small">Educational, not a diagnosis. Bring the Visit summary to your clinician.</p>
            <div className="ca-actions">
              <Link className="btn ghost sm" href="/app/visit">
                Visit summary <Icon name="arrow" size={12} />
              </Link>
            </div>
          </Card>
        )}
      </div>
      {chat && <AgentConsole initial={chat} onClose={() => setChat(null)} />}
      <p className="sr-only">{TEAM.length} agents</p>
    </AppPage>
  );
}

function SharedFacts() {
  const facts = sharedFacts();
  return (
    <div className="mind-why">
      <div className="si-label">Shared with the team (no name, no raw entries)</div>
      {facts.length ? (
        <ul className="mind-facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : (
        <p className="small muted">Nothing — personal context is off, or there's no data yet. The team will use OVEREO's guides only.</p>
      )}
    </div>
  );
}
