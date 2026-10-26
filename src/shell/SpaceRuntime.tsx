"use client";

import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { LogoMark } from "../ui/Logo";
import { initSpace, space, useSpace, signOut, deleteMySpace } from "../personal/space";
import { checkDueReminders, runAgents } from "../personal/actions";
import { unlock, watchAutoLock } from "../personal/lock";
import { useT } from "../personal/useT";
import { KeyPad } from "../views/app/kit";

/* =====================================================================
   Runs once in the app shell:
   - opens her space (or Maya's sample) on this device
   - lets her agents look at her data on open, every few minutes and
     whenever her records change
   - fires due reminders (discreet wording when she asks for it)
   - auto-lock + privacy veil, language attribute, discreet title
   - registers the service worker so OVEREO works offline
   ===================================================================== */

export function SpaceRuntime() {
  const ready = useSpace((s) => s.ready);
  const lang = useSpace((s) => s.prefs.lang);
  const discreet = useSpace((s) => s.prefs.discreet);
  const [online, setOnline] = useState(true);
  const t = useT();

  useEffect(() => {
    initSpace();
    const stop = watchAutoLock();
    // agents react to her data — debounced so a burst of logging runs once
    let deb = 0;
    let lastRecords = space.get().records;
    let lastAgents = space.get().agents;
    const unsub = space.subscribe(() => {
      const s = space.get();
      if (s.records === lastRecords && s.agents === lastAgents) return;
      lastRecords = s.records;
      lastAgents = s.agents;
      clearTimeout(deb);
      deb = window.setTimeout(runAgents, 400);
    });
    const tick = window.setInterval(() => {
      runAgents();
      void checkDueReminders();
    }, 60_000);
    return () => {
      stop();
      unsub();
      clearTimeout(deb);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    runAgents();
    void checkDueReminders();
  }, [ready]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // discreet mode: a neutral tab title (restored when it's off)
  useEffect(() => {
    if (!discreet) return;
    const keep = document.title;
    document.title = "Journal";
    const mo = new MutationObserver(() => document.title !== "Journal" && (document.title = "Journal"));
    const el = document.querySelector("title");
    if (el) mo.observe(el, { childList: true });
    return () => {
      mo.disconnect();
      document.title = keep;
    };
  }, [discreet]);

  // offline-first: register the service worker, watch connectivity
  useEffect(() => {
    // https only (production). On localhost it's opt-in (localStorage "overeo.sw" = "1") so dev builds don't get cached.
    let swOptIn = false;
    try {
      swOptIn = localStorage.getItem("overeo.sw") === "1";
    } catch {}
    if ("serviceWorker" in navigator && (location.protocol === "https:" || swOptIn)) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const on = () => setOnline(navigator.onLine);
    on();
    addEventListener("online", on);
    addEventListener("offline", on);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", on);
    };
  }, []);

  return (
    <>
      {!online && (
        <div className="offline-bar" role="status">
          <Icon name="wifioff" size={14} /> {t("common.offline")}
        </div>
      )}
      <LockScreen />
    </>
  );
}

function LockScreen() {
  const t = useT();
  const locked = useSpace((s) => s.locked);
  const name = useSpace((s) => s.own?.name);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [forgot, setForgot] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("is-locked", locked);
    if (!locked) {
      setPin("");
      setForgot(false);
    }
  }, [locked]);
  if (!locked) return null;
  const key = async (k: string) => {
    const next = k === "⌫" ? pin.slice(0, -1) : (pin + k).slice(0, 6);
    setPin(next);
    setErr(false);
    if (next.length === 4) {
      const ok = await unlock(next);
      if (!ok) {
        setErr(true);
        setPin("");
      }
    }
  };
  return (
    <div className="lock" role="dialog" aria-modal="true" aria-label={t("lock.title")}>
      <div className="lock-card">
        <LogoMark size={44} />
        <b className="lock-t">{t("lock.title")}</b>
        <span className="faint small">{name ? `${name} · ` : ""}{t("lock.enter")}</span>
        <div className={`pin-dots ${err ? "shake" : ""}`} aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < pin.length ? "on" : ""} />
          ))}
        </div>
        {err && <span className="alert-note">{t("lock.wrong")}</span>}
        <KeyPad onKey={key} />
        {!forgot ? (
          <button className="lock-forgot" onClick={() => setForgot(true)}>
            {t("lock.forgot")}
          </button>
        ) : (
          <div className="lock-reset">
            <p className="small">For your privacy, a forgotten PIN can't be recovered on this device. You can delete your space here and start again, or keep trying.</p>
            <div className="lock-reset-b">
              <button className="btn ghost sm" onClick={() => setForgot(false)}>
                Keep trying
              </button>
              <button className="btn sm danger" onClick={() => (deleteMySpace(), signOut())}>
                Delete my space
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
