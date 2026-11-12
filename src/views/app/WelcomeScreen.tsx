"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../../ui/Icon";
import { LogoMark } from "../../ui/Logo";
import { navigate } from "../../core/routes";
import { addRecord, createAccount, setPrefs, switchMode, updateAccount, useSpace } from "../../personal/space";
import { runAgents } from "../../personal/actions";
import { GOAL_LABEL } from "../../personal/patterns";
import { LANGS } from "../../personal/i18n";
import { useT } from "../../personal/useT";
import type { Goal, Lang, LifeStage } from "../../personal/types";
import { Stepper, Switch, toLocalInput } from "./kit";
import { updateCloudProfile, useCloud } from "../../cloud/account";
import { SPECIALISTS } from "../../agents/team";
import { Character } from "./team/Character";

/* =====================================================================
   Sign in + first-time setup (about a minute). From the first answer,
   her OVEREO is different from everyone else's.

   Three ways in: an account (saved safely, on every device, with family
   profiles), this device only, or the sample. After creating an account
   she lands here with ?setup=1 for the same short setup.
   ===================================================================== */

const STAGES: { id: LifeStage; label: string; sub: string }[] = [
  { id: "cycling", label: "I have regular-ish periods", sub: "Most common" },
  { id: "trying", label: "Trying to conceive", sub: "Or planning to soon" },
  { id: "pregnant", label: "Pregnant", sub: "" },
  { id: "postpartum", label: "Postpartum", sub: "Had a baby in the last year" },
  { id: "peri", label: "Perimenopause", sub: "Cycles changing, hot flashes, sleep" },
  { id: "post", label: "After menopause", sub: "No period for 12+ months" },
];

