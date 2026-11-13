"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { store, useStore, closeSI, uid } from "../core/store";
import { useDerived } from "../core/derived";
import { run, labelFor, type Command } from "../core/bus";
import { PHASE_META } from "../core/engines/forecast";
import { levelLabel } from "../core/engines/signals";
import { Icon } from "../ui/Icon";
import { CircularProgress } from "../ui/Motion";
import { chime, tick } from "../lib/audio";
import { Orb, type OrbState } from "./Orb";
import { ask, siMode } from "./provider";
import { suggestionsFor } from "./engine";
import { listen, speak, stopSpeaking, voiceSupported, speakSupported, micLevel, type Listener } from "./voice";
import type { SIAnswer, SIContext, SIMessage, SIViz } from "./types";
import { useSpace, voteAnswer } from "../personal/space";
import { runMindAction } from "../personal/mind/act";
import { model } from "../personal/mind";
import type { MindAction } from "../personal/mind/answer";
import { sureLabel } from "../personal/mind/stats";
import { Avatar } from "../views/app/team/Avatar";
import { AgentStage } from "../views/app/team/AgentStage";
import type { CharState } from "../views/app/team/Character";
import { logChat as saveChat } from "../cloud/sync";
import { teamById, type TeamId } from "../agents/team";

/* =====================================================================
   Overeo SI — Symbiotic Intelligence.
   Press O anywhere (outside a text field) to call it; hold O to talk;
   ⌘/Ctrl-K also works. Esc closes. It knows which part of the page you
   came from, shows the context it's allowed to use, streams grounded
   answers, and can act on the page when you ask.
   ===================================================================== */

const GREET = ["What would you like to understand?", "Ask about her biology — or tell me what to do.", "I'm reading everything together. Ask away."];

