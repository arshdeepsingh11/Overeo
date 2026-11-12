"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../../ui/Icon";
import { LogoMark } from "../../ui/Logo";
import { navigate } from "../../core/routes";
import { ApiError, forgotPassword, logIn, resetPassword, signUp, useCloud } from "../../cloud/account";
import { moveLocalInto, syncNow } from "../../cloud/sync";
import { removeProfile, space, switchProfile, useSpace } from "../../personal/space";

/* =====================================================================
   Create an account · Log in · Forgot password — one calm screen.
   Plain words, big fields, errors next to the field they're about.
   ===================================================================== */

type Mode = "signup" | "login" | "forgot" | "reset";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [token, setToken] = useState("");
  const status = useCloud((s) => s.status);
  const own = useSpace((s) => s.own);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [bring, setBring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const m = q.get("mode");
    if (q.get("token")) {
      setToken(q.get("token")!);
      setMode("reset");
    } else if (m === "signup" || m === "forgot") setMode(m);
  }, []);

  const localSpace = own && !own.cloud ? own : null;

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote("");
    try {
      if (mode === "signup") {
        const r = await signUp(name.trim(), email.trim(), password);
        const primary = r.profiles.find((p) => p.isPrimary)!;
        if (localSpace && bring) {
          // bring what she already logged on this device into her account
          moveLocalInto(localSpace.id, primary.id);
          removeProfile(localSpace.id);
        }
        switchProfile(primary.id);
        void syncNow();
        navigate(localSpace && bring ? "/app" : "/app/welcome?setup=1");
      } else if (mode === "login") {
        await logIn(email.trim(), password);
        const profiles = space.get().profiles.filter((p) => p.cloud);
        navigate(profiles.length > 1 ? "/app/profiles" : "/app");
      } else if (mode === "forgot") {
        const r = await forgotPassword(email.trim());
        setNote(r.message);
      } else {
        await resetPassword(token, password);
        setNote("Your password is changed. You can log in now.");
        setMode("login");
        setPassword("");
      }
    } catch (x) {
      const e2 = x as ApiError;
      setErr({ message: e2.message, fields: e2.fields });
    } finally {
      setBusy(false);
    }
  };

  const off = status === "off";
  const fieldErr = (k: string) => err?.fields?.[k];

  return (
    <section className="ob auth">
      <div className="ob-card glass auth-card">
        <span className="ob-mark">
          <LogoMark size={52} />
        </span>
        <h1 className="ob-title">{mode === "signup" ? "Create your account" : mode === "login" ? "Welcome back" : mode === "forgot" ? "Forgot your password?" : "Choose a new password"}</h1>
        <p className="ob-sub">
          {mode === "signup"
            ? "Your data is saved safely and follows you to any phone or computer. Add your family later."
            : mode === "login"
              ? "Log in to see your space and your family's profiles."
              : mode === "forgot"
                ? "Enter your email. We'll send you a link to choose a new one."
                : "Use at least 8 characters."}
        </p>

        {off ? (
          <div className="auth-off" role="status">
            <Icon name="wifioff" size={18} />
            <span>Accounts aren't switched on for this website yet. You can still use OVEREO on this device and move your data into an account later.</span>
            <Link className="btn" href="/app/welcome">
              Start on this device <Icon name="arrow" size={14} />
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={go} noValidate>
            {mode === "signup" && (
              <label className="auth-field">
                <span>Your first name</span>
                <input className="ainput big" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required maxLength={60} aria-invalid={!!fieldErr("name")} />
                {fieldErr("name") && <em className="auth-err">{fieldErr("name")}</em>}
              </label>
            )}
            {mode !== "reset" && (
              <label className="auth-field">
                <span>Email</span>
                <input className="ainput big" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required aria-invalid={!!fieldErr("email")} />
                {fieldErr("email") && <em className="auth-err">{fieldErr("email")}</em>}
              </label>
            )}
            {mode !== "forgot" && (
              <label className="auth-field">
                <span>{mode === "reset" ? "New password" : "Password"}</span>
                <span className="auth-pw">
                  <input className="ainput big" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} aria-invalid={!!fieldErr("password")} />
                  <button type="button" className="auth-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                    <Icon name={show ? "eyeoff" : "eye"} size={16} />
                  </button>
                </span>
                {mode !== "login" && <small className="faint">At least 8 characters. A short sentence is easy to remember.</small>}
                {fieldErr("password") && <em className="auth-err">{fieldErr("password")}</em>}
              </label>
            )}
            {mode === "signup" && localSpace && (
              <label className="ob-check">
                <input type="checkbox" checked={bring} onChange={(e) => setBring(e.target.checked)} /> Bring what I've logged on this device ({localSpace.name}) into my account
              </label>
            )}
            {err && !err.fields && (
              <p className="auth-msg bad" role="alert">
                <Icon name="alert" size={14} /> {err.message}
              </p>
            )}
            {note && (
              <p className="auth-msg good" role="status">
                <Icon name="check" size={14} /> {note}
              </p>
            )}
            <button className="btn auth-go" type="submit" disabled={busy || (mode === "signup" && (!name.trim() || !email.trim() || password.length < 8)) || (mode === "login" && (!email.trim() || !password)) || (mode === "forgot" && !email.trim())}>
              {busy ? "One moment…" : mode === "signup" ? "Create my account" : mode === "login" ? "Log in" : mode === "forgot" ? "Send the link" : "Save new password"}
              {!busy && <Icon name="arrow" size={16} />}
            </button>
          </form>
        )}

        {!off && (
          <div className="auth-switch">
            {mode === "login" && (
              <>
                <button className="linkish" onClick={() => (setMode("forgot"), setErr(null), setNote(""))}>
                  Forgot password?
                </button>
                <span>
                  New here?{" "}
                  <button className="linkish" onClick={() => (setMode("signup"), setErr(null), setNote(""))}>
                    Create an account
                  </button>
                </span>
              </>
            )}
            {mode === "signup" && (
              <span>
                Have an account?{" "}
                <button className="linkish" onClick={() => (setMode("login"), setErr(null), setNote(""))}>
                  Log in
                </button>
              </span>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button className="linkish" onClick={() => (setMode("login"), setErr(null), setNote(""))}>
                Back to log in
              </button>
            )}
          </div>
        )}
        <p className="faint small auth-fine">
          <Icon name="lock" size={12} /> Educational, not a diagnosis. Your data is never sold or shared. <Link href="/privacy">Privacy</Link>
        </p>
      </div>
      <Link href="/app/welcome" className="ob-home faint small">
        Other ways to start
      </Link>
    </section>
  );
}
