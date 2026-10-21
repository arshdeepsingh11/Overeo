"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "./Icon";
import { openSI } from "../core/store";
import { useDerived } from "../core/derived";
import { STREAMS, readStream, streamFacts, type StreamId } from "../core/streams";

/* ------------------------------------------------------------------ *
 * The card that opens under a stream in the hero strip: what it is,
 * how it gets in, her live reading, and a sourced reason it matters.
 * ------------------------------------------------------------------ */

export const STRENGTH: Record<string, { label: string; tone: string }> = {
  clear: { label: "Clear in her data", tone: "good" },
  emerging: { label: "Emerging", tone: "signal" },
  watch: { label: "Worth watching", tone: "alert" },
  info: { label: "Context", tone: "" },
};

export function StreamPop({ id, onClose }: { id: StreamId; onClose: () => void }) {
  const d = useDerived();
  const s = STREAMS[id];
  const read = useMemo(() => readStream(id, d, streamFacts(d)), [id, d]);
  const st = STRENGTH[read.strength];
  return (
    <div className="spop" style={{ ["--h" as string]: s.hue }}>
      <div className="spop-head">
        <span className="spop-ic">
          <Icon name={s.icon} size={18} />
        </span>
        <b>{s.label}</b>
        <span className="mono small spop-val">{read.value}</span>
        <button className="spop-x" onClick={onClose} aria-label="Close">
          <Icon name="close" size={14} />
        </button>
      </div>
      <p className="spop-what">{s.what}</p>
      <div className="spop-read">
        <span className="spop-k">
          <Icon name="sparkle" size={12} /> SI reads · {d.profile.name} <span className={`badge ${st.tone}`}>{st.label}</span>
        </span>
        <p>{read.insight}</p>
      </div>
      <div className="spop-why">
        <span className="spop-k">Why it matters</span>
        <p>{s.why}</p>
        {s.source.url ? (
          <a className="spop-src" href={s.source.url} target="_blank" rel="noopener noreferrer">
            {s.source.label} <Icon name="external" size={12} />
          </a>
        ) : (
          <span className="spop-src">{s.source.label}</span>
        )}
      </div>
      <p className="spop-in faint small">
        <Icon name="plus" size={12} /> {s.input}
      </p>
      <div className="spop-actions">
        <button
          className="chip"
          onClick={() => {
            onClose();
            openSI(s.ask);
          }}
        >
          <Icon name="sparkle" size={13} /> Ask SI
        </button>
        <Link className="chip" href={s.href} onClick={onClose}>
          Open {s.label} <Icon name="arrow" size={13} />
        </Link>
      </div>
    </div>
  );
}