export function OvereoSI() {
  const open = useStore((s) => s.siOpen);
  const seed = useStore((s) => s.siSeed);
  const listenReq = useStore((s) => s.siListen);
  const section = useStore((s) => s.activeSection);
  const demoName = useStore((s) => s.profile.name);
  const demoSample = useStore((s) => s.profile.isSample);
  const spaceReady = useSpace((s) => s.ready);
  const spaceName = useSpace((s) => s.account?.name);
  const spaceMode = useSpace((s) => s.mode);
  const portal = spaceReady && typeof location !== "undefined" && /^\/app(\/|$)/.test(location.pathname) && !/^\/app\/(welcome|signin)/.test(location.pathname);
  const profileName = portal ? (spaceName ?? "You") : demoName;
  const isSample = portal ? spaceMode === "sample" : demoSample;
  const [msgs, setMsgs] = useState<SIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [orb, setOrb] = useState<OrbState>("idle");
  const [level, setLevel] = useState(0);
  const [ctx, setCtx] = useState<SIContext>({ section, useProfile: true, useSignals: true });
  const [voiceOut, setVoiceOut] = useState(() => {
    try {
      return localStorage.getItem("overeo.siVoice") === "on";
    } catch {
      return false;
    }
  });
  const [err, setErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState(section);
  const inputRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const rec = useRef<Listener | null>(null);
  const mic = useRef<{ read: () => number; close: () => void } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);
  // the agent on stage "speaks" for a moment after each answer arrives
  const [speakTill, setSpeakTill] = useState(0);
  const [, rerender] = useState(0);
  const narrow = useNarrow();
  const talkFor = (a: SIAnswer) => setSpeakTill(Date.now() + Math.min(6500, Math.max(1800, a.summary.split(/\s+/).length * 60)));
  useEffect(() => {
    if (!speakTill) return;
    const t = setTimeout(() => rerender((n) => n + 1), Math.max(0, speakTill - Date.now()) + 30);
    return () => clearTimeout(t);
  }, [speakTill]);

  // open/close lifecycle
  useEffect(() => {
    if (!open) {
      stopVoice();
      stopSpeaking();
      abort.current?.abort();
      document.documentElement.classList.remove("si-lock");
      return;
    }
    chime();
    setOrigin(store.get().activeSection);
    setCtx((c) => ({ ...c, section: store.get().activeSection }));
    document.documentElement.classList.add("si-lock");
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => {
      clearTimeout(t);
      // the overlay unmounts when closed — always release voice and scroll
      stopVoice();
      stopSpeaking();
      abort.current?.abort();
      document.documentElement.classList.remove("si-lock");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // seeded question (from buttons around the site)
  useEffect(() => {
    if (open && seed) {
      store.set({ siSeed: null });
      void send(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  // hold-O push-to-talk
  useEffect(() => {
    if (open && listenReq && !rec.current) startVoice();
    if (open && !listenReq && rec.current) rec.current.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listenReq]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: store.get().reducedMotion ? "auto" : "smooth" });
  }, [msgs]);

  // keep the conversation in her account (signed-in profiles only)
  const convId = useRef(uid("c"));
  const logChat = (q: string, a: SIAnswer) =>
    saveChat(convId.current, "si", q, [
      { id: uid("m"), role: "user", text: q },
      { id: uid("m"), role: "assistant", agent: a.agent ?? null, text: [a.title, a.summary, ...(a.points ?? [])].join("\n"), meta: { source: a.source } },
    ]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setErr(null);
      history.current.unshift(q);
      histIdx.current = -1;
      const userMsg: SIMessage = { id: uid("m"), role: "user", text: q };
      const siMsg: SIMessage = { id: uid("m"), role: "si", text: "", status: "thinking" };
      setMsgs((m) => [...m, userMsg, siMsg]);
      setInput("");
      setBusy(true);
      setOrb("thinking");
      tick(900);
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      try {
        let instant = false;
        const { answer, remote } = await ask(
          q,
          { ...ctx, section: origin },
          msgs,
          // once an instant answer is showing, the live one replaces it when it's complete (no flicker)
          (partial) => !instant && setMsgs((m) => m.map((x) => (x.id === siMsg.id ? { ...x, status: "streaming", text: partial, remote: true } : x))),
          ac.signal,
          {
            onAgent: (agent) => setMsgs((m) => m.map((x) => (x.id === siMsg.id ? { ...x, agent } : x))),
            onInstant: (a) => {
              instant = true;
              talkFor(a);
              setOrb("idle");
              setMsgs((m) => m.map((x) => (x.id === siMsg.id ? { ...x, answer: a, status: "done", remote: false } : x)));
            },
          },
        );
        talkFor(answer);
        if (instant) {
          setMsgs((m) => m.map((x) => (x.id === siMsg.id ? { ...x, answer, status: "done", remote: true, upgraded: remote, kept: !remote } : x)));
          logChat(q, answer);
          return;
        }
        // run instant effects (theme, mood…) now; navigation after the user has seen the reply
        const fx = answer.effects ?? [];
        const nav = fx.some((c) => c.type === "goto" || c.type === "mode");
        if (!nav) fx.forEach((c) => run(c));
        setMsgs((m) => m.map((x) => (x.id === siMsg.id ? { ...x, answer, status: "streaming", remote } : x)));
        logChat(q, answer);
        if (voiceOut) {
          setOrb("speaking");
          speak(answer.summary, undefined, () => setOrb("idle"));
        } else setOrb("idle");
        if (nav) setTimeout(() => fx.forEach((c) => run(c)), 1400);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setErr("Something went wrong. Try again.");
        setOrb("idle");
      } finally {
        setBusy(false);
      }
    },
    [busy, ctx, msgs, origin, voiceOut],
  );

  function startVoice() {
    if (!voiceSupported) {
      setErr("Voice input needs Chrome, Edge or Safari. You can still type.");
      store.set({ siListen: false });
      return;
    }
    stopSpeaking();
    setErr(null);
    setOrb("listening");
    rec.current = listen({
      onPartial: (t) => setInput(t),
      onFinal: (t) => void send(t),
      onEnd: () => {
        rec.current = null;
        stopMic();
        store.set({ siListen: false });
        setOrb((o) => (o === "listening" ? "idle" : o));
      },
      onError: (m) => {
        setErr(m);
        setOrb("idle");
      },
    });
    void micLevel().then((m) => {
      if (!m) return;
      mic.current = m;
      const loop = () => {
        if (!mic.current) return;
        setLevel(mic.current.read());
        requestAnimationFrame(loop);
      };
      loop();
    });
  }
  function stopMic() {
    mic.current?.close();
    mic.current = null;
    setLevel(0);
  }
  function stopVoice() {
    rec.current?.abort();
    rec.current = null;
    stopMic();
  }

  if (!open) return null;

  // who is on stage: the agent answering the latest question (Overeo SI until someone takes one)
  const lastSi = [...msgs].reverse().find((x) => x.role === "si");
  const stageAgent = ((lastSi && (lastSi.agent ?? lastSi.answer?.agent)) || "si") as TeamId;
  const stageState: CharState =
    orb === "listening" ? "listening" : busy && lastSi && !lastSi.answer ? "thinking" : (voiceOut && orb === "speaking") || Date.now() < speakTill ? "speaking" : input.trim() ? "listening" : "idle";
  const secLabel = portal ? "Your space" : labelFor(origin);
  const sugg = portal ? portalSuggestions() : suggestionsFor(origin);
  const empty = msgs.length === 0;

  return (
    <div className="si-root" role="dialog" aria-modal="true" aria-label="Overeo SI">
      <div className="si-backdrop" onClick={closeSI} />
      <div className="si-panel glass-thick holo">
        <header className="si-head">
          <div className="si-brand">
            <Orb state={orb} level={level} size={34} />
            <div>
              <div className="si-name">
                Overeo <span className="serif">SI</span>
              </div>
              <div className="si-sub" aria-live="polite">{sourceLabel(lastSource(msgs), portal)}</div>
            </div>
          </div>
          <div className="si-head-actions">
            {speakSupported && (
              <button
                className={`chip ${voiceOut ? "on" : ""}`}
                onClick={() => {
                  const v = !voiceOut;
                  setVoiceOut(v);
                  if (!v) stopSpeaking();
                  try {
                    localStorage.setItem("overeo.siVoice", v ? "on" : "off");
                  } catch {}
                }}
                aria-pressed={voiceOut}
              >
                <Icon name={voiceOut ? "sound" : "mute"} size={14} /> Speak replies
              </button>
            )}
            {msgs.length > 0 && (
              <button className="chip" onClick={() => setMsgs([])}>
                <Icon name="refresh" size={14} /> New
              </button>
            )}
            <button className="si-close" onClick={closeSI} aria-label="Close Overeo SI (Esc)">
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>

        <div className="si-body">
        <AgentStage agent={stageAgent} state={stageState} compact={narrow} />
        <div className="si-col">
        <div className="si-context" aria-label="Context Overeo SI may use">
          <span className="faint small">Using</span>
          <span className="chip on-soft">
            <Icon name="eye" size={13} /> {secLabel}
          </span>
          <button className={`chip ${ctx.useProfile ? "on-soft" : "off"}`} onClick={() => setCtx((c) => ({ ...c, useProfile: !c.useProfile }))} aria-pressed={ctx.useProfile}>
            <Icon name="user" size={13} /> {profileName}
            {isSample ? " (sample)" : ""} {ctx.useProfile ? "×" : "+"}
          </button>
          {!portal && (
            <button className={`chip ${ctx.useSignals ? "on-soft" : "off"}`} onClick={() => setCtx((c) => ({ ...c, useSignals: !c.useSignals }))} aria-pressed={ctx.useSignals}>
              <Icon name="radar" size={13} /> Signals {ctx.useSignals ? "×" : "+"}
            </button>
          )}
        </div>

        <div ref={scroller} className="si-scroll">
          {empty ? (
            <div className="si-empty">
              <h2 className="title-md si-greet">
                {GREET[Math.floor((Date.now() / 60000) % GREET.length)]}
              </h2>
              <p className="muted small" style={{ margin: 0 }}>
                Ask anything. The agent whose job it is steps in and answers, and you'll see her take over.
              </p>
              <p className="faint small" style={{ margin: 0 }}>
                Educational, not a diagnosis. I show what I used every time.
              </p>
            </div>
          ) : (
            <div className="si-thread">
              {msgs.map((m, i) => {
                if (m.role === "user") return <div key={m.id} className="si-q">{m.text.replace(/^explain more:\s*/i, "Explain more: ")}</div>;
                // who answered the previous question — so a hand-over to another agent is shown
                const prev = msgs.slice(0, i).reverse().find((x) => x.role === "si" && (x.agent || x.answer?.agent));
                return <SIReply key={m.id} msg={m} prevAgent={prev ? (prev.agent ?? prev.answer?.agent ?? null) : null} onAsk={(t) => void send(t)} />;
              })}
            </div>
          )}
        </div>

        <div className="si-suggest" aria-label="Suggestions">
          {sugg.map((s) => (
            <button key={s} className="chip" onClick={() => void send(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>

        {err && (
          <div className="si-err small" role="alert">
            {err}
          </div>
        )}

        <form
          className={`si-input glass ${orb === "listening" ? "listening" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <Icon name="sparkle" size={20} className="si-input-ic" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" && !input) {
                histIdx.current = Math.min(history.current.length - 1, histIdx.current + 1);
                if (history.current[histIdx.current]) setInput(history.current[histIdx.current]);
                e.preventDefault();
              }
              if (e.key === "Escape") closeSI();
            }}
            placeholder={orb === "listening" ? "Listening…" : portal ? "Ask about you, or tell me: “bad cramps today”, “slept 6 h”…" : "Ask anything, or say “dark mode”, “enter space”, “AMH 0.9”…"}
            aria-label="Ask Overeo SI"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className={`si-mic ${orb === "listening" ? "on" : ""}`}
            onClick={() => (rec.current ? rec.current.stop() : startVoice())}
            aria-label={orb === "listening" ? "Stop listening" : "Speak to Overeo SI"}
            title={voiceSupported ? "Speak (or hold O)" : "Voice needs Chrome, Edge or Safari"}
          >
            <Icon name="mic" size={19} />
            {orb === "listening" && <span className="si-mic-ring" style={{ transform: `scale(${1 + level * 0.8})` }} />}
          </button>
          <button type="submit" className="si-send" disabled={!input.trim() || busy} aria-label="Send">
            <Icon name="send" size={18} />
          </button>
        </form>
        </div>
        </div>
        <div className="si-foot faint">
          <span>
            <span className="kbd">O</span> open · hold <span className="kbd">O</span> talk · <span className="kbd">Esc</span> close
          </span>
          <span>Not medical advice · in an emergency call 911</span>
        </div>
      </div>
    </div>
  );
}

/** phones and narrow windows get the slim stage bar */
function useNarrow() {
  const [n, setN] = useState(false);
  useEffect(() => {
    const m = matchMedia("(max-width: 760px), (max-height: 520px)");
    const f = () => setN(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return n;
}

/* --------------------------------- reply --------------------------------- */

function SIReply({ msg, onAsk, prevAgent }: { msg: SIMessage; onAsk: (t: string) => void; prevAgent?: string | null }) {
  const a = msg.answer;
  const [step, setStep] = useState(0); // trace steps revealed
  const [words, setWords] = useState(0);
  const [done, setDone] = useState(false);
  const reduce = useStore((s) => s.reducedMotion);

  // reveal the "working" trace, then stream the summary word by word
  useEffect(() => {
    if (!a || msg.remote || a.refining) {
      if (a) setDone(true);
      return;
    }
    const trace = a.trace ?? [];
    if (reduce) {
      setStep(trace.length);
      setWords(1e9);
      setDone(true);
      return;
    }
    let i = 0;
    const fast = a.source === "mind";
    const tTrace = setInterval(() => {
      i++;
      setStep(i);
      if (i >= trace.length) {
        clearInterval(tTrace);
        const total = a.summary.split(/\s+/).length;
        let w = 0;
        const tW = setInterval(() => {
          w += fast ? 4 : 2;
          setWords(w);
          if (w >= total) {
            clearInterval(tW);
            setDone(true);
          }
        }, fast ? 24 : 34);
      }
    }, fast ? 150 : 300);
    return () => clearInterval(tTrace);
  }, [a, msg.remote, reduce]);

  const who = msg.agent ? teamById(msg.agent) : a?.agent ? teamById(a.agent) : undefined;
  const from = prevAgent && who && prevAgent !== who.id ? teamById(prevAgent) : undefined;
  const handover = from && who && (
    <div className="si-handover" role="status" style={{ "--h": who.hue, "--h0": from.hue } as CSSProperties}>
      <Avatar agent={from} size={30} still label={false} />
      <span className="si-handover-beam" aria-hidden="true" />
      <Avatar agent={who} size={34} still label={false} />
      <span>
        <b>{who.name}</b> takes this — {who.title.toLowerCase()} is {who.name}'s job
      </span>
    </div>
  );
  if (!a) {
    return (
      <div className="si-a thinking">
        {handover}
        {who && !msg.text && (
          <div className="si-agent is-working" style={{ "--h": who.hue } as CSSProperties} data-agent={who.id}>
            <Avatar agent={who} size={36} still state="thinking" label={false} />
            <span>
              <span><b>{who.name}</b> · {who.title}</span>
              <small>Looking at your data and OVEREO's guides…</small>
            </span>
          </div>
        )}
        {msg.text ? <p className="si-sum">{msg.text}</p> : <div className="si-dots"><span /><span /><span /></div>}
      </div>
    );
  }

  const trace = a.trace ?? [];
  const summary = msg.remote || a.refining ? a.summary : a.summary.split(/\s+/).slice(0, words).join(" ");
  return (
    <article className={`si-a tone-${a.tone ?? "info"} ${msg.upgraded ? "is-upgraded" : ""}`}>
      {handover}
      {!msg.remote && trace.length > 0 && (
        <ol className={`si-trace ${done ? "folded" : ""}`} aria-label="How Overeo SI worked on this">
          {trace.map((t, i) => (
            <li key={t} className={i < step ? "ok" : i === step ? "now" : ""}>
              <Icon name={i < step ? "check" : "sparkle"} size={12} /> {t}
            </li>
          ))}
        </ol>
      )}
      {a.agent && teamById(a.agent) && (() => {
        const ag = teamById(a.agent)!;
        return (
          <div className="si-agent" style={{ "--h": ag.hue } as CSSProperties} data-agent={ag.id}>
            <Avatar agent={ag} size={36} still label={false} />
            <span>
              <span><b>{ag.name}</b> · {ag.title}</span>
              <small>{a.refining ? "Instant answer · getting more detail…" : msg.upgraded ? "Updated with more detail ✓" : msg.kept && a.limits ? a.limits : "Answering — this is their job"}</small>
            </span>
          </div>
        );
      })()}
      <h3 className="si-title">{a.title}</h3>
      <p className="si-sum">
        {summary}
        {!done && <span className="si-caret" />}
      </p>
      {done && (
        <div className="si-more">
          {a.viz && <MiniViz kind={a.viz} />}
          {a.points && a.points.length > 0 && (
            <ul className="si-points">
              {a.points.map((p, i) => (
                <li key={i} style={{ "--d": `${i * 60}ms` } as CSSProperties}>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {a.questions && a.questions.length > 0 && (
            <div className="si-qs">
              <div className="si-label">Ask your clinician</div>
              {a.questions.map((q) => (
                <div key={q} className="si-qq">
                  “{q}”
                </div>
              ))}
            </div>
          )}
          {a.actions && a.actions.length > 0 && (
            <div className="si-actions">
              {a.actions.map((ac) => (
                <button
                  key={ac.label}
                  className="btn sm"
                  onClick={() => {
                    const si = ac.cmds.find((c) => c.type === "si") as Extract<Command, { type: "si" }> | undefined;
                    if (si?.seed) return onAsk(si.seed);
                    ac.cmds.forEach((c, i) => setTimeout(() => run(c), i * 120));
                  }}
                >
                  {ac.icon && <Icon name={ac.icon} size={15} />} {ac.label}
                </button>
              ))}
            </div>
          )}
          <MindExtras a={a} remote={!!msg.remote} onAsk={onAsk} />
          {!msg.remote && siMode === "live" && /answered on this device/i.test(a.limits ?? "") && (
            <p className="si-fallback">
              <Icon name="wifioff" size={13} /> {a.limits?.split(/(?<=\.)\s/).pop()}
            </p>
          )}
          <Grounding a={a} remote={!!msg.remote} />
        </div>
      )}
    </article>
  );
}

function Grounding({ a, remote }: { a: SIAnswer; remote: boolean }) {
  return (
    <details className="si-ground">
      <summary>
        <Icon name="shield" size={14} /> How this answer was produced
      </summary>
      <dl>
        <dt>Origin</dt>
        <dd>{remote || a.source === "xevyo" ? "Live brain (Xevyo), given only the facts listed under “Why this?”" : a.source === "mind" ? "OVEREO Mind, on your device, from your own records" : "On-device engine"}</dd>
        <dt>Used</dt>
        <dd>{a.used.join(" · ") || "—"}</dd>
        {a.missing && a.missing.length > 0 && (
          <>
            <dt>Not available</dt>
            <dd>{a.missing.join(" · ")}</dd>
          </>
        )}
        {a.limits && (
          <>
            <dt>Limits</dt>
            <dd>{a.limits}</dd>
          </>
        )}
        <dt>Status</dt>
        <dd>Educational · not a diagnosis</dd>
        {a.sources && a.sources.length > 0 && (
          <>
            <dt>Sources</dt>
            <dd>
              {a.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </dd>
          </>
        )}
      </dl>
    </details>
  );
}

function MiniViz({ kind }: { kind: SIViz }) {
  const d = useDerived();
  if (kind === "clock")
    return (
      <div className="si-viz">
        <CircularProgress value={d.clock.span * 100} size={112} stroke={9} gradientId="si-cp">
          <div className="tnum" style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.03em" }}>
            {d.clock.markerAge}
          </div>
          <div className="faint" style={{ fontSize: 11 }}>
            marker age
          </div>
        </CircularProgress>
        <div className="si-viz-txt small">
          <b>{d.clock.verdict}</b>
          <span className="faint">Calendar {d.clock.calendarAge} · range {d.clock.band[0]}–{d.clock.band[1]}</span>
        </div>
      </div>
    );
  if (kind === "signals")
    return (
      <div className="si-viz col">
        {d.signals.slice(0, 4).map((s) => (
          <div key={s.id} className="si-bar">
            <span className="small">{s.title}</span>
            <span className="si-bar-track">
              <span className={`si-bar-fill ${s.level}`} style={{ width: `${Math.round(s.strength * 100)}%` }} />
            </span>
            <span className="faint small">{levelLabel[s.level]}</span>
          </div>
        ))}
      </div>
    );
  if (kind === "forecast") {
    const len = Math.round(d.today.meanLength);
    return (
      <div className="si-viz col">
        <div className="si-phase-strip">
          {Array.from({ length: len }, (_, i) => {
            const day = i + 1;
            const ov = len - 14;
            const ph = day <= 5 ? "menstrual" : day < ov - 1 ? "follicular" : day <= ov + 1 ? "ovulatory" : "luteal";
            return <span key={i} className={day === d.today.cycleDay ? "today" : ""} style={{ background: PHASE_META[ph].color }} title={`Day ${day}`} />;
          })}
        </div>
        <span className="faint small">
          Day {d.today.cycleDay} of ~{len} · {PHASE_META[d.today.phase].label}
        </span>
      </div>
    );
  }
  if (kind === "futures") {
    const W = 260, H = 64;
    const ages = d.futures.a.map((p) => p.age);
    const x = (age: number) => ((age - ages[0]) / (ages[ages.length - 1] - ages[0])) * W;
    const y = (v: number) => H - ((v - 30) / 70) * H;
    const avg = (p: { bone: number; heart: number; energy: number }) => (p.bone + p.heart + p.energy) / 3;
    const path = (pts: typeof d.futures.a) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(avg(p)).toFixed(1)}`).join("");
    return (
      <div className="si-viz">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label="Two futures">
          <path d={path(d.futures.a)} fill="none" stroke="var(--fg-3)" strokeWidth="1.6" strokeDasharray="3 3" />
          <path d={path(d.futures.b)} fill="none" stroke="var(--accent)" strokeWidth="2.2" />
        </svg>
        <div className="si-viz-txt small">
          <b>{d.futures.gain > 0 ? `+${d.futures.gain} healthy years` : "Switch on a lever"}</b>
          <span className="faint">Illustrative</span>
        </div>
      </div>
    );
  }
  if (kind === "ecosystem")
    return (
      <div className="si-viz wrapchips">
        {["NEYU", "BioAro Labs", "BioAro Drugs", "Biongevity", "Advanced Cardiology", "NEA", "BioEMR", "BioMynd"].map((n) => (
          <span key={n} className="chip">
            {n}
          </span>
        ))}
      </div>
    );
  return null;
}

/* ------------------------------ OVEREO Mind ------------------------------ */

function lastSource(msgs: SIMessage[]) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === "si" && m.answer) return m.remote || m.answer.source === "xevyo" ? "xevyo" : m.answer.source === "mind" ? "mind" : "engine";
    if (m.role === "si" && m.remote) return "xevyo";
  }
  return null;
}

function sourceLabel(src: string | null, portal: boolean) {
  if (src === "xevyo") return "Live brain (Xevyo)";
  if (src === "mind") return "On your device";
  if (src === "engine") return "On-device";
  return siMode === "live" ? (portal ? "On your device · live when needed" : "On-device · live when needed") : "On-device";
}

/** Suggestions from what matters for her right now. */
function portalSuggestions(): string[] {
  try {
    const m = model();
    const xs = m.insights.flatMap((i) => (i.action?.ask ? [i.action.ask] : []));
    const base = m.learned.cycle.day ? ["How am I doing?", "When is my next period?", "What if I sleep 1 hour more?"] : ["What can you do?", "When is my next period?", "How am I doing?"];
    return [...new Set([...xs, ...base])].slice(0, 3);
  } catch {
    return ["What can you do?", "How am I doing?", "When is my next period?"];
  }
}

function MindExtras({ a, remote, onAsk }: { a: SIAnswer; remote: boolean; onAsk: (t: string) => void }) {
  const [why, setWhy] = useState(false);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [doneIds, setDoneIds] = useState<Record<string, string>>({});
  if (!a.source || a.source === "engine") return null;
  const items = a.why ?? [];
  const facts = a.sharedFacts ?? [];
  const act = async (x: MindAction) => {
    const r = await runMindAction(x, onAsk);
    if (r) setDoneIds((d) => ({ ...d, [x.label]: r }));
  };
  return (
    <div className="mind-x">
      {a.outcome && <OutcomeBar o={a.outcome} />}
      {a.mindActions && a.mindActions.length > 0 && (
        <div className="si-actions">
          {a.mindActions.map((x, i) => (
            <button key={x.label} className={`btn sm ${x.kind === "log" || x.kind === "remember" || i === 0 ? "" : "ghost"}`} disabled={!!doneIds[x.label]} onClick={() => void act(x)}>
              <Icon name={doneIds[x.label] ? "check" : x.kind === "log" ? "plus" : x.kind === "order" ? "flask" : x.kind === "remember" ? "sparkle" : x.kind === "ask" ? "sparkle" : "arrow"} size={14} /> {doneIds[x.label] ?? x.label}
            </button>
          ))}
        </div>
      )}
      <div className="mind-meta">
        {a.confidence != null && a.intent !== "emergency" && (
          <span className={`mind-sure c${Math.round(a.confidence * 4)}`} title={`${Math.round(a.confidence * 100)}%`}>
            <span className="mind-sure-bar" style={{ ["--c" as string]: a.confidence }} /> {sureLabel(a.confidence)}
          </span>
        )}
        {(items.length > 0 || facts.length > 0) && (
          <button className="mind-whybtn" aria-expanded={why} onClick={() => setWhy((w) => !w)}>
            <Icon name="eye" size={13} /> Why this?
          </button>
        )}
        {a.intent && a.intent !== "emergency" && (
          <span className="mind-vote" role="group" aria-label="Was this helpful?">
            <button
              aria-label="Helpful"
              aria-pressed={voted === "up"}
              disabled={!!voted}
              onClick={() => {
                voteAnswer(a.intent!, true);
                setVoted("up");
              }}
            >
              <Icon name="check" size={13} />
            </button>
            <button
              aria-label="Not helpful"
              aria-pressed={voted === "down"}
              disabled={!!voted}
              onClick={() => {
                voteAnswer(a.intent!, false);
                setVoted("down");
              }}
            >
              <Icon name="close" size={13} />
            </button>
            {voted && <span className="faint small">{voted === "up" ? "Thanks — noted." : "Noted. I'll go deeper on this next time."}</span>}
          </span>
        )}
      </div>
      {why && (
        <div className="mind-why">
          {items.length > 0 && (
            <ul>
              {items.map((e, i) => (
                <li key={i}>
                  <b>{e.label}</b>
                  {e.detail ? <span> · {e.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
          {remote && facts.length > 0 && (
            <>
              <div className="si-label">Shared with the live brain (no name, no raw logs)</div>
              <ul className="mind-facts">
                {facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {a.followUps && a.followUps.length > 0 && (
        <div className="mind-follow">
          {a.followUps.map((f) => (
            <button key={f} className="chip" onClick={() => onAsk(f)}>
              {/^explain more:/i.test(f) ? (
                <>
                  <Icon name="sparkle" size={12} /> Explain more
                </>
              ) : (
                f
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OutcomeBar({ o }: { o: NonNullable<SIAnswer["outcome"]> }) {
  const pos = (v: number) => `${((v - o.min) / (o.max - o.min)) * 100}%`;
  return (
    <div className="mind-outcome" role="img" aria-label={`${o.label}: now ${o.now}${o.unit}, would be about ${o.then}${o.unit} (range ${o.low}–${o.high})`}>
      <div className="mind-outcome-track">
        <span className="band" style={{ left: pos(o.low), width: `calc(${pos(o.high)} - ${pos(o.low)})` }} />
        <span className="now" style={{ left: pos(o.now) }} title={`Now ${o.now}`} />
        <span className="then" style={{ left: pos(o.then) }} title={`Then ${o.then}`} />
      </div>
      <div className="mind-outcome-l">
        <span>
          {o.label} now <b>{o.now}{o.unit}</b>
        </span>
        <span>
          → about <b>{o.then}{o.unit}</b> <span className="faint">({o.low}–{o.high})</span>
        </span>
      </div>
    </div>
  );
}
