"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { SPECIALISTS, teamById } from "../../agents/team";
import { useSpace } from "../../personal/space";
import { Avatar } from "./team/Avatar";
import { Icon } from "../../ui/Icon";
import { openSI } from "../../core/store";

/* =====================================================================
   "Your team today" — the agents, alive, at the top of Today. Each one
   says in a few words what she's doing for you right now. Tap one to
   talk; the ones you've switched off rest quietly.
   ===================================================================== */

const ASK: Record<string, string> = {
  cycle: "When is my next period?",
  labs: "Explain my latest lab result",
  visit: "Help me prepare for my doctor visit",
  reminders: "What reminders do I have?",
  meds: "Can I take ibuprofen with my pill?",
  mood: "How is my sleep affecting my mood?",
  fertility: "When is my fertile window?",
  meno: "Could I be in perimenopause?",
};

export function TeamStrip() {
  const agents = useSpace((s) => s.agents);
  const inbox = useSpace((s) => s.inbox);
  const reminders = useSpace((s) => s.reminders);
  const records = useSpace((s) => s.records.length);
  const status = (id: string): string => {
    const st = agents[id as keyof typeof agents];
    if (st && !st.enabled) return "Resting · switched off";
    const n = inbox.filter((x) => x.agent === id && x.status === "pending").length;
    if (n) return `${n} idea${n === 1 ? "" : "s"} for you`;
    if (id === "reminders") {
      const r = reminders.filter((x) => !x.done).length;
      return r ? `Keeping ${r} reminder${r === 1 ? "" : "s"}` : "No reminders yet";
    }
    if (!records) return "Waiting for your first log";
    return id === "cycle" ? "Watching your rhythm" : id === "labs" ? "Reading your results" : id === "mood" ? "Linking sleep & mood" : "On watch";
  };
  const list = [...SPECIALISTS, teamById("si")!];
  return (
    <section className="tstrip" aria-label="Your team today">
      <div className="tstrip-head">
        <span>
          <Icon name="users" size={14} /> Your team today
        </span>
        <Link href="/app/team" className="sec-link">
          Ask them together <Icon name="arrow" size={13} />
        </Link>
      </div>
      <div className="tstrip-row">
        {list.map((a, i) => {
          const off = a.id !== "si" && agents[a.id as keyof typeof agents] && !agents[a.id as keyof typeof agents].enabled;
          return (
            <button key={a.id} className={`tstrip-a ${off ? "off" : ""}`} style={{ "--h": a.hue, "--i": i } as CSSProperties} onClick={() => openSI(a.id === "si" ? null : ASK[a.id])} aria-label={`${a.name}, ${a.title}: ${a.id === "si" ? "ask anything" : status(a.id)}`}>
              <Avatar agent={a} size={64} label={false} state={off ? "waiting" : "idle"} />
              <b>{a.name}</b>
              <span>{a.id === "si" ? "Ask anything" : status(a.id)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