export function WelcomeScreen() {
  const t = useT();
  const own = useSpace((s) => s.own);
  const lang = useSpace((s) => s.prefs.lang);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const cloudStatus = useCloud((s) => s.status);
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("setup") === "1") {
      setSetup(true);
      setStep(2);
    }
  }, []);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stage, setStage] = useState<LifeStage>("cycling");
  const [last, setLast] = useState("");
  const [unsure, setUnsure] = useState(false);
  const [len, setLen] = useState(28);
  const [consent, setConsent] = useState({ personalise: true, genetics: false, notifications: false, research: false });

  if (own && step === 0 && !setup)
    return (
      <Shell>
        <h1 className="ob-title">Welcome back, {own.name}</h1>
        <p className="ob-sub">{own.cloud ? "You're signed in." : "Your space is on this device."}</p>
        <button
          className="btn"
          onClick={() => {
            switchMode("real");
            navigate("/app");
          }}
        >
          {t("space.switchMine")} <Icon name="arrow" size={16} />
        </button>
        <Link className="btn ghost" href="/app/profiles">
          <Icon name="users" size={15} /> Switch profile or add someone
        </Link>
        {!own.cloud && cloudStatus !== "off" && cloudStatus !== "checking" && (
          <Link className="linkish small" href="/app/signin?mode=signup">
            Save it to an account, so it's safe on every device
          </Link>
        )}
      </Shell>
    );

  const finish = () => {
    const typicalCycle = stage === "post" || stage === "pregnant" ? undefined : len;
    const g: Goal[] = goals.length ? goals : ["general"];
    if (setup && own) {
      // her new account's profile: same answers, saved in the backend too
      updateAccount({ goals: g, stage, typicalCycle, consent });
      if (own.cloud) void updateCloudProfile(own.id, { goals: g, lifeStage: stage, typicalCycle: typicalCycle ?? null, consent }).catch(() => undefined);
    } else createAccount({ name: name.trim() || "You", relation: "self", goals: g, stage, typicalCycle, consent });
    if (last && !unsure) addRecord("period_start", { flow: 3 }, { observedAt: new Date(`${last}T08:00`).toISOString() });
    setTimeout(runAgents, 50);
    navigate("/app");
  };

  const steps = [
    /* 0 — choice */
    <>
      <span className="ob-mark">
        <LogoMark size={56} />
      </span>
      <div className="ob-team" aria-hidden="true">
        {SPECIALISTS.map((a, i) => (
          <span key={a.id} style={{ ["--i" as string]: i } as React.CSSProperties}>
            <Character agent={a} size={36} label={false} />
          </span>
        ))}
      </div>
      <h1 className="ob-title">Your body. Your biology. Your future.</h1>
      <p className="ob-sub">OVEREO learns your rhythm and helps you act on it — privately.</p>
      <div className="ob-choices">
        {cloudStatus !== "off" && (
          <>
            <Link className="ob-choice main" href="/app/signin?mode=signup">
              <Icon name="user" size={20} />
              <span>
                <b>Create my account</b>
                <span>Saved safely, on any phone or computer. Add your family.</span>
              </span>
              <Icon name="arrow" size={16} />
            </Link>
            <Link className="ob-choice" href="/app/signin">
              <Icon name="lock" size={20} />
              <span>
                <b>Log in</b>
                <span>I already have an account.</span>
              </span>
              <Icon name="arrow" size={16} />
            </Link>
          </>
        )}
        <button className={`ob-choice ${cloudStatus === "off" ? "main" : ""}`} onClick={() => setStep(1)}>
          <Icon name="phone" size={20} />
          <span>
            <b>{cloudStatus === "off" ? t("space.create") : "Use it on this device only"}</b>
            <span>About a minute. Nothing leaves this phone. You can make an account later.</span>
          </span>
          <Icon name="arrow" size={16} />
        </button>
        <button
          className="ob-choice"
          onClick={() => {
            switchMode("sample");
            navigate("/app");
          }}
        >
          <Icon name="eye" size={20} />
          <span>
            <b>{t("space.switchSample")}</b>
            <span>Explore with six months of sample data.</span>
          </span>
          <Icon name="arrow" size={16} />
        </button>
      </div>
      <label className="ob-lang">
        <Icon name="language" size={15} />
        <select value={lang} onChange={(e) => setPrefs({ lang: e.target.value as Lang })} aria-label="Language">
          {LANGS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.native}
            </option>
          ))}
        </select>
      </label>
      {cloudStatus === "off" && <p className="faint small">Accounts aren't switched on for this website yet — your space lives on this device.</p>}
    </>,
    /* 1 — name */
    <>
      <h1 className="ob-title">What should OVEREO call you?</h1>
      <input className="ainput big" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoFocus aria-label="First name" />
    </>,
    /* 2 — goals */
    <>
      <h1 className="ob-title">What would you like help with?</h1>
      <p className="ob-sub">Pick any. This decides which agents work for you.</p>
      <div className="ob-goals">
        {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
          <button key={g} className={`ob-goal ${goals.includes(g) ? "on" : ""}`} aria-pressed={goals.includes(g)} onClick={() => setGoals((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}>
            <Icon name={goals.includes(g) ? "check" : "plus"} size={14} /> {GOAL_LABEL[g][0].toUpperCase() + GOAL_LABEL[g].slice(1)}
          </button>
        ))}
      </div>
    </>,
    /* 3 — life stage */
    <>
      <h1 className="ob-title">Where are you right now?</h1>
      <div className="ob-stages">
        {STAGES.map((s) => (
          <button key={s.id} className={`ob-stage ${stage === s.id ? "on" : ""}`} aria-pressed={stage === s.id} onClick={() => setStage(s.id)}>
            <b>{s.label}</b>
            {s.sub && <span>{s.sub}</span>}
          </button>
        ))}
      </div>
    </>,
    /* 4 — last period */
    <>
      <h1 className="ob-title">When did your last period start?</h1>
      <p className="ob-sub">One date is enough to begin. OVEREO replaces averages with your own rhythm as you log.</p>
      <input className="ainput big" type="date" value={last} max={toLocalInput(new Date().toISOString()).slice(0, 10)} onChange={(e) => (setLast(e.target.value), setUnsure(false))} aria-label="Last period start date" disabled={unsure} />
      <label className="ob-check">
        <input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)} /> I'm not sure / not applicable
      </label>
      <span className="form-k">Your usual cycle length (your best guess)</span>
      <Stepper value={len} onChange={setLen} min={18} max={60} fmt={(x) => `${x} days`} label="Cycle length" />
    </>,
    /* 5 — privacy */
    <>
      <h1 className="ob-title">Your privacy, your rules</h1>
      <p className="ob-sub">You can change these any time in Me.</p>
      {(
        [
          ["personalise", "Personalise Overeo SI with my data", "SI uses what it has learned about you to answer. Off = general answers only."],
          ["notifications", "Reminders as notifications", "Only for reminders you approve. Discreet wording available."],
          ["genetics", "Use genetic results", "Off by default. Each use asks again."],
          ["research", "Contribute anonymously to research", "Never without this switch. Off by default."],
        ] as const
      ).map(([k, label, sub]) => (
        <div key={k} className="set-row">
          <span>
            {label}
            <span className="faint small set-sub">{sub}</span>
          </span>
          <Switch on={consent[k]} onChange={(v) => setConsent((c) => ({ ...c, [k]: v }))} label={label} />
        </div>
      ))}
    </>,
  ];
  const canNext = step === 1 ? name.trim().length > 0 : step === 2 ? goals.length > 0 : true;
  const lastStep = step === steps.length - 1;

  return (
    <Shell>
      {step > 0 && (
        <div className="ob-progress" aria-hidden="true">
          {steps.slice(1).map((_, i) => (
            <span key={i} className={i < step ? "on" : ""} />
          ))}
        </div>
      )}
      <div className="ob-step" key={step}>
        {steps[step]}
      </div>
      {step > 0 && (
        <div className="ob-nav">
          <button className="btn ghost" onClick={() => setStep((s) => (setup && s === 2 ? s : s - 1))} disabled={setup && step === 2}>
            {t("common.back")}
          </button>
          <button className="btn" disabled={!canNext} onClick={() => (lastStep ? finish() : setStep((s) => s + 1))}>
            {lastStep ? (setup ? "Done" : t("space.create")) : t("common.next")} <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="ob">
      <div className="ob-card glass">{children}</div>
      <Link href="/" className="ob-home faint small">
        Explore OVEREO first
      </Link>
    </section>
  );
}
