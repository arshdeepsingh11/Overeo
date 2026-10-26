"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "../../ui/Icon";
import { toast } from "../../core/store";
import { addRecord, archiveRecord, attachDocument, confirmRecord, correctRecord, diary, useSpace, usable } from "../../personal/space";
import { runAgents } from "../../personal/actions";
import { useT } from "../../personal/useT";
import type { TKey } from "../../personal/i18n";
import type { AnyRecord, MeasurementType, ValueMap } from "../../personal/types";
import { AppPage, Card, KeyPad, Sheet, Stepper, fmtDate, toLocalInput } from "./kit";

/* =====================================================================
   Track — two taps for anything she wants to log. Every entry says where
   it came from; corrections keep their history; report values only
   count after she confirms them.
   ===================================================================== */

type Kind = Exclude<MeasurementType, "period_end">;

const TRACKERS: { t: Kind; icon: IconName; key: TKey; hint: string }[] = [
  { t: "period_start", icon: "drop", key: "track.period", hint: "Start, end, flow" },
  { t: "symptom", icon: "heart", key: "track.symptom", hint: "Pain, cramps, more" },
  { t: "mood", icon: "smile", key: "track.mood", hint: "One tap" },
  { t: "sleep_duration", icon: "moon", key: "track.sleep", hint: "Hours & quality" },
  { t: "blood_pressure", icon: "heart", key: "track.bp", hint: "From your cuff" },
  { t: "morning_temperature", icon: "thermo", key: "track.temp", hint: "On waking" },
  { t: "medication", icon: "pill", key: "track.meds", hint: "What you take" },
  { t: "weight", icon: "scale", key: "track.weight", hint: "Optional" },
  { t: "lab_result", icon: "flask", key: "track.lab", hint: "Ferritin, AMH…" },
];

export const LABS: { name: string; unit: string; low?: number; high?: number }[] = [
  { name: "Ferritin", unit: "ng/mL", low: 15, high: 150 },
  { name: "Hemoglobin", unit: "g/L", low: 120, high: 160 },
  { name: "AMH", unit: "ng/mL", low: 1, high: 4 },
  { name: "FSH (day 3)", unit: "IU/L", low: 3.5, high: 12.5 },
  { name: "Estradiol (day 3)", unit: "pg/mL", low: 20, high: 80 },
  { name: "Progesterone", unit: "ng/mL" },
  { name: "TSH", unit: "mIU/L", low: 0.4, high: 4 },
  { name: "Vitamin D", unit: "nmol/L", low: 75, high: 250 },
  { name: "HbA1c", unit: "%", low: 4, high: 5.9 },
  { name: "Total testosterone", unit: "nmol/L" },
  { name: "hs-CRP", unit: "mg/L", high: 2 },
  { name: "LDL cholesterol", unit: "mmol/L", high: 3.4 },
];

const SYMPTOMS = ["Cramps / pelvic pain", "Headache", "Bloating", "Breast tenderness", "Acne", "Painful bowel movements", "Pain with sex", "Hot flash", "Night sweats", "Fatigue", "Nausea", "Back pain"];
const MOODS: { score: 1 | 2 | 3 | 4 | 5; label: string; face: string }[] = [
  { score: 1, label: "Low", face: "😞" },
  { score: 2, label: "Flat", face: "😕" },
  { score: 3, label: "Okay", face: "😐" },
  { score: 4, label: "Good", face: "🙂" },
  { score: 5, label: "Great", face: "😄" },
];

const done = (msg: string) => {
  toast(msg);
  setTimeout(runAgents, 50);
};

