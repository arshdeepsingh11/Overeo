"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Evervault-style card: a matrix of scrambled characters that tracks
 * the pointer. Hovering "decodes" the content underneath with a
 * Matrix-like reveal. A visual metaphor only — it encrypts nothing.
 * ------------------------------------------------------------------ */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=<>";
const rand = (n: number) => Array.from({ length: n }, () => CHARS[(Math.random() * CHARS.length) | 0]).join("");

export function EvervaultCard({ label, secret, children, locked }: { label: string; secret: string; children?: ReactNode; locked: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [matrix, setMatrix] = useState("");
  const [decoded, setDecoded] = useState(locked ? "•".repeat(secret.length) : secret);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    // decode / re-encode animation
    let frame = 0;
    const total = 22;
    const showPlain = hover && !locked;
    const id = setInterval(() => {
      frame++;
      const p = Math.min(1, frame / total);
      setDecoded(showPlain ? scramble(secret, 1 - p) : scramble(secret, p));
      if (frame >= total) clearInterval(id);
    }, 34);
    return () => clearInterval(id);
  }, [hover, locked, secret]);

  return (
    <div
      ref={ref}
      className={`ever glass ${hover ? "hover" : ""} ${locked ? "locked" : "open"}`}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--ex", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--ey", `${e.clientY - r.top}px`);
        setMatrix(rand(1400));
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      tabIndex={0}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="ever-matrix mono" aria-hidden="true">
        {matrix}
      </div>
      <div className="ever-core">
        <span className="ever-label">{label}</span>
        <span className="ever-secret mono" aria-label={locked ? `${label}: locked` : `${label}: ${secret}`}>
          {decoded}
        </span>
        {children}
      </div>
    </div>
  );
}

function scramble(s: string, amount: number) {
  return [...s]
    .map((c) => (c === " " || Math.random() > amount ? c : CHARS[(Math.random() * CHARS.length) | 0]))
    .join("");
}
