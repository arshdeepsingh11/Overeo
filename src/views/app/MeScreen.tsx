"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../ui/Icon";
import { setTheme, useStore, toast } from "../../core/store";
import { useLearned, enableNotifications } from "../../personal/actions";
import { LANGS } from "../../personal/i18n";
import { removePin, setPin } from "../../personal/lock";
import { GOAL_LABEL } from "../../personal/patterns";
import { correctMemory, deleteMySpace, exportMySpace, forgetMemory, resetSample, setPrefs, signOut, tellMemory, updateAccount, useSpace } from "../../personal/space";
import { useT } from "../../personal/useT";
import type { Goal, Lang, MemoryItem } from "../../personal/types";
import { AppPage, Card, KeyPad, Sheet, Switch } from "./kit";

const AREA: Record<MemoryItem["area"], string> = { cycle: "Cycle", mood: "Mood", sleep: "Sleep", body: "Body", labs: "Labs", habits: "Habits", preferences: "Preferences", goals: "Goals" };

export function MeScreen() {
  const t = useT();
  const l = useLearned();
  const account = useSpace((s) => s.account);
  const own = useSpace((s) => s.own);
  const mode = useSpace((s) => s.mode);
  const prefs = useSpace((s) => s.prefs);
  const theme = useStore((s) => s.theme);
  const [fix, setFix] = useState<MemoryItem | null>(null);
  const [fixText, setFixText] = useState("");
  const [tell, setTell] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const grouped = Object.entries(
    l.memory.reduce<Record<string, MemoryItem[]>>((acc, m) => {
      (acc[m.area] ??= []).push(m);
      return acc;
    }, {}),
  );

  return (
    <AppPage title={account?.name ?? t("me.title")} sub={mode === "sample" ? "Maya's sample profile" : `Your private space on this device${own?.email ? ` · ${own.email}` : ""}`} icon="user">
      <div className="me-grid">
        <Card className="me-knows" title={t("me.knows")} icon="sparkle">
          <p className="small muted">{t("me.knowsSub")}</p>
          {grouped.length ? (
            grouped.map(([area, items]) => (
              <div key={area} className="mem-group">
                <span className="mem-area">{AREA[area as MemoryItem["area"]]}</span>
                {items.map((m) => (
                  <div key={m.id} className="mem">
                    <span className="conf" style={{ ["--c" as string]: m.confidence }} title={`${Math.round(m.confidence * 100)}% sure`} />
                    <span className="mem-main">
                      {m.text}
                      <span className="faint small">
                        {" "}
                        · {m.kind === "learned" ? `learned from ${m.evidence.toLowerCase()}` : m.evidence}
                      </span>
                    </span>
                    <span className="mem-actions">
                      <button
                        className="chip"
                        onClick={() => {
                          setFix(m);
                          setFixText(m.text);
                        }}
                      >
                        {t("me.correct")}
                      </button>
                      <button className="chip" onClick={() => forgetMemory(m.id)}>
                        {t("me.forget")}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="small">Nothing learned yet. Patterns appear after a couple of weeks of check-ins.</p>
          )}
          <div className="tell">
            <input className="ainput" value={tell} onChange={(e) => setTell(e.target.value)} placeholder="e.g. I'm trying to get pregnant next year · I work night shifts" aria-label={t("me.tell")} />
            <button
              className="btn sm"
              disabled={!tell.trim()}
              onClick={() => {
                tellMemory(tell.trim(), /pregnan|fertil|egg/i.test(tell) ? "goals" : "preferences");
                setTell("");
                toast("OVEREO will remember that");
              }}
            >
              {t("me.tell")}
            </button>
          </div>
        </Card>

        <div className="me-side">
          {mode === "real" && own && (
            <Card title="About you" icon="user">
              <span className="form-k">Focus</span>
              <div className="chips">
                {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                  <button key={g} className={`chip ${own.goals.includes(g) ? "on" : ""}`} onClick={() => updateAccount({ goals: own.goals.includes(g) ? own.goals.filter((x) => x !== g) : [...own.goals, g] })}>
                    {GOAL_LABEL[g]}
                  </button>
                ))}
              </div>
              <label className="when">
                <span>Personalise SI with my data</span>
                <Switch on={own.consent.personalise} onChange={(v) => updateAccount({ consent: { ...own.consent, personalise: v } })} label="Personalise SI" />
              </label>
            </Card>
          )}

          <Card title={t("me.settings")} icon="settings">
            <div className="set-row">
              <span>
                <Icon name="language" size={15} /> {t("me.language")}
              </span>
              <select value={prefs.lang} onChange={(e) => setPrefs({ lang: e.target.value as Lang })} aria-label={t("me.language")}>
                {LANGS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.native}
                  </option>
                ))}
              </select>
            </div>
            {prefs.lang !== "en" && <p className="faint small">App and SI answers in {LANGS.find((x) => x.id === prefs.lang)?.label}. {t("common.englishOnly").replace("This article", "Educational articles")}</p>}
            <div className="set-row">
              <span>
                <Icon name="eyeoff" size={15} /> {t("me.discreet")}
                <span className="faint small set-sub">{t("me.discreetSub")}</span>
              </span>
              <Switch on={prefs.discreet} onChange={(v) => setPrefs({ discreet: v })} label={t("me.discreet")} />
            </div>
            <div className="set-row">
              <span>
                <Icon name="lock" size={15} /> {t("me.lock")}
                <span className="faint small set-sub">{own ? t("me.lockSub") : "Create your space to use a PIN."}</span>
              </span>
              <Switch on={!!prefs.lock} onChange={(v) => (v ? own && setPinOpen(true) : removePin())} label={t("me.lock")} />
            </div>
            {prefs.lock && (
              <div className="set-row">
                <span className="faint small">Lock again after</span>
                <select value={prefs.lock.afterMinutes} onChange={(e) => setPrefs({ lock: { ...prefs.lock!, afterMinutes: Number(e.target.value) } })} aria-label="Lock after">
                  {[0, 1, 2, 5, 15].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "Immediately" : `${m} min away`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="set-row">
              <span>
                <Icon name="bell" size={15} /> {t("me.notifications")}
              </span>
              <Switch
                on={prefs.notifications}
                onChange={async (v) => {
                  if (!v) return setPrefs({ notifications: false });
                  const ok = await enableNotifications();
                  setPrefs({ notifications: ok });
                  toast(ok ? "Notifications on" : "Notifications are blocked in your browser settings");
                }}
                label={t("me.notifications")}
              />
            </div>
            <div className="set-row">
              <span>
                <Icon name={theme === "dark" ? "moon" : "sun"} size={15} /> Appearance
              </span>
              <div className="seg">
                <button className={`seg-btn ${theme === "light" ? "on" : ""}`} onClick={() => setTheme("light")}>
                  Light
                </button>
                <button className={`seg-btn ${theme === "dark" ? "on" : ""}`} onClick={() => setTheme("dark")}>
                  Dark
                </button>
              </div>
            </div>
          </Card>

          <Card title="Your data" icon="shield">
            <div className="data-actions">
              <button
                className="btn ghost sm"
                onClick={() => {
                  const blob = new Blob([exportMySpace()], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `overeo-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
                }}
              >
                <Icon name="download" size={14} /> {t("me.export")}
              </button>
              {mode === "sample" ? (
                <button className="btn ghost sm" onClick={() => (resetSample(), toast("Maya's sample was reset — your own space is untouched"))}>
                  <Icon name="refresh" size={14} /> Reset sample
                </button>
              ) : (
                <>
                  <button className="btn ghost sm" onClick={signOut}>
                    {t("me.signout")}
                  </button>
                  <button className="btn ghost sm danger" onClick={() => setConfirmDel(true)}>
                    <Icon name="trash" size={14} /> {t("me.delete")}
                  </button>
                </>
              )}
            </div>
            <p className="faint small">Everything is stored on this device. When OVEREO accounts launch, your space can sync securely — you'll be asked first.</p>
          </Card>

          <Card title={t("me.explore")} icon="globe">
            <div className="explore">
              {[
                ["/", "Home"],
                ["/signals", "Silent Signals"],
                ["/clock", "Ovarian Clock"],
                ["/tests", "Test Navigator"],
                ["/specialties", "Specialties"],
                ["/care", "Care team"],
                ["/privacy", "Privacy"],
              ].map(([h, l]) => (
                <Link key={h} href={h} className="chip">
                  {l}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {fix && (
        <Sheet open onClose={() => setFix(null)} title="Correct what OVEREO learned">
          <textarea className="ainput" rows={3} value={fixText} onChange={(e) => setFixText(e.target.value)} aria-label="Corrected text" />
          <button
            className="btn"
            onClick={() => {
              correctMemory(fix.id, fixText.trim());
              setFix(null);
            }}
          >
            {t("common.save")}
          </button>
        </Sheet>
      )}
      {pinOpen && <PinSetup onClose={() => setPinOpen(false)} />}
      {confirmDel && (
        <Sheet open onClose={() => setConfirmDel(false)} title="Delete your space?">
          <p>This permanently removes your records, reminders, agents' memory and attached reports from this device. Maya's sample is not affected.</p>
          <button
            className="btn danger"
            onClick={() => {
              deleteMySpace();
              setConfirmDel(false);
              toast("Your space was deleted from this device");
            }}
          >
            <Icon name="trash" size={15} /> Delete everything
          </button>
        </Sheet>
      )}
    </AppPage>
  );
}

function PinSetup({ onClose }: { onClose: () => void }) {
  const [first, setFirst] = useState("");
  const [pin, setPinV] = useState("");
  const [err, setErr] = useState("");
  const key = async (k: string) => {
    const next = k === "⌫" ? pin.slice(0, -1) : (pin + k).slice(0, 6);
    setPinV(next);
    setErr("");
    if (next.length === 4 && !first) {
      setFirst(next);
      setPinV("");
    } else if (next.length === 4 && first) {
      if (next === first) {
        await setPin(next);
        toast("App lock is on");
        onClose();
      } else {
        setErr("Those didn't match — try again");
        setFirst("");
        setPinV("");
      }
    }
  };
  return (
    <Sheet open onClose={onClose} title={first ? "Confirm your PIN" : "Choose a 4-digit PIN"}>
      <div className="pin-dots" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? "on" : ""} />
        ))}
      </div>
      {err && <p className="alert-note">{err}</p>}
      <KeyPad onKey={key} />
      <p className="faint small">Your PIN never leaves this device. Forgetting it means deleting your space on this device.</p>
    </Sheet>
  );
}
