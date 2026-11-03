"use client";

import { useMemo, useState } from "react";
import { Icon } from "../../ui/Icon";
import { toast } from "../../core/store";
import { useMind } from "../../personal/mind";
import { visitSummary, visitText } from "../../personal/mind/visit";
import { diary, useSpace } from "../../personal/space";
import { AppPage, Card } from "./kit";

/* =====================================================================
   Visit summary — one printable page for her clinician.
   "Save as PDF" uses the browser's own print dialog, so nothing leaves
   her device unless she chooses to share it.
   ===================================================================== */

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function VisitScreen() {
  const m = useMind();
  const ready = useSpace((s) => s.ready);
  const account = useSpace((s) => s.account);
  const mode = useSpace((s) => s.mode);
  const [months, setMonths] = useState(6);
  const v = useMemo(() => visitSummary(m, months, account?.birthYear), [m, months, account?.birthYear]);
  const sample = mode === "sample";

  if (!ready) return <AppPage title="Visit summary">{<div className="askel" />}</AppPage>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(visitText(v, account?.name ?? "", sample));
      toast("Summary copied as text");
      diary("visit", "Copied your visit summary");
    } catch {
      toast("Copy isn't available here — use Print instead");
    }
  };
  const print = () => {
    diary("visit", "Printed or saved your visit summary");
    window.print();
  };

  return (
    <AppPage
      title="Visit summary"
      sub="One page for your clinician — from your own records."
      icon="doc"
      actions={
        <div className="visit-actions no-print">
          <div className="seg" role="radiogroup" aria-label="Period covered">
            {[3, 6, 12].map((n) => (
              <button key={n} role="radio" aria-checked={months === n} className={`seg-btn ${months === n ? "on" : ""}`} onClick={() => setMonths(n)}>
                {n} mo
              </button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={copy}>
            <Icon name="doc" size={14} /> Copy text
          </button>
          <button className="btn sm" onClick={print}>
            <Icon name="printer" size={15} /> Print / Save PDF
          </button>
        </div>
      }
    >
      <article className="visit" aria-label="Visit summary">
        <header className="visit-head">
          <div>
            <h2 className="visit-name">
              {account?.name}
              {sample && <span className="visit-sample">Sample data</span>}
            </h2>
            <p className="faint small">
              {fmt(v.from)} – {fmt(v.to)} · prepared {fmt(v.to)} · from {v.records} records she logged
            </p>
          </div>
          {v.about.length > 0 && (
            <dl className="visit-about">
              {v.about.map((x) => (
                <div key={x.label}>
                  <dt>{x.label}</dt>
                  <dd>{x.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        <section className="visit-q">
          <h3>Questions to ask</h3>
          <ol>
            {v.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>

        <div className="visit-grid">
          <Card title="Cycle" icon="cycle" className="visit-card">
            <dl className="visit-dl">
              {v.cycle.map((x) => (
                <div key={x.label}>
                  <dt>{x.label}</dt>
                  <dd>{x.value}</dd>
                </div>
              ))}
            </dl>
            {v.starts.length > 0 && <p className="faint small">Period starts in this time: {v.starts.map((d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })).join(" · ")}</p>}
          </Card>

          <Card title="Mood, sleep and vitals" icon="moon" className="visit-card">
            {v.wellbeing.length ? (
              <dl className="visit-dl">
                {v.wellbeing.map((x, i) => (
                  <div key={i}>
                    <dt>{x.label}</dt>
                    <dd>{x.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="small muted">Not enough logged yet.</p>
            )}
          </Card>
        </div>

        <Card title="Symptoms" icon="heart" className="visit-card">
          {v.symptoms.length ? (
            <div className="visit-table-wrap">
              <table className="visit-table">
                <thead>
                  <tr>
                    <th>Symptom</th>
                    <th>Entries</th>
                    <th>Avg</th>
                    <th>When</th>
                    <th>Cycles</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {v.symptoms.map((x) => (
                    <tr key={x.name}>
                      <td>{x.name}</td>
                      <td className="tnum">{x.entries}</td>
                      <td className="tnum">{x.severity}/10</td>
                      <td>{x.timing}</td>
                      <td className="tnum">{x.cycles}</td>
                      <td>{x.trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted">No symptoms logged.</p>
          )}
        </Card>

        <Card title="Lab results" icon="flask" className="visit-card">
          {v.labs.length ? (
            <div className="visit-table-wrap">
              <table className="visit-table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Latest</th>
                    <th>Range</th>
                    <th>Date</th>
                    <th>Before</th>
                  </tr>
                </thead>
                <tbody>
                  {v.labs.map((x) => (
                    <tr key={x.name} className={x.flag ? "flag" : ""}>
                      <td>
                        {x.name}
                        {x.note && <span className="faint small"> · {x.note}</span>}
                      </td>
                      <td className="tnum">
                        {x.latest} {x.flag && <span className="visit-flag">{x.flag}</span>}
                      </td>
                      <td className="tnum">{x.range}</td>
                      <td>{fmt(x.date)}</td>
                      <td className="tnum">{x.previous}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted">No lab results on file.</p>
          )}
        </Card>

        <div className="visit-grid">
          <Card title="Patterns in her data" icon="sparkle" className="visit-card">
            {v.noticed.length ? (
              <ul className="visit-list">
                {v.noticed.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No clear patterns yet.</p>
            )}
          </Card>
          <Card title="Medicines" icon="pill" className="visit-card">
            {v.meds.length ? (
              <ul className="visit-list">
                {v.meds.map((x) => (
                  <li key={x.name}>
                    <b>{x.name}</b> — {x.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">None logged.</p>
            )}
          </Card>
        </div>

        <p className="visit-foot faint small">Prepared by OVEREO from her own entries{sample ? " (sample data — not a real person)" : ""}. Educational, not a diagnosis. Values from uploaded reports were confirmed by her before use.</p>
      </article>
    </AppPage>
  );
}
