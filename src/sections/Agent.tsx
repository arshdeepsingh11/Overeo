"use client";

import { useEffect, useRef, useState } from "react";
import { ownCommand } from "../core/bus";
import { useDerived } from "../core/derived";
import { store, useStore, uid, toast, type AgentTask } from "../core/store";
import { Terminal, type TermLine } from "../ui/Controls";
import { AnimatedList } from "../ui/Motion";
import { Icon } from "../ui/Icon";
import { addDays, fmtDate } from "../core/rng";

/* ------------------------------------------------------------------ *
 * OVEREO Agent — insight becomes action. A macOS-style terminal shows
 * the agent reasoning, proposing steps and waiting for approval. Type
 * commands too: help, plan, approve all, status, reset.
 * Nothing real is booked in this prototype.
 * ------------------------------------------------------------------ */

interface Step {
  id: string;
  title: string;
  owner: string;
  when: string;
  why: string;
}

export function Agent() {
  const d = useDerived();
  const tasks = useStore((s) => s.agentTasks);
  const [lines, setLines] = useState<TermLine[]>([
    { id: "l0", kind: "dim", text: "OVEREO Agent v0.9 — prototype. Nothing real is booked." },
    { id: "l1", kind: "dim", text: "Type “plan” or press Run plan. Type “help” for commands." },
  ]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Step[]>([]);
  const [events, setEvents] = useState<{ id: string; t: string; who: string; icon: "check" | "calendar" | "flask" | "doc" }[]>([]);
  const timers = useRef<number[]>([]);

  const push = (kind: TermLine["kind"], text: string) => setLines((l) => [...l, { id: uid("l"), kind, text }]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const plan = (): Step[] => {
    const now = d.profile.today;
    const steps: Step[] = [];
    const iron = d.signals.find((s) => s.id === "iron" && s.level !== "watch");
    const endo = d.signals.find((s) => s.id === "endo" && s.level !== "watch");
    if (iron)
      steps.push({ id: "s1", title: "Repeat ferritin + CBC — at-home collection", owner: "BioAro Labs · NEYU at-home", when: `${fmtDate(addDays(now, 3))} 08:30`, why: iron.evidence[1] });
    if (endo)
      steps.push({ id: "s2", title: "Virtual visit: cyclical pelvic pain", owner: "OVEREO women's health · NEYU Virtual Care", when: `${fmtDate(addDays(now, 6))} 17:15`, why: endo.evidence[0] });
    steps.push({ id: "s3", title: "Send doctor-ready dossier to the visit", owner: "BioEMR", when: "before the visit", why: "So the first ten minutes aren't spent re-telling the history." });
    steps.push({ id: "s4", title: "Retest + review in 90 days", owner: "OVEREO", when: fmtDate(addDays(now, 90)), why: "Patterns need a second look to confirm direction." });
    return steps;
  };

  const runPlan = () => {
    if (busy) return;
    timers.current.forEach(clearTimeout);
    setBusy(true);
    push("cmd", "plan");
    const steps = plan();
    later(500, () => push("out", `reading ${d.profile.logs.length} days of entries, ${d.profile.labs.length} lab series…`));
    later(1100, () => push("out", `signals: ${d.signals.filter((s) => s.level !== "watch").map((s) => s.title.toLowerCase()).join(", ") || "none above watch"}`));
    later(1700, () => push("out", "matching to in-house services and availability…"));
    steps.forEach((s, i) =>
      later(2300 + i * 450, () => {
        push("ask", `[${i + 1}] ${s.title}`);
        push("dim", `    ${s.owner} · ${s.when}`);
        push("dim", `    why: ${s.why}`);
      }),
    );
    later(2400 + steps.length * 450, () => {
      push("warn", "awaiting your approval for each step ↓");
      setPending(steps);
      setBusy(false);
    });
  };

  const approve = (s: Step) => {
    setPending((p) => p.filter((x) => x.id !== s.id));
    push("ok", `✓ approved: ${s.title}`);
    const task: AgentTask = { id: uid("task"), title: s.title, owner: s.owner, status: "approved", when: s.when };
    store.set((st) => ({ agentTasks: [task, ...st.agentTasks].slice(0, 8) }));
    const icon: "flask" | "calendar" | "doc" | "check" = s.id === "s1" ? "flask" : s.id === "s2" ? "calendar" : s.id === "s3" ? "doc" : "check";
    later(700, () => {
      setEvents((e) => [{ id: uid("e"), t: `${s.owner.split(" · ")[0]}: ${s.id === "s1" ? "kit dispatched" : s.id === "s2" ? "slot held" : s.id === "s3" ? "dossier attached" : "reminder set"} (simulated)`, who: s.when, icon }, ...e].slice(0, 6));
      store.set((st) => ({ agentTasks: st.agentTasks.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)) }));
    });
  };

  const decline = (s: Step) => {
    setPending((p) => p.filter((x) => x.id !== s.id));
    push("dim", `✗ skipped: ${s.title}`);
  };

  // SI and other sections can start the agent through the command bus
  const runRef = useRef(runPlan);
  runRef.current = runPlan;
  useEffect(
    () =>
      ownCommand("run-agent", () => later(600, () => runRef.current())),
    [],
  );

  const onCmd = (raw: string) => {
    const c = raw.toLowerCase();
    if (c === "help") {
      push("cmd", raw);
      ["plan — draft next steps from her signals", "approve all — approve every pending step", "status — list approved tasks", "reset — clear the session"].forEach((t) => push("dim", "  " + t));
    } else if (c === "plan" || c === "run") runPlan();
    else if (c === "approve all" || c === "yes") {
      push("cmd", raw);
      pending.forEach(approve);
      if (!pending.length) push("dim", "nothing waiting.");
    } else if (c === "status") {
      push("cmd", raw);
      if (!tasks.length) push("dim", "no tasks yet.");
      tasks.forEach((t) => push(t.status === "done" ? "ok" : "out", `${t.status === "done" ? "✓" : "…"} ${t.title} — ${t.when}`));
    } else if (c === "reset" || c === "clear") {
      setLines([{ id: uid("l"), kind: "dim", text: "session cleared." }]);
      setPending([]);
      store.set({ agentTasks: [] });
    } else {
      push("cmd", raw);
      push("warn", `I don't run “${raw}” yet. Try: plan, approve all, status.`);
    }
  };

  return (
    <section id="agent" className="section agent">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">
            <span className="dot" /> OVEREO Agent
          </span>
          <h2 className="title-lg">
            From insight to <span className="serif grad-text">action</span> — with your yes at every step.
          </h2>
          <p className="lede">The agent books, prepares and follows up across the ecosystem. It never acts on its own.</p>
        </div>
        <div className="agent-grid">
          <Terminal
            title="overeo — agent — 80×24"
            lines={lines}
            busy={busy}
            onCommand={onCmd}
            footer={
              pending.length ? (
                <div className="term-approve">
                  {pending.map((s) => (
                    <div key={s.id} className="approve-row">
                      <span className="small">{s.title}</span>
                      <span className="approve-btns">
                        <button className="btn sm" onClick={() => approve(s)}>
                          Approve
                        </button>
                        <button className="btn ghost sm" onClick={() => decline(s)}>
                          Skip
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <button className="btn sm" onClick={runPlan} disabled={busy}>
                  <Icon name="bolt" size={15} /> Run plan
                </button>
              )
            }
          />
          <div className="agent-side">
            <div className="glass agent-feed">
              <div className="small faint" style={{ marginBottom: 8 }}>
                Activity
              </div>
              {events.length === 0 ? (
                <div className="empty-smart">
                  <Icon name="sparkle" size={18} />
                  <span className="small muted">No activity yet. Run the plan — I'll show every step here as it happens.</span>
                </div>
              ) : (
                <AnimatedList
                  items={events}
                  render={(e) => (
                    <div className="feed-item">
                      <span className="feed-ic">
                        <Icon name={e.icon} size={16} />
                      </span>
                      <span>
                        <span className="small">{e.t}</span>
                        <span className="faint small"> · {e.who}</span>
                      </span>
                    </div>
                  )}
                />
              )}
            </div>
            <div className="glass agent-tasks">
              <div className="small faint" style={{ marginBottom: 8 }}>
                Approved tasks · also in Space
              </div>
              {tasks.length === 0 ? (
                <span className="small muted">Approved steps appear here.</span>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} className="task">
                    <span className={`task-dot ${t.status}`} />
                    <span className="small">{t.title}</span>
                    <span className="faint small">{t.when}</span>
                  </div>
                ))
              )}
              {tasks.length > 0 && (
                <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => toast("Tasks shared with her care team (simulated)")}>
                  Share with care team
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
