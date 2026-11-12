"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "../../ui/Icon";
import { navigate } from "../../core/routes";
import { createAccount, removeProfile, saveProfile, space, switchMode, switchProfile, updateAccount, useSpace } from "../../personal/space";
import { checkProfilePin, hashProfilePin } from "../../personal/lock";
import { GOAL_LABEL } from "../../personal/patterns";
import type { Account, Goal, LifeStage, Relation } from "../../personal/types";
import { addCloudProfile, deleteCloudProfile, isUnlocked, logOut, unlockCloudProfile, updateCloudProfile, useCloud, ApiError } from "../../cloud/account";
import { KeyPad, Sheet } from "./kit";

/* =====================================================================
   "Who's checking in?" — every profile on this device as a living orb.
   Family profiles: one login, several people, each with private data
   and an optional PIN. Tap to open; add someone in under a minute.
   ===================================================================== */

export const RELATION_LABEL: Record<Relation, string> = {
  self: "You",
  mother: "Mother",
  daughter: "Daughter",
  sister: "Sister",
  partner: "Partner",
  grandmother: "Grandmother",
  friend: "Friend",
  other: "Family",
};
const HUES = [330, 12, 38, 150, 190, 222, 262, 292];
export const hueOf = (a: Pick<Account, "hue" | "id">) => a.hue ?? HUES[[...a.id].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];

/** A profile as a glowing orb with her initial — CSS only, light on phones. */
export function ProfileOrb({ a, size = 96, locked }: { a: Pick<Account, "name" | "hue" | "id">; size?: number; locked?: boolean }) {
  return (
    <span className="porb" style={{ "--h": hueOf(a), "--s": `${size}px` } as CSSProperties} aria-hidden="true">
      <span className="porb-core" />
      <span className="porb-ring" />
      <span className="porb-i">{(a.name || "·").slice(0, 1).toUpperCase()}</span>
      {locked && (
        <span className="porb-lock">
          <Icon name="lock" size={Math.max(10, size / 8)} />
        </span>
      )}
    </span>
  );
}

const needsPin = (a: Account) => (a.cloud ? !isUnlocked(a) : !!a.pin);

