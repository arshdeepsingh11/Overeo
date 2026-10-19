"use client";

import { useMemo, useState } from "react";
import { useStore, saveToolResult } from "../core/store";
import { useDerived } from "../core/derived";
import { latest } from "../core/persona";
import { medianAmh } from "../core/engines/clock";
import { ToolFrame, Field, Segmented, Toggle, ResultCard } from "./ToolKit";

/* ------------------------------------------------------------------ *
 * PCOS criteria — the 2023 International Evidence-based Guideline for
 * adults: two of (1) irregular ovulation, (2) clinical or biochemical
 * hyperandrogenism, (3) polycystic ovaries on ultrasound OR raised AMH,
 * after excluding other causes. Criterion 1 is pre-filled from her own
 * cycle lengths; unknowns stay unknown and become the next tests.
 * ------------------------------------------------------------------ */

type Tri = "yes" | "no" | "unknown";
const TRI = [
  { id: "yes" as Tri, label: "Yes" },
  { id: "no" as Tri, label: "No" },
  { id: "unknown" as Tri, label: "Not sure" },
];

export function PcosCriteria() {
  const d = useDerived();
  const saved = useStore((s) => s.toolResults.pcos);
  const lengths = d.profile.cycles.map((c) => c.length).filter((x): x is number => x != null);
  const outOfRange = lengths.filter((l) => l < 21 || l > 35).length;
  const perYear = Math.round(365 / d.today.meanLength);
  const autoIrregular: Tri = outOfRange >= Math.ceil(lengths.length / 2) || perYear < 8 ? "yes" : outOfRange > 0 ? "unknown" : "no";
  const amh = d.profile.labs.find((l) => l.key === "amh");
  const amhV = amh ? latest(amh).value : null;
  const amhHigh: Tri = amhV == null ? "unknown" : amhV > medianAmh(d.profile.age) * 1.8 ? "yes" : "no";
  const tsh = d.profile.labs.find((l) => l.key === "tsh");
  const tshOk = tsh ? latest(tsh).value >= tsh.range[0] && latest(tsh).value <= tsh.range[1] : null;

  const [irregular, setIrregular] = useState<Tri>(autoIrregular);
  const [acne, setAcne] = useState(d.profile.logs.some((l) => l.acne));
  const [hirsute, setHirsute] = useState(false);
  const [alopecia, setAlopecia] = useState(false);
  const [bioAndro, setBioAndro] = useState<Tri>("unknown");
  const [us, setUs] = useState<Tri>("unknown");
  const [shown, setShown] = useState(false);

  const res = useMemo(() => {
    // acne alone is a weaker sign in the guideline; hirsutism is the main clinical feature
    const andro: Tri = hirsute || alopecia || bioAndro === "yes" ? "yes" : acne || bioAndro === "unknown" ? "unknown" : "no";
    const pcom: Tri = us === "yes" || amhHigh === "yes" ? "yes" : us === "no" ? "no" : "unknown";
    const crit = [irregular, andro, pcom];
    const met = crit.filter((c) => c === "yes").length;
    const unknown = crit.filter((c) => c === "unknown").length;
    const level: "none" | "low" | "moderate" | "high" = met >= 2 ? "high" : met === 1 && unknown ? "moderate" : unknown ? "low" : "none";
    const next: string[] = [];
    if (irregular !== "no" && andro !== "no") next.push("Androgens: total and free testosterone (SHBG) first; androstenedione and DHEA-S if normal");
    if (irregular === "yes" && andro === "yes") next.push("No ultrasound needed when cycles are irregular and androgens are high");
    else if (pcom === "unknown") next.push(amhHigh === "no" ? "Pelvic ultrasound if the other two criteria are uncertain (her AMH isn't raised)" : "Pelvic ultrasound or AMH for ovarian morphology");
    next.push(tshOk ? "Exclusions: TSH already normal ✓ — prolactin and 17-OH progesterone still to check" : "Exclusions: TSH, prolactin and 17-OH progesterone");
    if (level === "high") next.push("If PCOS is confirmed: HbA1c or glucose tolerance test, blood pressure, lipids and mood screening");
    return { crit, met, unknown, level, next };
  }, [irregular, acne, hirsute, alopecia, bioAndro, us, amhHigh, tshOk]);

  const evaluate = () => {
    setShown(true);
    saveToolResult({
      tool: "pcos",
      title: "PCOS criteria",
      summary: `${res.met} of 3 criteria met${res.unknown ? `, ${res.unknown} still unknown` : ""}.`,
      level: res.level,
      facts: { met: res.met, unknown: res.unknown, irregular, hirsute, acne },
    });
  };

  const label = (t: Tri) => (t === "yes" ? "Met" : t === "no" ? "Not met" : "Unknown");
  return (
    <ToolFrame
      icon="waves"
      title="PCOS criteria check"
      intro="The 2023 international criteria for adults, step by step. We pre-filled what your own data already shows."
      source={{ label: "International PCOS Guideline (2023)", url: "https://www.monash.edu/medicine/mchri/pcos/guideline" }}
    >
      <div className="crit-steps">
        <div className="crit glass-inner">
          <span className="crit-n">1</span>
          <Field label="Irregular cycles or ovulation" hint={`From your logs: ${lengths.length} cycles, ${Math.min(...lengths)}–${Math.max(...lengths)} days, ${outOfRange} outside 21–35 days (~${perYear} a year)`}>
            <Segmented value={irregular} options={TRI} onChange={setIrregular} label="Irregular cycles" />
          </Field>
        </div>
        <div className="crit glass-inner">
          <span className="crit-n">2</span>
          <Field label="Signs of high androgens" hint="Clinical signs, or a blood test if you've had one">
            <div className="toggle-row">
              <Toggle on={hirsute} onChange={setHirsute}>
                Excess facial / body hair
              </Toggle>
              <Toggle on={alopecia} onChange={setAlopecia}>
                Scalp hair thinning
              </Toggle>
              <Toggle on={acne} onChange={setAcne}>
                Persistent acne
              </Toggle>
            </div>
            <span className="faint small">High testosterone on a blood test?</span>
            <Segmented value={bioAndro} options={TRI} onChange={setBioAndro} label="Androgen blood test" />
          </Field>
        </div>
        <div className="crit glass-inner">
          <span className="crit-n">3</span>
          <Field label="Polycystic ovaries on ultrasound — or a raised AMH" hint={amhV != null ? `Her AMH is ${amhV} ng/mL — ${amhHigh === "yes" ? "raised for her age" : "not raised for her age, so it doesn't support this criterion"}` : "No AMH on file"}>
            <Segmented value={us} options={TRI} onChange={setUs} label="Ultrasound" />
          </Field>
        </div>
      </div>
      <div className="crit-summary" aria-live="polite">
        {["Cycles", "Androgens", "Ovaries / AMH"].map((n, i) => (
          <span key={n} className={`crit-pill ${res.crit[i]}`}>
            {n}: {label(res.crit[i])}
          </span>
        ))}
      </div>
      <div className="tool-foot">
        <button className="btn" onClick={evaluate}>
          See what this means
        </button>
        {saved && !shown && <span className="faint small">Last result: {saved.summary}</span>}
      </div>
      {shown && (
        <ResultCard
          level={res.level}
          title={res.met >= 2 ? "Meets two criteria — worth confirming" : res.met === 1 ? "One criterion met, others unknown" : res.unknown ? "Not enough information yet" : "Criteria not met"}
          summary={
            res.met >= 2
              ? "This pattern fits the PCOS criteria, pending exclusion of other causes. A clinician confirms it — and it opens the door to cycle, skin, fertility and metabolic care."
              : "PCOS needs two of three criteria after other causes are excluded. Here's what would settle it — no more, no less."
          }
          points={res.next}
          next={[
            { label: "Hormones & PCOS", href: "/specialties/hormones", icon: "waves" },
            { label: "Tests to discuss", href: "/tests", icon: "flask" },
          ]}
          ask="Could she have PCOS?"
          saved
        />
      )}
    </ToolFrame>
  );
}
