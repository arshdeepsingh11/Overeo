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
  const profileName = useStore((s) => s.profile.name);
  const isSample = useStore((s) => s.profile.isSample);
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
        const { answer, remote } = await ask(
          q,
          { ...ctx, section: origin },
          msgs,
          (partial) => setMsgs((m) => m.map((x) => (x.id === siMsg.id ? { ...x, status: "streaming", text: partial, remote: true } : x))),
          ac.signal,
        );
        // run instant effects (theme, mood…) now; navigation after the user has seen the reply
        const fx = answer.effects ?? [];
        const nav = fx.some((c) => c.type === "goto" || c.type === "mode");
        if (!nav) fx.forEach((c) => run(c));
        setMsgs((m) => m.map((x) => (x.id === siMsg.id ? { ...x, answer, status: "streaming", remote } : x)));
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

  const secLabel = labelFor(origin);
  const sugg = suggestionsFor(origin);
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
              <div className="si-sub">Symbiotic Intelligence · {siMode === "live" ? "live model" : "on-device"}</div>
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

        <div className="si-context" aria-label="Context Overeo SI may use">
          <span className="faint small">Using</span>
          <span className="chip on-soft">
            <Icon name="eye" size={13} /> {secLabel}
          </span>
          <button className={`chip ${ctx.useProfile ? "on-soft" : "off"}`} onClick={() => setCtx((c) => ({ ...c, useProfile: !c.useProfile }))} aria-pressed={ctx.useProfile}>
            <Icon name="user" size={13} /> {profileName}
            {isSample ? " (sample)" : ""} {ctx.useProfile ? "×" : "+"}
          </button>
          <button className={`chip ${ctx.useSignals ? "on-soft" : "off"}`} onClick={() => setCtx((c) => ({ ...c, useSignals: !c.useSignals }))} aria-pressed={ctx.useSignals}>
            <Icon name="radar" size={13} /> Signals {ctx.useSignals ? "×" : "+"}
          </button>
        </div>

        <div ref={scroller} className="si-scroll">
          {empty ? (
            <div className="si-empty">
              <Orb state={orb} level={level} size={230} />
              <h2 className="title-md si-greet">
                {GREET[Math.floor((Date.now() / 60000) % GREET.length)]}
              </h2>
              <p className="muted small" style={{ margin: 0 }}>
                Educational, not a diagnosis. I show what I used every time.
              </p>
            </div>
          ) : (
            <div className="si-thread">
              {msgs.map((m) => (m.role === "user" ? <div key={m.id} className="si-q">{m.text}</div> : <SIReply key={m.id} msg={m} onAsk={(t) => void send(t)} />))}
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
            placeholder={orb === "listening" ? "Listening…" : "Ask anything, or say “dark mode”, “enter space”, “AMH 0.9”…"}
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

/* --------------------------------- reply --------------------------------- */

function SIReply({ msg, onAsk }: { msg: SIMessage; onAsk: (t: string) => void }) {
  const a = msg.answer;
  const [step, setStep] = useState(0); // trace steps revealed
  const [words, setWords] = useState(0);
  const [done, setDone] = useState(false);
  const reduce = useStore((s) => s.reducedMotion);

  // reveal the "working" trace, then stream the summary word by word
  useEffect(() => {
    if (!a || msg.remote) {
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
    const tTrace = setInterval(() => {
      i++;
      setStep(i);
      if (i >= trace.length) {
        clearInterval(tTrace);
        const total = a.summary.split(/\s+/).length;
        let w = 0;
        const tW = setInterval(() => {
          w += 2;
          setWords(w);
          if (w >= total) {
            clearInterval(tW);
            setDone(true);
          }
        }, 34);
      }
    }, 300);
    return () => clearInterval(tTrace);
  }, [a, msg.remote, reduce]);

  if (!a) {
    return (
      <div className="si-a thinking">
        {msg.text ? <p className="si-sum">{msg.text}</p> : <div className="si-dots"><span /><span /><span /></div>}
      </div>
    );
  }

  const trace = a.trace ?? [];
  const summary = msg.remote ? a.summary : a.summary.split(/\s+/).slice(0, words).join(" ");
  return (
    <article className={`si-a tone-${a.tone ?? "info"}`}>
      {!msg.remote && trace.length > 0 && (
        <ol className={`si-trace ${done ? "folded" : ""}`} aria-label="How Overeo SI worked on this">
          {trace.map((t, i) => (
            <li key={t} className={i < step ? "ok" : i === step ? "now" : ""}>
              <Icon name={i < step ? "check" : "sparkle"} size={12} /> {t}
            </li>
          ))}
        </ol>
      )}
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
        <dd>{remote ? "Live model, with OVEREO context" : "On-device engine, from her data"}</dd>
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
