"use client";

import { useEffect, useState } from "react";
import { TypewriterInput } from "../ui/Controls";
import { ShineBorder } from "../ui/Motion";
import { Icon } from "../ui/Icon";
import { FACTS, MENSTRUAL_FACT, OVARY_FACT } from "../core/research";
import { openSI, useStore } from "../core/store";
import { tick, chime } from "../lib/audio";
import Link from "next/link";
import { ROUTES } from "../core/routes";
import { SPECIALTIES } from "../content/specialties";

/* ------------------------------------------------------------------ *
 * Join — name + email only, with typewriter inputs that shake on
 * validation errors, and a particle burst on success. Stored only in
 * this browser in the prototype.
 * ------------------------------------------------------------------ */

const INTERESTS = ["Fertility & egg freezing", "Painful or heavy periods", "Hormones & PCOS", "Perimenopause & menopause", "Longevity", "Research"];

export function Join() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ints, setInts] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [errs, setErrs] = useState<{ name?: string; email?: string; consent?: string }>({});
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("overeo.join")) setDone(true);
    } catch {}
  }, []);
  const [burst, setBurst] = useState(0);
  const peers = useStore((s) => s.peers);

  const submit = () => {
    const e: typeof errs = {};
    if (name.trim().length < 2) e.name = "Tell us what to call you.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "That email doesn't look right.";
    if (!consent) e.consent = "Please confirm you'd like updates.";
    setErrs(e);
    if (Object.keys(e).length) {
      tick(300, 0.04);
      return;
    }
    try {
      localStorage.setItem("overeo.join", JSON.stringify({ name, email, ints, at: Date.now() }));
    } catch {}
    chime();
    setBurst((b) => b + 1);
    setDone(true);
  };

  return (
    <section id="join" className="section join">
      <div className="wrap join-grid">
        <div>
          <span className="eyebrow">
            <span className="dot" /> Join OVEREO
          </span>
          <h2 className="title-lg">
            You don't need every answer to begin. <span className="serif grad-text">Just a better way to ask.</span>
          </h2>
          <p className="lede">Early access opens in Calgary first. We never ask for health information to join.</p>
          {peers > 1 && (
            <p className="small faint" style={{ marginTop: 16 }}>
              <Icon name="users" size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> {peers} people are on this page right now.
            </p>
          )}
        </div>
        <div className="glass holo join-card">
          {done ? (
            <div className="join-done">
              <Burst key={burst} />
              <span className="join-check">
                <Icon name="check" size={30} />
              </span>
              <h3 className="title-md">You're on the list{name ? `, ${name.split(" ")[0]}` : ""}.</h3>
              <p className="small muted">Saved in this browser only — nothing was sent. This is a prototype.</p>
              <div className="sig-actions" style={{ justifyContent: "center" }}>
                <button className="btn sm" onClick={() => openSI("What happens when I join?")}>
                  <Icon name="sparkle" size={15} /> What happens next?
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    try {
                      localStorage.removeItem("overeo.join");
                    } catch {}
                    setDone(false);
                  }}
                >
                  Start over
                </button>
              </div>
            </div>
          ) : (
            <form
              className="join-form"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              noValidate
            >
              <TypewriterInput label="Name" value={name} onChange={setName} placeholder="Your name" error={errs.name} autoComplete="name" name="name" />
              <TypewriterInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" error={errs.email} autoComplete="email" name="email" onEnter={submit} />
              <div>
                <span className="tw-label">Interested in · optional</span>
                <div className="join-ints">
                  {INTERESTS.map((i) => (
                    <button
                      type="button"
                      key={i}
                      className={`chip ${ints.includes(i) ? "on" : ""}`}
                      onClick={() => setInts((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))}
                      aria-pressed={ints.includes(i)}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <label className={`mk-switch ${errs.consent ? "err" : ""}`}>
                <span className="small">I'd like updates about OVEREO. I can unsubscribe any time.</span>
                <button type="button" className="switch" role="switch" aria-checked={consent} onClick={() => setConsent(!consent)} />
              </label>
              {errs.consent && <span className="tw-err">{errs.consent}</span>}
              <ShineBorder>
                <button className="btn" type="submit" style={{ width: "100%" }}>
                  Join OVEREO <Icon name="arrow" size={17} />
                </button>
              </ShineBorder>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Burst() {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i key={i} style={{ ["--a" as string]: `${(i / 28) * 360}deg`, ["--d" as string]: `${60 + (i % 5) * 22}px`, ["--h" as string]: 320 + (i % 7) * 8 }} />
      ))}
    </span>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="wordmark big">
            <span className="wm-mark" /> OVEREO
          </div>
          <p className="muted small" style={{ maxWidth: 420 }}>
            Your body. Your biology. Your future. A women's precision-health platform in development, built on BioAro's laboratory capabilities and NEYU's care.
          </p>
        </div>
        <div className="footer-cols small">
          <div>
            <b>Platform</b>
            {ROUTES.filter((r) => r.id !== "hero").map((r) => (
              <Link key={r.id} href={r.path}>
                {r.label}
              </Link>
            ))}
          </div>
          <div>
            <b>Specialties</b>
            {SPECIALTIES.map((s) => (
              <Link key={s.slug} href={`/specialties/${s.slug}`}>
                {s.name}
              </Link>
            ))}
          </div>
          <div>
            <b>Sources</b>
            {FACTS.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                {f.source}
              </a>
            ))}
            <a href={OVARY_FACT.url} target="_blank" rel="noreferrer">
              {OVARY_FACT.source}
            </a>
            <a href={MENSTRUAL_FACT.url} target="_blank" rel="noreferrer">
              {MENSTRUAL_FACT.source}
            </a>
          </div>
          <div>
            <b>Shortcuts</b>
            <span>
              <span className="kbd">O</span> Overeo SI
            </span>
            <span>
              hold <span className="kbd">O</span> talk
            </span>
            <span>
              <span className="kbd">⌘</span>
              <span className="kbd">K</span> SI
            </span>
            <span>
              <span className="kbd">Esc</span> close / exit mode
            </span>
          </div>
        </div>
        <p className="note">
          <b>Medical disclaimer.</b> OVEREO provides educational information and organisational tools. It does not diagnose, treat or prevent any condition and is not a substitute for advice from a qualified healthcare professional. This website is a prototype: all personal data shown is synthetic, models are illustrative, and proposed services, partners and integrations are not yet available. In an emergency, call 911 or your local emergency number.
        </p>
        <p className="note">© 2026 OVEREO · Prototype</p>
      </div>
    </footer>
  );
}
