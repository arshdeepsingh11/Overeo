"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../ui/Icon";
import { AGENTS, agentById, type AgentDef } from "../../personal/agents";
import { approve, dismiss } from "../../personal/actions";
import { removeReminder, setAgent, space, useSpace, diary as logDiary } from "../../personal/space";
import { useT } from "../../personal/useT";
import type { AgentId, AgentSettings, Frequency, Suggestion } from "../../personal/types";
import { AppPage, Card, Empty, Sheet, Switch, ago, fmtDate, fmtTime, toLocalInput } from "./kit";

/* ======================= Inbox card (used on Today too) ======================= */

export function SuggestionCard({ s }: { s: Suggestion }) {
  const t = useT();
  const a = agentById(s.agent);
  const [why, setWhy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [due, setDue] = useState(s.due ? toLocalInput(s.due) : "");
  const [asking, setAsking] = useState(false);
  const yes = s.kind === "log" ? "Open" : s.kind === "info" ? "Show me" : s.kind === "summary" ? "Prepare it" : s.kind === "test" ? "Save it" : t("inbox.approve");
  return (
    <article className="sg" style={{ ["--h" as string]: a.hue }}>
      <div className="sg-top">
        <span className="sg-ic">
          <Icon name={a.icon} size={16} />
        </span>
        <span className="sg-agent">{a.name}</span>
        <span className="sg-time">{ago(s.createdAt)}</span>
      </div>
      <b className="sg-title">{s.title}</b>
      <p className="sg-body">{s.body}</p>
      {s.due && s.kind === "reminder" && !editing && (
        <p className="sg-due">
          <Icon name="bell" size={13} /> {fmtDate(s.due)} · {fmtTime(s.due)}
        </p>
      )}
      {editing && (
        <label className="sg-edit">
          <span>When</span>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      )}
      {why && (
        <ul className="sg-why">
          {s.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {asking ? (
        <div className="sg-reasons" role="group" aria-label="Why not?">
          <span className="faint small">Why not? It helps me learn.</span>
          <button className="chip" onClick={() => dismiss(s.id, "not-relevant")}>
            Not relevant
          </button>
          <button className="chip" onClick={() => dismiss(s.id, "wrong")}>
            It's wrong
          </button>
          <button className="chip" onClick={() => dismiss(s.id, "later")}>
            {t("inbox.later")}
          </button>
        </div>
      ) : (
        <div className="sg-actions">
          <button className="btn sm" onClick={() => approve(s.id, editing && due ? { due: new Date(due).toISOString() } : undefined)}>
            <Icon name="check" size={15} /> {editing ? t("common.save") : yes}
          </button>
          {s.kind === "reminder" && !editing && (
            <button className="btn ghost sm" onClick={() => setEditing(true)}>
              <Icon name="edit" size={14} /> {t("inbox.edit")}
            </button>
          )}
          <button className="btn ghost sm" onClick={() => setAsking(true)}>
            {t("inbox.dismiss")}
          </button>
          <button className="sg-whybtn" aria-expanded={why} onClick={() => setWhy((w) => !w)}>
            {t("inbox.why")}
          </button>
        </div>
      )}
    </article>
  );
}

/* ================================ Inbox ================================ */

export function InboxScreen() {
  const t = useT();
  const inbox = useSpace((s) => s.inbox);
  const pending = inbox.filter((x) => x.status === "pending");
  const done = inbox.filter((x) => x.status !== "pending").slice(0, 12);
  return (
    <AppPage title={t("inbox.title")} sub="Suggestions from your agents. Nothing happens until you say yes." icon="inbox">
      {pending.length ? (
        <div className="sg-list">
          {pending.map((s) => (
            <SuggestionCard key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <Empty icon="check" title={t("today.nothing")} body="Your agents keep watching your data and will ask when something's worth your time." />
      )}
      {done.length > 0 && (
        <Card title="Handled" icon="book" className="mt">
          <ul className="arows">
            {done.map((x) => (
              <li key={x.id}>
                <span className={`arow-dot ${x.status}`} />
                <span className="arow-main">
                  {x.title}
                  <span className="faint small"> · {x.status === "approved" ? "done" : x.status === "snoozed" ? "later" : "dismissed"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppPage>
  );
}

/* ================================ Agents ================================ */

export function AgentsScreen() {
  const t = useT();
  const agents = useSpace((s) => s.agents);
  const inbox = useSpace((s) => s.inbox);
  useSpace((s) => s.account); // re-render when goals change
  const [open, setOpen] = useState<AgentId | null>(null);
  const relevant = AGENTS.filter((a) => !a.relevant || a.relevant(space.get()));
  const others = AGENTS.filter((a) => a.relevant && !a.relevant(space.get()));
  return (
    <AppPage
      title={t("agents.title")}
      sub={t("agents.sub")}
      icon="bot"
      actions={
        <Link className="btn ghost sm" href="/app/diary">
          <Icon name="book" size={15} /> {t("diary.title")}
        </Link>
      }
    >
      <div className="trust-strip">
        {[
          ["check", "Asks before acting"],
          ["eye", "Shows its reasons"],
          ["book", "Every action in your diary"],
          ["pause", "Pause any agent, any time"],
        ].map(([ic, txt]) => (
          <span key={txt}>
            <Icon name={ic as "check"} size={14} /> {txt}
          </span>
        ))}
      </div>
      <div className="agent-grid">
        {relevant.map((a) => (
          <AgentCard key={a.id} a={a} st={agents[a.id]} pending={inbox.filter((x) => x.agent === a.id && x.status === "pending").length} onOpen={() => setOpen(a.id)} />
        ))}
      </div>
      {others.length > 0 && (
        <p className="faint small mt">
          Also available when relevant: {others.map((a) => a.name).join(", ")} — they appear when your goals or life stage include them.
        </p>
      )}
      {open && <AgentSettingsSheet a={agentById(open)} st={agents[open]} onClose={() => setOpen(null)} />}
    </AppPage>
  );
}

function AgentCard({ a, st, pending, onOpen }: { a: AgentDef; st: AgentSettings; pending: number; onOpen: () => void }) {
  const t = useT();
  return (
    <div className={`agent ${st.enabled ? "" : "off"}`} style={{ ["--h" as string]: a.hue }}>
      <div className="agent-top">
        <span className="agent-ic">
          <Icon name={a.icon} size={18} />
        </span>
        <span className="agent-name">
          <b>{a.name}</b>
          <span className={`agent-state ${st.enabled ? "on" : ""}`}>{st.enabled ? t("agents.on") : t("agents.off")}</span>
        </span>
        <Switch on={st.enabled} onChange={(v) => setAgent(a.id, { enabled: v })} label={`${a.name} on or off`} />
      </div>
      <p className="agent-job">{a.job}</p>
      <div className="agent-meta">
        <span>{FREQ[st.frequency]}</span>
        {st.never.length > 0 && <span>{st.never.length} never-rule{st.never.length === 1 ? "" : "s"}</span>}
        {pending > 0 && <span className="agent-pending">{pending} waiting</span>}
      </div>
      <button className="agent-set" onClick={onOpen}>
        <Icon name="settings" size={14} /> Teach this agent
      </button>
    </div>
  );
}

const FREQ: Record<Frequency, string> = { important: "Only when it matters", daily: "At most daily", weekly: "At most weekly" };
const MAY: { k: keyof AgentSettings["may"]; label: string }[] = [
  { k: "remind", label: "Set reminders (after I approve)" },
  { k: "suggestTests", label: "Suggest tests" },
  { k: "summaries", label: "Prepare summaries" },
  { k: "notify", label: "Send notifications" },
];
const NEVER_IDEAS = ["Never mention fertility", "Never mention weight", "Never notify me at work hours", "Never suggest tests that cost money"];

function AgentSettingsSheet({ a, st, onClose }: { a: AgentDef; st: AgentSettings; onClose: () => void }) {
  const t = useT();
  const [rule, setRule] = useState("");
  const addRule = (r: string) => {
    const v = r.trim();
    if (!v || st.never.includes(v)) return;
    setAgent(a.id, { never: [...st.never, v] });
    setRule("");
  };
  return (
    <Sheet open onClose={onClose} title={a.name}>
      <p className="muted small">{a.job}</p>
      <div className="aset">
        <span className="aset-k">{t("agents.may")}</span>
        {MAY.map((m) => (
          <div key={m.k} className="aset-row">
            <span>{m.label}</span>
            <Switch on={st.may[m.k]} onChange={(v) => setAgent(a.id, { may: { ...st.may, [m.k]: v } })} label={m.label} />
          </div>
        ))}
      </div>
      <div className="aset">
        <span className="aset-k">{t("agents.never")}</span>
        <div className="aset-rules">
          {st.never.map((r) => (
            <span key={r} className="rule">
              {r}
              <button onClick={() => setAgent(a.id, { never: st.never.filter((x) => x !== r) })} aria-label={`Remove rule ${r}`}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="aset-add">
          <input value={rule} onChange={(e) => setRule(e.target.value)} placeholder="e.g. Never mention fertility" onKeyDown={(e) => e.key === "Enter" && addRule(rule)} aria-label="New never-rule" />
          <button className="btn sm" onClick={() => addRule(rule)}>
            Add
          </button>
        </div>
        <div className="aset-ideas">
          {NEVER_IDEAS.filter((x) => !st.never.includes(x)).map((x) => (
            <button key={x} className="chip" onClick={() => addRule(x)}>
              <Icon name="plus" size={12} /> {x}
            </button>
          ))}
        </div>
      </div>
      <div className="aset">
        <span className="aset-k">{t("agents.often")}</span>
        <div className="seg">
          {(Object.keys(FREQ) as Frequency[]).map((f) => (
            <button key={f} className={`seg-btn ${st.frequency === f ? "on" : ""}`} onClick={() => setAgent(a.id, { frequency: f })}>
              {FREQ[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="aset">
        <span className="aset-k">Quiet hours</span>
        <div className="aset-row">
          <span>
            No notifications from {st.quiet.from}:00 to {st.quiet.to}:00
          </span>
          <span className="aset-quiet">
            <select value={st.quiet.from} onChange={(e) => setAgent(a.id, { quiet: { ...st.quiet, from: Number(e.target.value) } })} aria-label="Quiet from">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
            <select value={st.quiet.to} onChange={(e) => setAgent(a.id, { quiet: { ...st.quiet, to: Number(e.target.value) } })} aria-label="Quiet until">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>
      <p className="faint small">It also learns from you: dismiss the same kind of suggestion twice as “not relevant” and it stops sending that kind.</p>
      <button className="btn" onClick={onClose}>
        {t("common.done")}
      </button>
    </Sheet>
  );
}

/* ================================ Diary ================================ */

export function DiaryScreen() {
  const t = useT();
  const items = useSpace((s) => s.diary);
  const reminders = useSpace((s) => s.reminders);
  const name = (ag: string) => (ag === "you" ? "You" : ag === "si" ? "Overeo SI" : agentById(ag as AgentId)?.name ?? ag);
  const days = new Map<string, typeof items>();
  for (const e of items) {
    const k = new Date(e.at).toDateString();
    if (!days.has(k)) days.set(k, []);
    days.get(k)!.push(e);
  }
  return (
    <AppPage title={t("diary.title")} sub={t("diary.sub")} icon="book">
      {items.length === 0 ? (
        <Empty icon="book" title="Nothing yet" body="When an agent does something you approved, or you change a setting, it's written here — with the time." />
      ) : (
        <div className="diary">
          {[...days.entries()].map(([d, es]) => (
            <div key={d} className="diary-day">
              <span className="diary-date">{fmtDate(d, { weekday: "long", month: "long", day: "numeric" })}</span>
              <ul>
                {es.map((e) => {
                  const live = e.undo && reminders.some((r) => r.id === e.undo!.id);
                  return (
                    <li key={e.id} className="diary-e">
                      <span className="diary-t tnum">{fmtTime(e.at)}</span>
                      <span className="diary-main">
                        <b>{name(e.agent)}</b> · {e.action}
                        {e.detail && <span className="diary-d">{e.detail}</span>}
                      </span>
                      {live && (
                        <button
                          className="chip"
                          onClick={() => {
                            removeReminder(e.undo!.id);
                            logDiary("you", "Undid a reminder", e.detail);
                          }}
                        >
                          Undo
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </AppPage>
  );
}
