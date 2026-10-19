"use client";

import { Coverflow } from "../fx/Coverflow";
import { useDerived } from "../core/derived";
import { PHASE_META } from "../core/engines/forecast";
import { levelLabel } from "../core/engines/signals";
import { latest } from "../core/persona";
import { VideoSlot } from "../ui/VideoSlot";
import { Orb } from "../si/Orb";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * The app — a scroll-driven 3D coverflow of phone screens, each one
 * rendered live from the same profile as the rest of the page.
 * ------------------------------------------------------------------ */

type Screen = { id: string; title: string };
const SCREENS: Screen[] = [
  { id: "today", title: "Today" },
  { id: "clock", title: "Ovarian Clock" },
  { id: "si", title: "Overeo SI" },
  { id: "signals", title: "Silent Signals" },
  { id: "lens", title: "Cycle Lens" },
  { id: "dossier", title: "Dossier" },
];

export function AppScreens() {
  const d = useDerived();
  return (
    <section id="app" className="app-sec">
      <div className="wrap section-head" style={{ paddingTop: "clamp(88px, 14vh, 160px)" }}>
        <span className="eyebrow">
          <span className="dot" /> The app
        </span>
        <h2 className="title-lg">
          Everything above, <span className="serif grad-text">in her pocket.</span>
        </h2>
        <p className="lede">Scroll, swipe or use the arrow keys. Every screen is live — change her data anywhere and these change too.</p>
      </div>
      <Coverflow
        items={SCREENS}
        render={(s) => (
          <div className="phone">
            <div className="phone-notch" />
            <div className="phone-status mono">
              <span>9:41</span>
              <span>●●● ◐</span>
            </div>
            <div className="phone-body">{screen(s.id, d)}</div>
            <div className="phone-tab">
              {(["home", "clock", "sparkle", "radar", "user"] as const).map((i) => (
                <Icon key={i} name={i} size={18} />
              ))}
            </div>
          </div>
        )}
      />
      <div className="wrap film-wrap">
        <VideoSlot src="/videos/overeo-app-demo.mp4" poster="/videos/overeo-app-demo.jpg" title="The OVEREO app demo film" kicker="App demo" ratio="16 / 9" />
      </div>
    </section>
  );
}

function screen(id: string, d: ReturnType<typeof useDerived>) {
  const t = d.today;
  switch (id) {
    case "today":
      return (
        <>
          <div className="ph-h">Good morning, {d.profile.name}</div>
          <div className="ph-card" style={{ background: `${PHASE_META[t.phase].color}55` }}>
            <span className="ph-k">Cycle day</span>
            <span className="ph-big">{t.cycleDay}</span>
            <span className="ph-s">{PHASE_META[t.phase].label} · period in {t.daysUntil} d</span>
          </div>
          <div className="ph-card">
            <span className="ph-k">SI noticed</span>
            <span className="ph-s">{d.signals[0]?.title} — {d.signals[0] ? levelLabel[d.signals[0].level] : ""}</span>
          </div>
          <div className="ph-row">
            <div className="ph-mini">
              <span className="ph-k">Sleep</span>
              <b>{d.profile.logs.at(-1)!.sleep} h</b>
            </div>
            <div className="ph-mini">
              <span className="ph-k">Energy</span>
              <b>{d.profile.logs.at(-1)!.energy}</b>
            </div>
          </div>
        </>
      );
    case "clock":
      return (
        <>
          <div className="ph-h">Ovarian Clock</div>
          <div className="ph-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="7" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#phg)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${d.clock.span * 264} 264`} transform="rotate(-90 50 50)" />
              <defs>
                <linearGradient id="phg">
                  <stop offset="0" stopColor="#58364F" />
                  <stop offset="1" stopColor="#EAA6BC" />
                </linearGradient>
              </defs>
            </svg>
            <span className="ph-big">{d.clock.markerAge}</span>
          </div>
          <span className="ph-s center">{d.clock.verdict}</span>
        </>
      );
    case "si":
      return (
        <>
          <div className="ph-orb">
            <Orb state="idle" size={110} />
          </div>
          <div className="ph-bubble q">Why am I so tired?</div>
          <div className="ph-bubble a">Heavy flow in most cycles and ferritin {latest(d.profile.labs.find((l) => l.key === "ferritin")!).value}. Iron is running down.</div>
          <div className="ph-mic">
            <Icon name="mic" size={18} /> Hold to talk
          </div>
        </>
      );
    case "signals":
      return (
        <>
          <div className="ph-h">Silent Signals</div>
          {d.signals.slice(0, 4).map((s) => (
            <div key={s.id} className="ph-card slim">
              <span className="ph-s">
                <b>{s.title}</b>
              </span>
              <span className="ph-bar">
                <span style={{ width: `${s.strength * 100}%` }} />
              </span>
            </div>
          ))}
        </>
      );
    case "lens":
      return (
        <>
          <div className="ph-h">Cycle Lens</div>
          <div className="ph-strip">
            {Array.from({ length: Math.round(t.meanLength) }, (_, i) => {
              const day = i + 1;
              const L = Math.round(t.meanLength);
              const ph = day <= 5 ? "menstrual" : day < L - 15 ? "follicular" : day <= L - 13 ? "ovulatory" : "luteal";
              return <span key={i} className={day === t.cycleDay ? "on" : ""} style={{ background: PHASE_META[ph].color }} />;
            })}
          </div>
          <span className="ph-s">Next period in {t.daysUntil} days</span>
          <div className="ph-card">
            <span className="ph-k">Skin temp</span>
            <b>{d.profile.logs.at(-1)!.temp >= 0 ? "+" : ""}{d.profile.logs.at(-1)!.temp.toFixed(2)} °C</b>
            <span className="ph-s">Luteal rise — expected</span>
          </div>
        </>
      );
    default:
      return (
        <>
          <div className="ph-h">Dossier</div>
          <div className="ph-paper mono">
            <b>OVEREO</b>
            <span>{d.profile.name}, {d.profile.age}</span>
            <span>—</span>
            {d.signals.slice(0, 3).map((s) => (
              <span key={s.id}>▲ {s.title}</span>
            ))}
            <span>—</span>
            <span>Clock {d.clock.markerAge}</span>
          </div>
          <div className="ph-mic">
            <Icon name="doc" size={16} /> Send to visit
          </div>
        </>
      );
  }
}
