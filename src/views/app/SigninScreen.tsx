"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../ui/Icon";
import { LogoMark } from "../../ui/Logo";
import { navigate } from "../../core/routes";
import { toast } from "../../core/store";
import { AUTH_MODE, getSession, normaliseEmail, signOutEmail, startOtp, validEmail, verifyOtp } from "../../auth/otp";
import { diary, switchMode, updateAccount, useSpace } from "../../personal/space";

/* =====================================================================
   Sign in with email — a 6-digit code, no password.
   ===================================================================== */

const RESEND_AFTER = 30;

export function SigninScreen() {
  const own = useSpace((s) => s.own);
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState(own?.email ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [signedIn, setSignedIn] = useState(() => getSession());
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setErr(null);
    if (!validEmail(email)) return setErr("Please enter a valid email address.");
    setBusy(true);
    const r = await startOtp(email);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      if (r.retryAfter) setWait(Math.min(120, r.retryAfter));
      return;
    }
    setStep("code");
    setCode("");
    setWait(RESEND_AFTER);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  };

  const verify = async (c: string) => {
    if (busy) return;
    setErr(null);
    setBusy(true);
    const r = await verifyOtp(email, c);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      setCode("");
      setTimeout(() => boxes.current[0]?.focus(), 50);
      return;
    }
    const s = r.value;
    if (own?.authUserId && own.authUserId !== s.userId) {
      await signOutEmail();
      setErr(`The space on this device belongs to another account${own.email ? ` (${own.email})` : ""}. Sign in with that email instead.`);
      setStep("email");
      return;
    }
    setSignedIn(s);
    if (own) {
      updateAccount({ email: s.email, authUserId: s.userId });
      switchMode("real");
      diary("you", "Signed in with your email", s.email);
      toast("Signed in");
      setStep("done");
    } else navigate("/app/welcome");
  };

  const setDigit = (i: number, v: string) => {
    const digits = v.replace(/\D/g, "");
    if (!digits) {
      setCode((c) => c.slice(0, i) + c.slice(i + 1));
      return;
    }
    // typing or pasting the whole code
    const next = (code.slice(0, i) + digits).slice(0, 6);
    setCode(next);
    boxes.current[Math.min(5, next.length)]?.focus();
    if (next.length === 6) void verify(next);
  };

  if (AUTH_MODE === "none")
    return (
      <Frame>
        <h1 className="ob-title">Email sign-in is coming</h1>
        <p className="ob-sub">For now your space lives safely on this device — everything works without an account. You'll be able to sign in with a code by email as soon as accounts are switched on.</p>
        <Link className="btn" href={own ? "/app" : "/app/welcome"}>
          {own ? "Back to my space" : "Create my space"} <Icon name="arrow" size={16} />
        </Link>
      </Frame>
    );

  if (signedIn && step === "email")
    return (
      <Frame>
        <h1 className="ob-title">You're signed in</h1>
        <p className="ob-sub">As {signedIn.email}.</p>
        <div className="ob-nav">
          <button
            className="btn ghost"
            onClick={async () => {
              await signOutEmail();
              setSignedIn(null);
              toast("Signed out of email — your space stays on this device");
            }}
          >
            Sign out of email
          </button>
          <Link className="btn" href={own ? "/app" : "/app/welcome"}>
            Continue <Icon name="arrow" size={16} />
          </Link>
        </div>
      </Frame>
    );

  return (
    <Frame>
      {step === "email" && (
        <form
          className="signin"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <h1 className="ob-title">Sign in with email</h1>
          <p className="ob-sub">We'll email you a 6-digit code. No password to remember.</p>
          <input className="ainput big" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" autoFocus />
          {err && (
            <p className="alert-note small" role="alert">
              {err}
            </p>
          )}
          <button className="btn" type="submit" disabled={busy || !email.trim() || wait > 0}>
            {busy ? "Sending…" : wait > 0 ? `Try again in ${wait}s` : "Email me a code"} <Icon name="mail" size={16} />
          </button>
          <p className="faint small">Your health data stays on this device. Signing in links this space to your email.</p>
        </form>
      )}
      {step === "code" && (
        <div className="signin">
          <h1 className="ob-title">Check your email</h1>
          <p className="ob-sub">
            We sent a code to <b>{normaliseEmail(email)}</b>.{" "}
            <button className="linkish" onClick={() => (setStep("email"), setErr(null))}>
              Change
            </button>
          </p>
          <div className="otp" role="group" aria-label="6-digit code">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                className="otp-box"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={i === 0 ? 6 : 1}
                value={code[i] ?? ""}
                aria-label={`Digit ${i + 1}`}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  setDigit(0, e.clipboardData.getData("text"));
                }}
                disabled={busy}
              />
            ))}
          </div>
          {err && (
            <p className="alert-note small" role="alert">
              {err}
            </p>
          )}
          <div className="ob-nav">
            <button className="btn ghost" disabled={wait > 0 || busy} onClick={() => void send()}>
              {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
            </button>
            <button className="btn" disabled={code.length < 6 || busy} onClick={() => void verify(code)}>
              {busy ? "Checking…" : "Sign in"} <Icon name="arrow" size={16} />
            </button>
          </div>
          <p className="faint small">Can't find it? Check spam. Codes expire after a few minutes.</p>
        </div>
      )}
      {step === "done" && (
        <>
          <h1 className="ob-title">You're in</h1>
          <p className="ob-sub">This space is now linked to {signedIn?.email}.</p>
          <Link className="btn" href="/app">
            Go to my space <Icon name="arrow" size={16} />
          </Link>
        </>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section className="ob">
      <div className="ob-card glass">
        <span className="ob-mark">
          <LogoMark size={48} />
        </span>
        {children}
      </div>
      <Link href="/app" className="ob-home faint small">
        Back to OVEREO
      </Link>
    </section>
  );
}
