"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../ui/Icon";
import { CircularProgress } from "../../ui/Motion";
import { openSI } from "../../core/store";
import { useLearned } from "../../personal/actions";
import { useSpace, updateReminder } from "../../personal/space";
import { useT } from "../../personal/useT";
import { PHASE_META } from "../../core/engines/forecast";
import { SuggestionCard } from "./AgentsScreens";
import { AppPage, Card, fmtDate, fmtTime } from "./kit";

/* =====================================================================
   Today — her home. Who she is today (cycle day, what's coming), what
   her agents want to ask, what OVEREO has learned, and how well it
   knows her yet. Different for every woman, from the first day.
   ===================================================================== */

export const QUICK: { t: string; icon: IconName; key: "track.period" | "track.mood" | "track.symptom" | "track.sleep" | "track.temp" | "track.bp" }[] = [
  { t: "period_start", icon: "drop", key: "track.period" },
  { t: "mood", icon: "smile", key: "track.mood" },
  { t: "symptom", icon: "heart", key: "track.symptom" },
  { t: "sleep_duration", icon: "moon", key: "track.sleep" },
  { t: "morning_temperature", icon: "thermo", key: "track.temp" },
  { t: "blood_pressure", icon: "heart", key: "track.bp" },
];

export function TodayScreen() {
  const t = useT();
  const account = useSpace((s) => s.account);
  const inbox = useSpace((s) => s.inbox);
  const reminders = useSpace((s) => s.reminders);
  const discreet = useSpace((s) => s.prefs.discreet);
  const ready = useSpace((s) => s.ready);
  const l = useLearned();
  const [reveal, setReveal] = useState(!discreet);
  useEffect(() => setReveal(!discreet), [discreet]);
  const pending = inbox.filter((x) => x.status === "pending");
  const upcoming = reminders.filter((r) => !r.done).slice(0, 4);
  const c = l.cycle;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (!ready) return <AppPage title={t("nav.today")}>{<div className="askel" />}</AppPage>;

  return (
    <AppPage title={`${t("today.hello") === "Hi" ? hello : t("today.hello")}, ${account?.name ?? ""}`} sub={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}>
      <div className="today-grid">
        {/* her rhythm */}
        <Card className={`today-cycle ${reveal ? "" : "veiled"}`}>
          <button className="veil" onClick={() => setReveal(true)} aria-hidden={reveal} tabIndex={reveal ? -1 : 0}>
            <Icon name="eyeoff" size={16} /> Tap to show
          </button>
          {c.day && c.avg ? (
            <div className="cyc">
              <CircularProgress value={Math.min(c.day, c.avg)} max={c.avg} size={132} stroke={10} gradientId="today-cyc">
                <div className="cyc-n tnum">{c.day}</div>
                <div className="cyc-l">{t("today.day")}</div>
              </CircularProgress>
              <div className="cyc-info">
                {c.phase && (
                  <span className="cyc-phase">
                    <span className="dot" /> {PHASE_META[c.phase].label}
                  </span>
                )}
                {c.daysUntil != null && (
                  <span className="cyc-next">
                    {t("today.nextPeriod")} <b>{c.daysUntil >= 0 ? t("today.inDays", { n: c.daysUntil }) : `${-c.daysUntil} days late`}</b>
                    {c.nextStart && <span className="faint small"> · {fmtDate(c.nextStart, { month: "short", day: "numeric" })}</span>}
                  </span>
                )}
                <span className="faint small">
                  {c.needed > 0 ? `Using ${c.lengths.length ? "your cycles so far" : "your estimate"} — ${c.needed} more cycle${c.needed === 1 ? "" : "s"} to make this fully yours.` : `Based on your last ${Math.min(6, c.lengths.length)} cycles (avg ${c.avg} d${c.sd ? `, ±${c.sd}` : ""}).`}
                </span>
              </div>
            </div>
          ) : (
            <div className="cyc-empty">
              <Icon name="drop" size={20} />
              <span>
                <b>When did your last period start?</b>
                <span className="faint small">That one date is enough to start.</span>
              </span>
              <Link className="btn sm" href="/app/track?t=period_start">
                Add it
              </Link>
            </div>
          )}
        </Card>

        {/* learning ring */}
        <Card className="today-know">
          <div className="know">
            <CircularProgress value={l.progress.score} size={96} stroke={8} gradientId="today-know">
              <div className="know-n tnum">{l.progress.score}%</div>
            </CircularProgress>
            <div className="know-info">
              <b>{t("today.learning")}</b>
              <p className="small muted">{l.progress.next}</p>
              <ul className="know-steps">
                {l.progress.steps.map((s) => (
                  <li key={s.label} className={s.done ? "on" : ""}>
                    <Icon name={s.done ? "check" : "plus"} size={11} /> {s.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* quick log */}
        <Card className="today-quick" title={t("today.quickLog")} icon="plus">
          <div className="qlog">
            {QUICK.map((q) => (
              <Link key={q.t} href={`/app/track?t=${q.t}`} className="qlog-b">
                <Icon name={q.icon} size={20} />
                <span>{t(q.key)}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* inbox */}
        <div className="today-inbox">
          <div className="sec-h">
            <b>
              {t("today.inbox")} {pending.length > 0 && <span className="count">{pending.length}</span>}
            </b>
            <Link href="/app/inbox" className="sec-link">
              {t("inbox.title")} <Icon name="arrow" size={13} />
            </Link>
          </div>
          {pending.length ? (
            <div className="sg-list">
              {pending.slice(0, 2).map((s) => (
                <SuggestionCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <p className="faint small pad">{t("today.nothing")}</p>
          )}
        </div>

        {/* learned */}
        <Card className="today-learned" title={t("today.learned")} icon="sparkle" action={<Link href="/app/me" className="sec-link">All <Icon name="arrow" size={13} /></Link>}>
          {l.memory.filter((m) => m.kind !== "told").length ? (
            <ul className="learned">
              {l.memory
                .filter((m) => m.kind !== "told")
                .slice(0, 4)
                .map((m) => (
                  <li key={m.id}>
                    <span className="conf" style={{ ["--c" as string]: m.confidence }} title={`${Math.round(m.confidence * 100)}% sure`} />
                    <span>
                      {m.text}
                      <span className="faint small"> · {m.evidence}</span>
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="small muted">Nothing yet — patterns appear after a couple of weeks of check-ins. I only say what your data actually shows.</p>
          )}
          <button className="chip" onClick={() => openSI("What have you learned about me so far?")}>
            <Icon name="sparkle" size={13} /> Ask SI about my patterns
          </button>
        </Card>

        {/* reminders */}
        <Card className="today-rem" title={t("today.reminders")} icon="bell">
          {upcoming.length ? (
            <ul className="arows">
              {upcoming.map((r) => (
                <li key={r.id}>
                  <button className="tick" onClick={() => updateReminder(r.id, { done: true })} aria-label={`Mark ${r.title} done`}>
                    <Icon name="check" size={12} />
                  </button>
                  <span className="arow-main">
                    {r.title}
                    <span className="faint small"> · {fmtDate(r.due, { month: "short", day: "numeric" })} {fmtTime(r.due)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No reminders. Agents will offer them — you approve.</p>
          )}
        </Card>

        {/* recap teaser */}
        <Link href="/app/recap" className="acard today-recap">
          <span className="recap-ic">
            <Icon name="play" size={16} />
          </span>
          <span>
            <b>{t("today.recap")}</b>
            <span className="faint small">
              {l.week.daysLogged} days logged · {l.week.entries} entries{l.week.moodAvg != null ? ` · mood ${l.week.moodAvg}/5` : ""}
            </span>
          </span>
          <Icon name="chevron" size={16} />
        </Link>
      </div>
    </AppPage>
  );
}