export function ProfilesScreen() {
  const profiles = useSpace((s) => s.profiles);
  const own = useSpace((s) => s.own);
  const status = useCloud((s) => s.status);
  const user = useCloud((s) => s.user);
  const [gate, setGate] = useState<Account | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [manage, setManage] = useState(false);

  const open = (a: Account) => {
    if (needsPin(a)) return setGate(a);
    switchProfile(a.id);
    navigate("/app");
  };

  return (
    <section className="who">
      <div className="who-aurora" aria-hidden="true" />
      <header className="who-head">
        <h1>Who's checking in?</h1>
        <p>{user ? `Signed in as ${user.email}` : "Profiles on this device"}</p>
      </header>
      <div className="who-grid" role="list">
        {profiles.map((a, i) => (
          <div key={a.id} role="listitem" className="who-item" style={{ "--i": i } as CSSProperties}>
            <button className={`who-p ${own?.id === a.id ? "is-on" : ""}`} onClick={() => (manage ? setEditing(a) : open(a))} aria-label={`${manage ? "Edit" : "Open"} ${a.name}${needsPin(a) ? ", PIN locked" : ""}`}>
              <ProfileOrb a={a} size={104} locked={!!(a.pin || a.cloud?.hasPin)} />
              <b>{a.name}</b>
              <span>
                {RELATION_LABEL[a.relation ?? "self"]}
                {a.cloud ? "" : " · this device"}
              </span>
              {manage && (
                <span className="who-edit">
                  <Icon name="edit" size={14} />
                </span>
              )}
            </button>
          </div>
        ))}
        {profiles.length < 8 && (
          <div role="listitem" className="who-item" style={{ "--i": profiles.length } as CSSProperties}>
            <button className="who-p who-add" onClick={() => (profiles.length ? setAdding(true) : navigate("/app/welcome"))}>
              <span className="porb add" aria-hidden="true">
                <Icon name="plus" size={34} />
              </span>
              <b>{profiles.length ? "Add someone" : "Create your space"}</b>
              <span>{profiles.length ? "Mother, daughter, sister…" : "About a minute"}</span>
            </button>
          </div>
        )}
      </div>
      <div className="who-foot">
        {profiles.length > 0 && (
          <button className="btn ghost" onClick={() => setManage((m) => !m)}>
            <Icon name={manage ? "check" : "settings"} size={15} /> {manage ? "Done" : "Manage profiles"}
          </button>
        )}
        <button
          className="btn ghost"
          onClick={() => {
            switchMode("sample");
            navigate("/app");
          }}
        >
          <Icon name="eye" size={15} /> Look around with sample data
        </button>
        {status === "signed-in" ? (
          <button className="btn ghost" onClick={() => void logOut().then(() => navigate("/app/welcome"))}>
            <Icon name="close" size={15} /> Log out
          </button>
        ) : (
          status === "signed-out" && (
            <button className="btn ghost" onClick={() => navigate("/app/signin")}>
              <Icon name="user" size={15} /> Log in
            </button>
          )
        )}
      </div>
      {gate && (
        <PinGate
          a={gate}
          onCancel={() => setGate(null)}
          onOpen={() => {
            try {
              sessionStorage.setItem("overeo.open", gate.id);
            } catch {}
            switchProfile(gate.id);
            setGate(null);
            navigate("/app");
          }}
        />
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add someone">
        <ProfileForm
          onDone={(a) => {
            setAdding(false);
            if (a) {
              switchProfile(a.id);
              navigate("/app");
            }
          }}
        />
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        {editing && <ProfileForm edit={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </section>
  );
}

/* ------------------------------- PIN gate ------------------------------- */

export function PinGate({ a, onOpen, onCancel }: { a: Account; onOpen: () => void; onCancel?: () => void }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const check = async (p: string) => {
    setBusy(true);
    try {
      const ok = a.cloud ? await unlockCloudProfile(a.id, p) : a.pin ? await checkProfilePin(a.pin, p) : true;
      if (ok) onOpen();
      else {
        setMsg("That PIN isn't right.");
        setPin("");
      }
    } catch (e) {
      setMsg((e as ApiError).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((x) => (x + e.key).slice(0, 8));
      if (e.key === "Backspace") setPin((x) => x.slice(0, -1));
      if (e.key === "Enter" && pin.length >= 4) void check(pin);
      if (e.key === "Escape") onCancel?.();
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  return (
    <div className="pin-gate" role="dialog" aria-modal="true" aria-label={`Enter ${a.name}'s PIN`}>
      <div className="pin-card glass">
        <ProfileOrb a={a} size={84} />
        <b>{a.name}</b>
        <span className="faint small">Enter the PIN for this profile</span>
        <div className="pin-dots" aria-live="polite" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <i key={i} className={i < pin.length ? "on" : ""} />
          ))}
        </div>
        {msg && (
          <p className="auth-msg bad" role="alert">
            {msg}
          </p>
        )}
        <KeyPad onKey={(k) => (setMsg(""), k === "⌫" ? setPin((x) => x.slice(0, -1)) : setPin((x) => (x + k).slice(0, 8)))} />
        <div className="pin-actions">
          {onCancel && (
            <button className="btn ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn" disabled={pin.length < 4 || busy} onClick={() => void check(pin)}>
            {busy ? "Checking…" : "Open"} <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- add / edit a profile --------------------------- */

const STAGES: [LifeStage, string][] = [
  ["cycling", "Has periods"],
  ["trying", "Trying for a baby"],
  ["pregnant", "Pregnant"],
  ["postpartum", "Had a baby this year"],
  ["peri", "Perimenopause"],
  ["post", "After menopause"],
];

function ProfileForm({ edit, onDone }: { edit?: Account; onDone: (a?: Account) => void }) {
  const status = useCloud((s) => s.status);
  const cloudOn = status === "signed-in";
  const [name, setName] = useState(edit?.name ?? "");
  const [relation, setRelation] = useState<Exclude<Relation, "self">>((edit?.relation as Exclude<Relation, "self">) ?? "mother");
  const [birthYear, setBirthYear] = useState(edit?.birthYear ? String(edit.birthYear) : "");
  const [stage, setStage] = useState<LifeStage>(edit?.stage ?? "cycling");
  const [goals, setGoals] = useState<Goal[]>(edit?.goals ?? []);
  const [hue, setHue] = useState(edit ? hueOf(edit) : HUES[Math.floor(Math.random() * HUES.length)]);
  const [pin, setPin] = useState("");
  const [removePin, setRemovePin] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isSelf = edit?.relation === "self" || (edit && !edit.relation);
  const year = Number(birthYear);
  const yearOk = !birthYear || (year >= 1900 && year <= new Date().getFullYear());
  const pinOk = !pin || /^\d{4,8}$/.test(pin);

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const fields = { name: name.trim(), birthYear: birthYear ? year : undefined, lifeStage: stage, goals: goals.length ? goals : (["general"] as Goal[]), hue };
      if (edit) {
        if (edit.cloud) {
          await updateCloudProfile(edit.id, { name: fields.name, birthYear: fields.birthYear ?? null, lifeStage: stage, goals: fields.goals, hue, ...(pin ? { pin } : removePin ? { pin: null } : {}) });
        } else {
          const patch: Partial<Account> = { name: fields.name, birthYear: fields.birthYear, stage, goals: fields.goals, hue, ...(pin ? { pin: await hashProfilePin(pin) } : removePin ? { pin: null } : {}) };
          if (edit.id === space.get().own?.id) updateAccount(patch);
          else saveProfile({ ...edit, ...patch });
        }
        onDone();
      } else if (cloudOn) {
        const a = await addCloudProfile({ ...fields, relation, pin: pin || undefined });
        onDone(a);
      } else {
        const a = createAccount({ name: fields.name, relation, birthYear: fields.birthYear, stage, goals: fields.goals, hue, consent: { personalise: true, genetics: false, notifications: false, research: false }, pin: pin ? await hashProfilePin(pin) : null }, { open: false });
        onDone(a);
      }
    } catch (e) {
      setErr((e as ApiError).message ?? "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!edit) return;
    setBusy(true);
    setErr("");
    try {
      if (edit.cloud) await deleteCloudProfile(edit.id, password);
      else removeProfile(edit.id);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pform">
      <div className="pform-preview">
        <ProfileOrb a={{ name: name || "?", hue, id: "x" }} size={88} />
      </div>
      <label className="auth-field">
        <span>Name</span>
        <input className="ainput" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Her first name" />
      </label>
      {!isSelf && !edit && (
        <div className="auth-field">
          <span>Who is she to you?</span>
          <div className="chips">
            {(["mother", "daughter", "sister", "partner", "grandmother", "friend", "other"] as const).map((r) => (
              <button key={r} type="button" className={`chip ${relation === r ? "on" : ""}`} aria-pressed={relation === r} onClick={() => setRelation(r)}>
                {RELATION_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="auth-field">
        <span>Year of birth (optional)</span>
        <input className="ainput" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 1968" aria-invalid={!yearOk} />
        {!yearOk && <em className="auth-err">Please check the year.</em>}
      </label>
      <div className="auth-field">
        <span>Where is she right now?</span>
        <div className="chips">
          {STAGES.map(([id, l]) => (
            <button key={id} type="button" className={`chip ${stage === id ? "on" : ""}`} aria-pressed={stage === id} onClick={() => setStage(id)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="auth-field">
        <span>Help with</span>
        <div className="chips">
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <button key={g} type="button" className={`chip ${goals.includes(g) ? "on" : ""}`} aria-pressed={goals.includes(g)} onClick={() => setGoals((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}>
              {GOAL_LABEL[g][0].toUpperCase() + GOAL_LABEL[g].slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="auth-field">
        <span>Colour</span>
        <div className="pform-hues" role="radiogroup" aria-label="Colour">
          {HUES.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={hue === h} className={`pform-hue ${hue === h ? "on" : ""}`} style={{ "--h": h } as CSSProperties} onClick={() => setHue(h)} aria-label={`Colour ${h}`} />
          ))}
        </div>
      </div>
      <label className="auth-field">
        <span>{edit && (edit.pin || edit.cloud?.hasPin) ? "New PIN (optional)" : "PIN for this profile (optional)"}</span>
        <input className="ainput" inputMode="numeric" type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="4 to 8 numbers" aria-invalid={!pinOk} />
        <small className="faint">Keeps her data private when you share a phone.</small>
        {!pinOk && <em className="auth-err">Use 4 to 8 numbers.</em>}
      </label>
      {edit && (edit.pin || edit.cloud?.hasPin) && !pin && (
        <label className="ob-check">
          <input type="checkbox" checked={removePin} onChange={(e) => setRemovePin(e.target.checked)} /> Remove the PIN
        </label>
      )}
      {err && (
        <p className="auth-msg bad" role="alert">
          <Icon name="alert" size={14} /> {err}
        </p>
      )}
      <button className="btn" disabled={busy || !name.trim() || !yearOk || !pinOk} onClick={() => void save()}>
        {busy ? "Saving…" : edit ? "Save" : `Add ${name.trim() || "her"}`} <Icon name="check" size={14} />
      </button>
      {edit && !isSelf && (
        <div className="pform-danger">
          {!confirmDelete ? (
            <button className="btn ghost sm" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={14} /> Remove {edit.name}'s profile
            </button>
          ) : (
            <>
              <p className="small">This permanently deletes {edit.name}'s profile and everything in it{edit.cloud ? ", on every device" : " from this device"}.</p>
              {edit.cloud && <input className="ainput" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your account password" autoComplete="current-password" />}
              <button className="btn danger sm" disabled={busy || (!!edit.cloud && !password)} onClick={() => void del()}>
                Delete permanently
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The open profile is PIN-locked and not yet unlocked in this browser tab. */
export function useNeedsGate() {
  const own = useSpace((s) => s.own);
  const mode = useSpace((s) => s.mode);
  const [unlocked, setUnlocked] = useState<string | null>(null);
  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem("overeo.open"));
    } catch {}
  }, []);
  const gate = mode === "real" && own && unlocked !== own.id && (own.cloud ? !isUnlocked(own) : !!own.pin) ? own : null;
  return {
    gate,
    pass: (id: string) => {
      try {
        sessionStorage.setItem("overeo.open", id);
      } catch {}
      setUnlocked(id);
    },
  };
}
