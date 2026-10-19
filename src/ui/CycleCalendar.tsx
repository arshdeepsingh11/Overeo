"use client";

import { useMemo } from "react";
import type { Derived } from "../core/derived";
import { addDays, daysBetween, fmtDate } from "../core/rng";
import { phaseFor, type Phase } from "../core/persona";
import { PHASE_META } from "../core/engines/forecast";

/* ------------------------------------------------------------------ *
 * Predictive cycle calendar — the next weeks drawn from her learned
 * cycle: phase per day, predicted period with its uncertainty, fertile
 * window, and any overlay windows (e.g. when a test should be drawn).
 * ------------------------------------------------------------------ */

export interface CalMarker {
  id: string;
  label: string;
  from: Date;
  to: Date;
  tone?: "accent" | "signal" | "good";
}

export function CycleCalendar({ d, days = 42, markers = [] }: { d: Derived; days?: number; markers?: CalMarker[] }) {
  const cells = useMemo(() => {
    const t = d.today;
    const start = d.profile.today;
    const len = Math.round(t.meanLength);
    const sd = Math.max(1, Math.round(t.sdLength));
    const cur = d.profile.cycles[d.profile.cycles.length - 1].start;
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(start, i);
      // day within the current or a predicted future cycle
      const since = daysBetween(cur, date);
      const cd = (since % len) + 1;
      const phase: Phase = phaseFor(cd, len);
      const toNext = daysBetween(date, t.nextStart);
      const uncertain = Math.abs(toNext) <= sd && toNext !== 0;
      const ov = Math.max(10, len - 14);
      const fertile = cd >= ov - 5 && cd <= ov + 1; // the six-day fertile window, every cycle
      const on = markers.filter((m) => date >= startOf(m.from) && date <= startOf(m.to));
      return { date, cd, phase, period: cd <= 5, uncertain, fertile, on, today: i === 0 };
    });
  }, [d, days, markers]);

  const lead = (cells[0].date.getDay() + 6) % 7; // Monday-first grid
  return (
    <div className="cal" data-noswipe>
      <div className="cal-head faint small">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="cal-grid">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} className="cal-pad" />
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            className={`cal-day ${c.period ? "period" : ""} ${c.uncertain ? "unc" : ""} ${c.fertile ? "fertile" : ""} ${c.today ? "today" : ""}`}
            style={{ ["--pc" as string]: PHASE_META[c.phase].color, ["--i" as string]: i }}
            title={`${fmtDate(c.date)} · cycle day ${c.cd} · ${PHASE_META[c.phase].label}${c.on.length ? ` · ${c.on.map((m) => m.label).join(", ")}` : ""}`}
          >
            <span className="cal-n tnum">{c.date.getDate()}</span>
            <span className="cal-cd faint tnum">d{c.cd}</span>
            {c.on.length > 0 && (
              <span className="cal-marks">
                {c.on.slice(0, 3).map((m) => (
                  <i key={m.id} className={`cal-mark ${m.tone ?? "accent"}`} />
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="cal-legend small">
        {(["menstrual", "follicular", "ovulatory", "luteal"] as Phase[]).map((p) => (
          <span key={p}>
            <i style={{ background: PHASE_META[p].color }} /> {PHASE_META[p].label}
          </span>
        ))}
        <span>
          <i className="unc-i" /> Prediction range
        </span>
        {markers.length > 0 && (
          <span>
            <i className="cal-mark accent" /> Test window
          </span>
        )}
      </div>
    </div>
  );
}

const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
