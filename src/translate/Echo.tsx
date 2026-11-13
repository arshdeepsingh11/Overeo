"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { Avatar } from "../views/app/team/Avatar";
import { Switch } from "../views/app/kit";
import { teamById } from "../agents/team";
import { echo, useEcho } from "./store";
import { LANGS, langByCode } from "./languages";
import { translateOne, reasonText } from "./engine";
import { translatePage, type PageTranslator } from "./page";

/* =====================================================================
   ECHO — the translation agent, on every page once she turns it on.
   - The ECHO button: translate the whole page, pick a language, or turn
     ECHO off. Tap again to see the original English.
   - Select any word, sentence or paragraph → a small "Translate" bubble
     → the translation, with Listen and Copy.
   Everything ECHO shows is marked data-no-translate so it never
   translates itself.
   ===================================================================== */

const ENGINE_LABEL: Record<string, string> = {
  device: "Translated on your device",
  live: "Translated by the live brain · numbers checked",
  cache: "Translated (saved on this device)",
};

export function EchoRoot() {
  const on = useEcho((s) => s.on);
  if (!on) return null;
  return (
    <>
      <EchoButton />
      <SelectionTranslate />
    </>
  );
}

function EchoButton() {
  const page = useEcho((s) => s.page);
  const lang = useEcho((s) => s.lang);
  const status = useEcho((s) => s.status);
  const engine = useEcho((s) => s.engine);
  const note = useEcho((s) => s.note);
  const [open, setOpen] = useState(false);
  const pt = useRef<PageTranslator | null>(null);
  const agent = teamById("echo")!;
  const L = langByCode(lang);

  // whole-page translation follows the setting
  useEffect(() => {
    if (!page) {
      pt.current?.stop();
      pt.current = null;
      echo.set({ status: "idle", engine: null, note: null });
      return;
    }
    if (!pt.current)
      pt.current = translatePage(lang, ({ status, r }) => {
        echo.set({
          status,
          engine: r?.engine ?? echo.get().engine,
          note: r && r.missed ? `${r.missed} piece${r.missed === 1 ? "" : "s"} stayed in English${r.reason ? ` — ${reasonText(r.reason).toLowerCase()}` : ""}.` : null,
        });
      });
    else pt.current.setLang(lang);
  }, [page, lang]);
  useEffect(() => () => pt.current?.stop(), []);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open]);

  return (
    <div className="echo-root" data-no-translate translate="no">
      {open && (
        <div className="echo-panel" role="dialog" aria-label="ECHO translator">
          <div className="echo-head">
            <Avatar agent={agent} size={44} label={false} state={status === "working" ? "thinking" : "idle"} />
            <div>
              <b>ECHO</b>
              <span className="faint small">Your translator</span>
            </div>
            <button className="asheet-x" onClick={() => setOpen(false)} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
          <label className="echo-row">
            <span>Language</span>
            <select className="ainput" value={lang} onChange={(e) => echo.set({ lang: e.target.value })} aria-label="Translate into">
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} — {l.name.replace(/ \(.*\)/, "")}
                </option>
              ))}
            </select>
          </label>
          <button className={`btn ${page ? "ghost" : ""} echo-main`} onClick={() => echo.set({ page: !page })}>
            <Icon name={page ? "close" : "globe"} size={14} /> {page ? "Show the original (English)" : `Translate this page into ${L?.native ?? lang}`}
          </button>
          {page && (
            <p className="echo-status small" role="status">
              {status === "working" ? "Translating…" : status === "error" ? "Couldn't translate right now." : engine ? ENGINE_LABEL[engine] : ""}
              {note && <span className="faint"> {note}</span>}
            </p>
          )}
          <p className="faint small">Tip: select any word or sentence anywhere, then tap <b>Translate</b>. Numbers are never changed.</p>
          <button className="btn ghost sm" onClick={() => echo.set({ on: false })}>
            Turn ECHO off
          </button>
        </div>
      )}
      <button className={`echo-fab ${page ? "is-on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={page ? `ECHO: page shown in ${L?.name}. Open translator` : "Open ECHO translator"}>
        <Avatar agent={agent} size={34} still label={false} state={status === "working" ? "thinking" : "idle"} />
        <span>{page ? (L?.native ?? lang) : "Translate"}</span>
      </button>
    </div>
  );
}

/* ------------------------- select text → translate ------------------------- */

function SelectionTranslate() {
  const lang = useEcho((s) => s.lang);
  const [pick, setPick] = useState<{ text: string; x: number; y: number } | null>(null);
  const [res, setRes] = useState<{ src: string; text: string; ok: boolean; note: string; busy: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let t = 0;
    const read = () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        const sel = getSelection();
        const text = sel?.toString().trim() ?? "";
        if (!sel || sel.rangeCount === 0 || text.length < 1 || text.length > 3000 || !/\p{L}/u.test(text)) return setPick(null);
        const node = sel.anchorNode;
        const el = node?.nodeType === 1 ? (node as Element) : node?.parentElement;
        if (el?.closest("[data-no-translate],input,textarea,[contenteditable=true]")) return setPick(null);
        const r = sel.getRangeAt(0).getBoundingClientRect();
        if ((!r.width && !r.height) || r.bottom < 0 || r.top > innerHeight) return setPick(null);
        const x = Math.min(Math.max(r.left + r.width / 2, 70), innerWidth - 70);
        const below = r.bottom + 52 < innerHeight;
        setPick({ text, x, y: below ? r.bottom + 8 : Math.max(8, r.top - 44) });
      }, 350);
    };
    document.addEventListener("selectionchange", read);
    const hide = () => setPick(null);
    addEventListener("scroll", hide, { passive: true });
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", read);
      removeEventListener("scroll", hide);
    };
  }, []);

  const go = async (text: string) => {
    setPick(null);
    setCopied(false);
    setRes({ src: text, text: "", ok: false, note: "", busy: true });
    const r = await translateOne(text, lang);
    setRes({ src: text, text: r.text, ok: r.ok, busy: false, note: r.ok ? (r.engine ? ENGINE_LABEL[r.engine] : "") : `${reasonText(r.reason) || "Translation isn't available right now"} — showing the original.` });
  };

  const L = langByCode(lang);
  const speak = (t: string) => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = lang === "zh" ? "zh-CN" : lang === "zh-Hant" ? "zh-TW" : lang;
      speechSynthesis.speak(u);
    } catch {}
  };

  return (
    <div data-no-translate translate="no">
      {pick && (
        <button className="echo-bubble" style={{ left: pick.x, top: pick.y }} onPointerDown={(e) => e.preventDefault()} onClick={() => void go(pick.text)}>
          <Icon name="globe" size={13} /> Translate
        </button>
      )}
      {res && (
        <div className="echo-card" role="dialog" aria-label="Translation" dir={L?.rtl ? "rtl" : undefined}>
          <div className="echo-card-head" dir="ltr">
            <b>ECHO · {L?.native}</b>
            <button className="asheet-x" onClick={() => setRes(null)} aria-label="Close translation">
              <Icon name="close" size={14} />
            </button>
          </div>
          <p className="echo-src faint small" dir="ltr">
            {res.src.length > 220 ? `${res.src.slice(0, 220)}…` : res.src}
          </p>
          {res.busy ? (
            <p className="echo-out" role="status">
              Translating…
            </p>
          ) : (
            <p className="echo-out" lang={res.ok ? lang : "en"}>
              {res.text}
            </p>
          )}
          {!res.busy && (
            <div className="echo-card-foot" dir="ltr">
              <span className="faint small">{res.note}</span>
              {res.ok && typeof speechSynthesis !== "undefined" && (
                <button className="chip" onClick={() => speak(res.text)}>
                  <Icon name="sound" size={12} /> Listen
                </button>
              )}
              {res.ok && (
                <button
                  className="chip"
                  onClick={() => {
                    void navigator.clipboard?.writeText(res.text).then(() => setCopied(true));
                  }}
                >
                  <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------- the on/off switch used on other pages --------------------- */

export function EchoSwitch({ compact = false }: { compact?: boolean }) {
  const on = useEcho((s) => s.on);
  const lang = useEcho((s) => s.lang);
  return (
    <div className={`echo-switch ${compact ? "compact" : ""}`} data-no-translate translate="no">
      <label className="when">
        <span>
          <b>ECHO translator</b>
          {!compact && <small className="faint small" style={{ display: "block" }}>Translate any word, sentence or the whole page.</small>}
        </span>
        <Switch on={on} onChange={(v) => echo.set({ on: v })} label="ECHO translator" />
      </label>
      {on && (
        <select className="ainput" value={lang} onChange={(e) => echo.set({ lang: e.target.value })} aria-label="ECHO language">
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native} — {l.name.replace(/ \(.*\)/, "")}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
