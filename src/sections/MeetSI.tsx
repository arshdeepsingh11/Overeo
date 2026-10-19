"use client";

import { useEffect, useState } from "react";
import { openSI, useStore, uid } from "../core/store";
import { Orb } from "../si/Orb";
import { Icon, type IconName } from "../ui/Icon";
import { AnimatedList, Text3DFlip } from "../ui/Motion";

/* ------------------------------------------------------------------ *
 * The dedication to Overeo SI — a physical keycap you can press, a
 * live demo conversation, and a prompt that opens SI with your words.
 * ------------------------------------------------------------------ */

const DEMO: { q: string; a: string }[] = [
  { q: "Why is she so tired?", a: "Heavy flow in 5 of 6 cycles and ferritin 41 → 22. Iron is running down — here's what to ask." },
  { q: "Explain her Ovarian Clock", a: "Markers look most typical around 36.5 — about 2.5 years ahead. Timing and options, not a verdict." },
  { q: "Enter space", a: "Opening her whole picture as a spatial dashboard. Drag to turn it." },
  { q: "Is this endometriosis?", a: "I can't diagnose — but pain ≥7/10 in 5 of 6 cycles is a strong pattern. Let's print a dossier." },
  { q: "Calm mood", a: "Softening the light. It'll follow her cycle again when you say “auto mood”." },
];

const CAPS: { icon: IconName; t: string; d: string }[] = [
  { icon: "eye", t: "Knows where you are", d: "Opens with the section you came from as context." },
  { icon: "layers", t: "Reads everything together", d: "Cycle, labs, genome, wearables — one answer." },
  { icon: "bolt", t: "Acts when you ask", d: "Changes the page, runs simulations, drafts plans." },
  { icon: "shield", t: "Shows its working", d: "What it used, what it didn't have, its limits." },
];

export function MeetSI() {
  const [pressed, setPressed] = useState(false);
  const [feed, setFeed] = useState<{ id: string; role: "q" | "a"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const reduce = useStore((s) => s.reducedMotion);

  // the keycap mirrors real O presses anywhere on the page
  useEffect(() => {
    const dn = (e: KeyboardEvent) => (e.key === "o" || e.key === "O") && setPressed(true);
    const up = (e: KeyboardEvent) => (e.key === "o" || e.key === "O") && setPressed(false);
    addEventListener("keydown", dn);
    addEventListener("keyup", up);
    return () => {
      removeEventListener("keydown", dn);
      removeEventListener("keyup", up);
    };
  }, []);

  // looping demo conversation
  useEffect(() => {
    let i = 0;
    let stop = false;
    const step = () => {
      if (stop) return;
      const d = DEMO[i % DEMO.length];
      setFeed((f) => [{ id: uid("q"), role: "q" as const, text: d.q }, ...f].slice(0, 6));
      setTimeout(() => !stop && setFeed((f) => [{ id: uid("a"), role: "a" as const, text: d.a }, ...f].slice(0, 6)), 1300);
      i++;
      setTimeout(step, reduce ? 6000 : 4200);
    };
    step();
    return () => {
      stop = true;
    };
  }, [reduce]);

  return (
    <section id="si" className="section meet-si">
      <div className="wrap meet-grid">
        <div className="meet-left">
          <button
            className={`keycap ${pressed ? "down" : ""}`}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => {
              setPressed(false);
              openSI();
            }}
            onPointerLeave={() => setPressed(false)}
            aria-label="Press O to open Overeo SI"
          >
            <span className="keycap-base" aria-hidden="true" />
            <span className="keycap-top" aria-hidden="true">
              <span className="keycap-o">O</span>
              <span className="keycap-orb">
                <Orb state={pressed ? "listening" : "idle"} level={pressed ? 0.6 : 0} size={120} />
              </span>
            </span>
            <span className="keycap-ring" aria-hidden="true" />
          </button>
          <div className="keycap-hints">
            <span>
              <span className="kbd">O</span> anywhere to open
            </span>
            <span>
              hold <span className="kbd">O</span> to talk
            </span>
            <span>
              <span className="kbd">⌘</span>
              <span className="kbd">K</span> also works
            </span>
          </div>
        </div>
        <div className="meet-right">
          <span className="eyebrow">
            <span className="dot" /> Symbiotic Intelligence
          </span>
          <h2 className="title-lg">
            Meet <Text3DFlip text="Overeo" /> <span className="serif grad-text">SI.</span>
          </h2>
          <p className="lede">
            Not a chatbot in the corner. Press <b>O</b> wherever you are and it rises over the page — already knowing what you were looking at.
          </p>
          <ul className="caps">
            {CAPS.map((c) => (
              <li key={c.t} className="glass cap">
                <Icon name={c.icon} size={20} />
                <div>
                  <b>{c.t}</b>
                  <span className="muted small">{c.d}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="meet-demo glass">
            <div className="meet-demo-head">
              <Orb state="thinking" size={26} />
              <span className="small muted">Live demo</span>
            </div>
            <AnimatedList
              items={feed}
              max={4}
              render={(m) => <div className={`demo-msg ${m.role}`}>{m.text}</div>}
            />
          </div>
          <form
            className="meet-try glass"
            onSubmit={(e) => {
              e.preventDefault();
              openSI(draft.trim() || null);
              setDraft("");
            }}
          >
            <Icon name="sparkle" size={18} />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Try: “What does her AMH mean?”" aria-label="Ask Overeo SI" />
            <button className="btn sm" type="submit">
              Ask <Icon name="arrow" size={15} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
