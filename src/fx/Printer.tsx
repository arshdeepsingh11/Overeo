"use client";

import { useEffect, useRef, useState } from "react";
import { printerSound, tearSound, tick } from "../lib/audio";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * Dossier printer — a physical thermal (POS) or A4 printer. Paper
 * emerges line by line with a little sway, the motor is synthesised
 * with Web Audio, and you can pull the paper to tear it off.
 * Monochrome by design; adapts to light and dark themes.
 * ------------------------------------------------------------------ */

export interface DossierLine {
  t: string;
  style?: "h" | "b" | "s" | "rule" | "qr" | "gap" | "c";
}

export function Printer({
  lines,
  job,
  onTorn,
  filename = "overeo-dossier.txt",
}: {
  lines: DossierLine[];
  job: number; // increment to print again
  onTorn?: () => void;
  filename?: string;
}) {
  const [mode, setMode] = useState<"thermal" | "a4">("thermal");
  const [printed, setPrinted] = useState(0);
  const [status, setStatus] = useState<"idle" | "printing" | "done" | "torn">("idle");
  const [pull, setPull] = useState(0);
  const paper = useRef<HTMLDivElement>(null);
  const stopSound = useRef<() => void>(() => {});
  const drag = useRef<{ y: number; active: boolean }>({ y: 0, active: false });

  useEffect(() => {
    if (!job) return;
    setPrinted(0);
    setStatus("printing");
    setPull(0);
    const per = mode === "thermal" ? 70 : 45;
    stopSound.current();
    stopSound.current = printerSound((lines.length * per) / 1000 + 0.2);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setPrinted(i);
      if (i >= lines.length) {
        clearInterval(id);
        setStatus("done");
      }
    }, per);
    return () => {
      clearInterval(id);
      stopSound.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, mode]);

  const download = () => {
    const txt = lines.map((l) => (l.style === "rule" ? "—".repeat(32) : l.style === "qr" ? "" : l.t)).join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const onDown = (e: React.PointerEvent) => {
    if (status !== "done") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, active: true };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const d = Math.max(0, e.clientY - drag.current.y);
    setPull(Math.min(120, d * 0.8));
  };
  const onUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (pull > 56) {
      tearSound();
      setStatus("torn");
      onTorn?.();
      setTimeout(() => {
        setPrinted(0);
        setStatus("idle");
        setPull(0);
      }, 1300);
    } else setPull(0);
  };

  const shown = lines.slice(0, printed);

  return (
    <div className={`printer ${mode}`}>
      <div className="printer-modes glass-thin" role="radiogroup" aria-label="Printer type">
        {(["thermal", "a4"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={`chip ${mode === m ? "on" : ""}`}
            onClick={() => {
              tick();
              setMode(m);
            }}
          >
            {m === "thermal" ? "Thermal" : "A4"}
          </button>
        ))}
      </div>

      <div className="printer-body" aria-hidden="true">
        <div className="printer-top">
          <span className={`printer-led ${status === "printing" ? "busy" : status === "done" ? "ok" : ""}`} />
          <span className="printer-brand mono">OVEREO · DX-{mode === "thermal" ? "80" : "A4"}</span>
          <span className="printer-grille" />
        </div>
        <div className="printer-slot" />
      </div>

      <div className="printer-paper-zone">
        <div
          ref={paper}
          className={`printer-paper mono ${status}`}
          style={{ transform: `translateY(${pull}px) rotate(${status === "printing" ? Math.sin(printed * 0.9) * 0.35 : 0}deg)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="document"
          aria-label="Printed dossier"
        >
          {shown.length === 0 && status === "idle" && <div className="pl c faint">Ready.</div>}
          {shown.map((l, i) =>
            l.style === "rule" ? (
              <div key={i} className="pl rule" />
            ) : l.style === "qr" ? (
              <QR key={i} seed={l.t} />
            ) : l.style === "gap" ? (
              <div key={i} className="pl gap" />
            ) : (
              <div key={i} className={`pl ${l.style ?? ""}`}>
                {l.t}
              </div>
            ),
          )}
          {status === "done" && mode === "thermal" && <div className="pl tear-edge" aria-hidden="true" />}
        </div>
      </div>

      <div className="printer-actions">
        {status === "done" && (
          <>
            <span className="small muted">
              <Icon name="hand" size={15} style={{ display: "inline", verticalAlign: "-3px" }} /> Pull the paper down to tear it off
            </span>
            <button className="btn ghost sm" onClick={download}>
              <Icon name="doc" size={15} /> Download .txt
            </button>
          </>
        )}
        {status === "torn" && <span className="small muted">Torn off — saved to her care-team packet.</span>}
      </div>
    </div>
  );
}

function QR({ seed }: { seed: string }) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const cells: boolean[] = [];
  for (let i = 0; i < 21 * 21; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    cells.push((h & 1) === 1);
  }
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    for (const [ox, oy] of [
      [0, 0],
      [14, 0],
      [0, 14],
    ]) {
      if (inBox(ox, oy)) {
        const dx = x - ox;
        const dy = y - oy;
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      }
    }
    return null;
  };
  return (
    <div className="pl qr" aria-label="Dossier reference code">
      <svg viewBox="0 0 21 21" width="84" height="84" shapeRendering="crispEdges">
        {cells.map((on, i) => {
          const x = i % 21;
          const y = (i / 21) | 0;
          const f = finder(x, y);
          const v = f ?? on;
          return v ? <rect key={i} x={x} y={y} width="1" height="1" fill="currentColor" /> : null;
        })}
      </svg>
    </div>
  );
}