export function TrackScreen({ initial, review }: { initial?: string; review?: boolean }) {
  const t = useT();
  const records = useSpace((s) => s.records);
  const [open, setOpen] = useState<Kind | null>((TRACKERS.find((x) => x.t === initial)?.t as Kind) ?? null);
  const [edit, setEdit] = useState<AnyRecord | null>(null);
  const [snap, setSnap] = useState<{ file: File; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const unconfirmed = records.filter((r) => r.status === "active" && r.confirmationStatus === "unconfirmed");
  const recent = useMemo(() => records.filter(usable).sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, 14), [records]);
  const [showReview, setShowReview] = useState(!!review);

  return (
    <AppPage
      title={t("track.title")}
      sub={t("track.sub")}
      icon="plus"
      actions={
        <button className="btn sm" onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={15} /> {t("track.snap")}
        </button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setSnap({ file: f, url: URL.createObjectURL(f) });
          e.target.value = "";
        }}
      />

      {unconfirmed.length > 0 && (
        <button className="review-bar" onClick={() => setShowReview(true)}>
          <Icon name="flask" size={16} /> {unconfirmed.length} value{unconfirmed.length === 1 ? "" : "s"} from a report need your confirmation <Icon name="arrow" size={14} />
        </button>
      )}

      <div className="trk-grid">
        {TRACKERS.map((x) => (
          <button key={x.t} className="trk" onClick={() => setOpen(x.t)}>
            <span className="trk-ic">
              <Icon name={x.icon} size={20} />
            </span>
            <b>{t(x.key)}</b>
            <span className="faint small">{x.hint}</span>
          </button>
        ))}
      </div>

      <Card title={t("track.recent")} icon="book" className="mt">
        {recent.length ? (
          <ul className="entries">
            {recent.map((r) => (
              <li key={r.id}>
                <span className="entry-main">
                  <b>{describe(r)}</b>
                  <span className="faint small">
                    {fmtDate(r.observedAt)} · <span className={`prov ${r.source.origin}`}>{r.source.label}</span>
                    {r.confirmationStatus === "corrected" ? " · corrected" : ""}
                  </span>
                </span>
                <button className="icon-btn" onClick={() => setEdit(r)} aria-label="Correct this entry">
                  <Icon name="edit" size={14} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => {
                    archiveRecord(r.id);
                    diary("you", "Removed an entry", describe(r));
                    done("Removed — kept in your history");
                  }}
                  aria-label="Remove this entry"
                >
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Nothing logged yet. Start with your last period date — it unlocks predictions.</p>
        )}
      </Card>

      {open && (
        <Sheet open onClose={() => setOpen(null)} title={t(TRACKERS.find((x) => x.t === open)!.key)}>
          <TrackerForm kind={open} onDone={() => setOpen(null)} />
        </Sheet>
      )}
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title="Correct this entry">
          <p className="faint small">The original stays in this entry's history — nothing is overwritten silently.</p>
          <TrackerForm kind={edit.type === "period_end" ? "period_start" : (edit.type as Kind)} record={edit} onDone={() => setEdit(null)} />
        </Sheet>
      )}
      {snap && <SnapSheet snap={snap} onClose={() => setSnap(null)} />}
      {showReview && unconfirmed.length > 0 && (
        <Sheet open onClose={() => setShowReview(false)} title="Confirm report values">
          <p className="small muted">Nothing from a report counts until you've checked it against the paper.</p>
          <ul className="entries">
            {unconfirmed.map((r) => (
              <li key={r.id}>
                <span className="entry-main">
                  <b>{describe(r)}</b>
                  <span className="faint small">{r.source.label}</span>
                </span>
                <button className="chip" onClick={() => confirmRecord(r.id, true)}>
                  <Icon name="check" size={12} /> Correct
                </button>
                <button className="chip" onClick={() => confirmRecord(r.id, false)}>
                  Wrong
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </AppPage>
  );
}

export function describe(r: AnyRecord): string {
  const v = r.value as unknown as Record<string, unknown>;
  switch (r.type) {
    case "period_start":
      return `Period started${v.flow ? ` · ${["", "light", "medium", "heavy", "very heavy"][v.flow as number]}` : ""}`;
    case "period_end":
      return "Period ended";
    case "symptom":
      return `${v.name} · ${v.severity}/10`;
    case "mood":
      return `Mood · ${v.label}`;
    case "sleep_duration":
      return `Sleep · ${Math.round(((v.minutes as number) / 60) * 10) / 10} h`;
    case "blood_pressure":
      return `BP ${v.systolic}/${v.diastolic}${v.pulse ? ` · pulse ${v.pulse}` : ""}`;
    case "morning_temperature":
      return `Temperature · ${(v.celsius as number).toFixed(2)} °C`;
    case "medication":
      return `${v.name}${v.taken ? " · taken" : ""}`;
    case "weight":
      return `Weight · ${v.kg} kg`;
    case "lab_result":
      return `${v.testName} · ${v.value} ${v.unit}`;
  }
}

/* ------------------------------ the forms ------------------------------ */

function TrackerForm({ kind, record, onDone }: { kind: Kind; record?: AnyRecord; onDone: () => void }) {
  const t = useT();
  const records = useSpace((s) => s.records);
  const [when, setWhen] = useState(record ? toLocalInput(record.observedAt) : toLocalInput(new Date().toISOString()));
  const at = () => new Date(when).toISOString();
  const save = <K extends MeasurementType>(type: K, value: ValueMap[K], label: string) => {
    if (record) {
      correctRecord(record.id, value, at());
      diary("you", "Corrected an entry", label);
      done("Corrected — the original is kept in history");
    } else {
      addRecord(type, value, { observedAt: at() });
      done(`${t("track.saved")} · ${label}`);
    }
    onDone();
  };
  const v = record?.value as unknown as Record<string, number | string> | undefined;
  const last = <K extends MeasurementType>(type: K) => records.filter((r) => r.type === type && usable(r)).sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]?.value as ValueMap[K] | undefined;

  const When = (
    <label className="when">
      <span>When</span>
      <input type="datetime-local" value={when} max={toLocalInput(new Date().toISOString())} onChange={(e) => setWhen(e.target.value)} />
    </label>
  );

  if (kind === "period_start") return <PeriodForm save={save} when={When} setWhen={setWhen} initial={(v?.flow as 1) ?? 3} isEdit={!!record} />;
  if (kind === "mood")
    return (
      <div className="form">
        <div className="moods">
          {MOODS.map((m) => (
            <button key={m.score} className={`mood ${v?.score === m.score ? "on" : ""}`} onClick={() => save("mood", { score: m.score, label: m.label }, `Mood · ${m.label}`)}>
              <span className="mood-f" aria-hidden="true">
                {m.face}
              </span>
              {m.label}
            </button>
          ))}
        </div>
        {When}
      </div>
    );
  if (kind === "symptom") return <SymptomForm save={save} when={When} initial={record ? (v as { name: string; severity: number }) : undefined} />;
  if (kind === "sleep_duration") return <NumberForm label="Hours slept" init={v ? Number(v.minutes) / 60 : (last("sleep_duration")?.minutes ?? 420) / 60} step={0.5} min={0} max={16} fmt={(x) => `${x} h`} when={When} onSave={(x) => save("sleep_duration", { minutes: Math.round(x * 60) }, `Sleep · ${x} h`)} />;
  if (kind === "morning_temperature") return <NumberForm label="Temperature on waking" init={v ? Number(v.celsius) : last("morning_temperature")?.celsius ?? 36.5} step={0.05} min={34} max={40} fmt={(x) => `${x.toFixed(2)} °C`} when={When} onSave={(x) => save("morning_temperature", { celsius: x }, `${x.toFixed(2)} °C`)} />;
  if (kind === "weight") return <NumberForm label="Weight" init={v ? Number(v.kg) : last("weight")?.kg ?? 62} step={0.1} min={25} max={250} fmt={(x) => `${x.toFixed(1)} kg`} when={When} onSave={(x) => save("weight", { kg: x }, `${x.toFixed(1)} kg`)} />;
  if (kind === "blood_pressure") return <BpForm when={When} initial={v as { systolic: number; diastolic: number; pulse?: number } | undefined} onSave={(b) => save("blood_pressure", b, `BP ${b.systolic}/${b.diastolic}`)} />;
  if (kind === "medication") return <MedForm when={When} initial={v as { name: string } | undefined} recent={[...new Set(records.filter((r) => r.type === "medication").map((r) => (r.value as { name: string }).name))]} onSave={(m) => save("medication", m, m.name)} />;
  return <LabForm when={When} initial={v as { testName: string; value: number } | undefined} onSave={(l) => save("lab_result", l, `${l.testName} ${l.value} ${l.unit}`)} />;
}

function PeriodForm({ save, when, setWhen, initial, isEdit }: { save: <K extends MeasurementType>(t: K, v: ValueMap[K], l: string) => void; when: React.ReactNode; setWhen: (s: string) => void; initial: 1 | 2 | 3 | 4; isEdit: boolean }) {
  const [flow, setFlow] = useState<1 | 2 | 3 | 4>(initial);
  const quick = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(8, 0, 0, 0);
    setWhen(toLocalInput(d.toISOString()));
  };
  return (
    <div className="form">
      {!isEdit && (
        <div className="seg">
          <button className="seg-btn" onClick={() => quick(0)}>
            Today
          </button>
          <button className="seg-btn" onClick={() => quick(1)}>
            Yesterday
          </button>
          <button className="seg-btn" onClick={() => quick(2)}>
            2 days ago
          </button>
        </div>
      )}
      {when}
      <span className="form-k">Flow</span>
      <div className="seg">
        {(["Light", "Medium", "Heavy", "Very heavy"] as const).map((l, i) => (
          <button key={l} className={`seg-btn ${flow === i + 1 ? "on" : ""}`} onClick={() => setFlow((i + 1) as 1)}>
            {l}
          </button>
        ))}
      </div>
      <button className="btn" onClick={() => save("period_start", { flow }, "Period started")}>
        <Icon name="check" size={16} /> {isEdit ? "Save correction" : "Period started"}
      </button>
      {!isEdit && (
        <button className="btn ghost" onClick={() => save("period_end", {}, "Period ended")}>
          My period ended
        </button>
      )}
    </div>
  );
}

function SymptomForm({ save, when, initial }: { save: <K extends MeasurementType>(t: K, v: ValueMap[K], l: string) => void; when: React.ReactNode; initial?: { name: string; severity: number } }) {
  const [sel, setSel] = useState<string[]>(initial ? [initial.name] : []);
  const [sev, setSev] = useState(initial?.severity ?? 5);
  return (
    <div className="form">
      <div className="chips">
        {[...new Set([...(initial ? [initial.name] : []), ...SYMPTOMS])].map((s) => (
          <button key={s} className={`chip ${sel.includes(s) ? "on" : ""}`} aria-pressed={sel.includes(s)} onClick={() => setSel((x) => (initial ? [s] : x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}>
            {s}
          </button>
        ))}
      </div>
      <span className="form-k">How strong · {sev}/10</span>
      <input type="range" className="range" min={0} max={10} value={sev} onChange={(e) => setSev(Number(e.target.value))} style={{ ["--p" as string]: `${sev * 10}%` }} aria-label="Severity" />
      {when}
      <button
        className="btn"
        disabled={!sel.length}
        onClick={() => {
          sel.slice(0, -1).forEach((name) => addRecord("symptom", { name, severity: sev }));
          save("symptom", { name: sel[sel.length - 1], severity: sev }, `${sel.join(", ")} · ${sev}/10`);
        }}
      >
        <Icon name="check" size={16} /> Save {sel.length > 1 ? `${sel.length} symptoms` : ""}
      </button>
    </div>
  );
}

function NumberForm({ label, init, step, min, max, fmt, when, onSave }: { label: string; init: number; step: number; min: number; max: number; fmt: (x: number) => string; when: React.ReactNode; onSave: (x: number) => void }) {
  const [x, setX] = useState(Math.round(init / step) * step);
  return (
    <div className="form">
      <span className="form-k">{label}</span>
      <Stepper value={x} onChange={setX} step={step} min={min} max={max} fmt={fmt} label={label} />
      {when}
      <button className="btn" onClick={() => onSave(Math.round(x * 100) / 100)}>
        <Icon name="check" size={16} /> Save
      </button>
    </div>
  );
}

function BpForm({ when, initial, onSave }: { when: React.ReactNode; initial?: { systolic: number; diastolic: number; pulse?: number }; onSave: (b: { systolic: number; diastolic: number; pulse?: number }) => void }) {
  const [f, setF] = useState<"systolic" | "diastolic" | "pulse">("systolic");
  const [vals, setVals] = useState({ systolic: initial ? String(initial.systolic) : "", diastolic: initial ? String(initial.diastolic) : "", pulse: initial?.pulse ? String(initial.pulse) : "" });
  const key = (k: string) =>
    setVals((v) => {
      const cur = v[f];
      const next = k === "⌫" ? cur.slice(0, -1) : (cur + k).slice(0, 3);
      const out = { ...v, [f]: next };
      // move on when the number is complete: 2 digits if it starts 3–9 (e.g. 95, 72), else 3 (e.g. 118)
      const complete = next.length === 3 || (next.length === 2 && Number(next[0]) >= 3);
      if (k !== "⌫" && complete && f === "systolic") setTimeout(() => setF("diastolic"));
      else if (k !== "⌫" && complete && f === "diastolic") setTimeout(() => setF("pulse"));
      return out;
    });
  const sys = Number(vals.systolic);
  const dia = Number(vals.diastolic);
  const ok = sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia;
  return (
    <div className="form">
      <div className="bp">
        {(["systolic", "diastolic", "pulse"] as const).map((k) => (
          <button key={k} className={`bp-f ${f === k ? "on" : ""}`} onClick={() => setF(k)}>
            <span>{k === "systolic" ? "Top" : k === "diastolic" ? "Bottom" : "Pulse"}</span>
            <b className="tnum">{vals[k] || "—"}</b>
          </button>
        ))}
      </div>
      <KeyPad onKey={key} />
      {sys >= 180 || dia >= 120 ? <p className="alert-note">That's very high. If you have chest pain, shortness of breath, a severe headache or vision changes, call emergency services now.</p> : null}
      {when}
      <button className="btn" disabled={!ok} onClick={() => onSave({ systolic: sys, diastolic: dia, ...(vals.pulse ? { pulse: Number(vals.pulse) } : {}) })}>
        <Icon name="check" size={16} /> Save
      </button>
    </div>
  );
}

function MedForm({ when, initial, recent, onSave }: { when: React.ReactNode; initial?: { name: string }; recent: string[]; onSave: (m: { name: string; taken: boolean }) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  return (
    <div className="form">
      <input className="ainput" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Iron, Vitamin D, the pill" aria-label="Medicine name" />
      {recent.length > 0 && (
        <div className="chips">
          {recent.map((r) => (
            <button key={r} className="chip" onClick={() => setName(r)}>
              {r}
            </button>
          ))}
        </div>
      )}
      <p className="faint small">OVEREO never suggests doses — that stays with your prescriber.</p>
      {when}
      <button className="btn" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), taken: true })}>
        <Icon name="check" size={16} /> Taken
      </button>
    </div>
  );
}

function LabForm({ when, initial, onSave }: { when: React.ReactNode; initial?: { testName: string; value: number }; onSave: (l: ValueMap["lab_result"]) => void }) {
  const [test, setTest] = useState(initial?.testName ?? LABS[0].name);
  const [val, setVal] = useState(initial ? String(initial.value) : "");
  const def = LABS.find((l) => l.name === test);
  const [unit, setUnit] = useState(def?.unit ?? "");
  useEffect(() => setUnit(LABS.find((l) => l.name === test)?.unit ?? unit), [test]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Number(val.replace(",", "."));
  return (
    <div className="form">
      <label className="when">
        <span>Test</span>
        <select value={test} onChange={(e) => setTest(e.target.value)}>
          {[...new Set([...(initial ? [initial.testName] : []), ...LABS.map((l) => l.name)])].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <div className="lab-row">
        <input className="ainput" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Value" aria-label="Value" />
        <input className="ainput unit" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" />
      </div>
      {def && (def.low != null || def.high != null) && (
        <p className="faint small">
          Typical range {def.low ?? "—"}–{def.high ?? "—"} {def.unit}. Use the range printed on your report if it differs.
        </p>
      )}
      {when}
      <button className="btn" disabled={!val || isNaN(n)} onClick={() => onSave({ testName: test, value: n, unit, low: def?.low, high: def?.high })}>
        <Icon name="check" size={16} /> Save
      </button>
    </div>
  );
}

/* ----------------------------- Snap a report ----------------------------- */

function SnapSheet({ snap, onClose }: { snap: { file: File; url: string }; onClose: () => void }) {
  const [rows, setRows] = useState<{ test: string; value: string; unit: string }[]>([{ test: "Ferritin", value: "", unit: "ng/mL" }]);
  const [date, setDate] = useState(toLocalInput(new Date().toISOString()).slice(0, 10));
  const [saving, setSaving] = useState(false);
  const isPdf = snap.file.type === "application/pdf";
  const valid = rows.filter((r) => r.value && !isNaN(Number(r.value.replace(",", "."))));
  const save = async () => {
    setSaving(true);
    const docId = await attachDocument(snap.file);
    for (const r of valid) {
      const def = LABS.find((l) => l.name === r.test);
      addRecord("lab_result", { testName: r.test, value: Number(r.value.replace(",", ".")), unit: r.unit, low: def?.low, high: def?.high }, { observedAt: new Date(`${date}T09:00`).toISOString(), origin: "uploaded_document", documentId: docId, confirmed: true });
    }
    diary("you", "Added a lab report", `${valid.length} value${valid.length === 1 ? "" : "s"} · ${snap.file.name}`);
    done(`Saved ${valid.length} value${valid.length === 1 ? "" : "s"} with the report attached`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Add values from your report">
      <div className="snap">
        <div className="snap-img">{isPdf ? <span className="snap-pdf"><Icon name="doc" size={28} /> {snap.file.name}</span> : <img src={snap.url} alt="Your report" />}</div>
        <div className="snap-form">
          <p className="faint small">
            Type each value as it's printed. The photo stays attached as the source, on this device. <b>Automatic reading is coming</b> — it will read the report for you and still ask you to confirm each value.
          </p>
          <label className="when">
            <span>Collected on</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {rows.map((r, i) => (
            <div key={i} className="lab-row">
              <select
                value={r.test}
                onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, test: e.target.value, unit: LABS.find((l) => l.name === e.target.value)?.unit ?? y.unit } : y)))}
                aria-label="Test"
              >
                {LABS.map((l) => (
                  <option key={l.name}>{l.name}</option>
                ))}
              </select>
              <input className="ainput" inputMode="decimal" placeholder="Value" value={r.value} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} aria-label="Value" />
              <input className="ainput unit" value={r.unit} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, unit: e.target.value } : y)))} aria-label="Unit" />
            </div>
          ))}
          <button className="chip" onClick={() => setRows((x) => [...x, { test: "Vitamin D", value: "", unit: "nmol/L" }])}>
            <Icon name="plus" size={12} /> Another value
          </button>
          <button className="btn" disabled={!valid.length || saving} onClick={save}>
            <Icon name="check" size={16} /> I checked these — save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
