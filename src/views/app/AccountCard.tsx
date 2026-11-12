"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../ui/Icon";
import { toast } from "../../core/store";
import { navigate } from "../../core/routes";
import { ApiError, changePassword, deleteCloudAccount, logOut, useCloud } from "../../cloud/account";
import { syncNow } from "../../cloud/sync";
import { useSpace } from "../../personal/space";
import { Card, Sheet, Switch } from "./kit";

/** Me → Account: who's signed in, saving status, profiles, password, log out, delete. */
export function AccountCard() {
  const status = useCloud((s) => s.status);
  const user = useCloud((s) => s.user);
  const sync = useCloud((s) => s.sync);
  const lastSync = useCloud((s) => s.lastSync);
  const own = useSpace((s) => s.own);
  const profiles = useSpace((s) => s.profiles);
  const [pw, setPw] = useState(false);
  const [del, setDel] = useState(false);

  if (status === "checking") return null;
  return (
    <Card title="Account" icon="user">
      {status === "signed-in" && user ? (
        <>
          <div className="set-row">
            <span>
              Signed in as <b>{user.email}</b>
              <span className={`faint small set-sub acct-sync ${sync}`}>
                {sync === "syncing" ? "Saving…" : sync === "offline" ? "Offline — everything is saved on this device and will be sent when you're back online." : sync === "error" ? "Couldn't save just now — OVEREO will try again." : `Everything is saved to your account${lastSync ? ` · ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}.`}
              </span>
            </span>
            <button className="btn ghost sm" onClick={() => void syncNow().then((ok) => toast(ok ? "Saved to your account" : "Couldn't reach the server — saved on this device"))}>
              <Icon name="refresh" size={14} /> Save now
            </button>
          </div>
          <div className="set-row">
            <span>
              Family profiles
              <span className="faint small set-sub">{profiles.filter((p) => p.cloud).length} in this account · each with private data</span>
            </span>
            <Link className="btn ghost sm" href="/app/profiles">
              <Icon name="users" size={14} /> Manage
            </Link>
          </div>
          <div className="acct-actions">
            <button className="btn ghost sm" onClick={() => setPw(true)}>
              <Icon name="lock" size={14} /> Change password
            </button>
            <button className="btn ghost sm" onClick={() => void logOut().then(() => navigate("/app/welcome"))}>
              <Icon name="close" size={14} /> Log out
            </button>
            <button className="btn ghost sm danger-t" onClick={() => setDel(true)}>
              <Icon name="trash" size={14} /> Delete account
            </button>
          </div>
        </>
      ) : status === "signed-out" ? (
        <div className="set-row">
          <span>
            {own && !own.cloud ? "Keep your space safe in an account" : "Log in to your account"}
            <span className="faint small set-sub">Saved safely, on every device, with family profiles. {own && !own.cloud ? "What's on this device comes with you." : ""}</span>
          </span>
          <span className="acct-actions">
            <Link className="btn sm" href="/app/signin?mode=signup">
              Create account
            </Link>
            <Link className="btn ghost sm" href="/app/signin">
              Log in
            </Link>
          </span>
        </div>
      ) : (
        <div className="set-row">
          <span>
            On this device only
            <span className="faint small set-sub">Accounts aren't switched on for this website yet. Your space stays on this device.</span>
          </span>
        </div>
      )}
      <Sheet open={pw} onClose={() => setPw(false)} title="Change password">
        <PasswordForm onDone={() => setPw(false)} />
      </Sheet>
      <Sheet open={del} onClose={() => setDel(false)} title="Delete your account">
        <DeleteForm onDone={() => setDel(false)} />
      </Sheet>
    </Card>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="pform"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          await changePassword(cur, next);
          toast("Password changed — your other devices were signed out");
          onDone();
        } catch (x) {
          const a = x as ApiError;
          setErr(a.fields?.next ?? a.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="auth-field">
        <span>Current password</span>
        <input className="ainput" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      </label>
      <label className="auth-field">
        <span>New password</span>
        <input className="ainput" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <small className="faint">At least 8 characters. This signs out your other devices.</small>
      </label>
      {err && (
        <p className="auth-msg bad" role="alert">
          {err}
        </p>
      )}
      <button className="btn" disabled={busy || !cur || next.length < 8}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

function DeleteForm({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="pform">
      <p>This permanently deletes your account, every family profile in it, all records, reports and chats — on every device. It can't be undone.</p>
      <p className="faint small">Tip: download your data first in Me → Your data.</p>
      <input className="ainput" type="password" placeholder="Your password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && (
        <p className="auth-msg bad" role="alert">
          {err}
        </p>
      )}
      <button
        className="btn danger"
        disabled={busy || !pw}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await deleteCloudAccount(pw);
            onDone();
            toast("Your account was deleted");
            navigate("/app/welcome");
          } catch (x) {
            setErr((x as ApiError).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Delete everything permanently
      </button>
    </div>
  );
}

/** Me → "Lighter animations": the agents use their light versions (older or busy phones, saving battery). */
export function LiteRow() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem("overeo.lite") === "1";
    } catch {
      return false;
    }
  });
  return (
    <div className="set-row">
      <span>
        <Icon name="bolt" size={15} /> Lighter animations
        <span className="faint small set-sub">Simpler agent characters — faster on older phones and easier on the battery.</span>
      </span>
      <Switch
        on={on}
        onChange={(v) => {
          setOn(v);
          try {
            if (v) localStorage.setItem("overeo.lite", "1");
            else localStorage.removeItem("overeo.lite");
          } catch {}
          toast(v ? "Lighter animations on" : "Full 3D agents on — takes effect on the next page");
        }}
        label="Lighter animations"
      />
    </div>
  );
}
