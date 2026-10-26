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
          <Icon name={s.icon} size={16} />
        </span>
        <span className="spop-t">
          <b>{s.label}</b>
          <span className={`spop-st ${st.tone}`}>{st.label}</span>
        </span>
        <span className="spop-val mono">{read.value}</span>
      </div>
      <p className="spop-what">{s.what}</p>
      <p className="spop-read">
        <span className="spop-k">SI · {d.profile.name}</span>
        {read.insight}
      </p>
      <div className="spop-foot">
        {s.source.url ? (
          <a className="spop-src" href={s.source.url} target="_blank" rel="noopener noreferrer" title={`${s.why} — ${s.source.label}`}>
            <Icon name="doc" size={12} /> <span>{s.source.label}</span>
          </a>
        ) : (
          <span className="spop-src" title={s.why}>
            <Icon name="doc" size={12} /> <span>{s.source.label}</span>
          </span>
        )}
        <button
          className="spop-btn"
          onClick={() => {
            onClose();
            openSI(s.ask);
          }}
        >
          <Icon name="sparkle" size={13} /> Ask SI
        </button>
        <Link className="spop-btn primary" href={s.href} onClick={onClose}>
          Open <Icon name="arrow" size={13} />
        </Link>
      </div>
    </div>
  );
}
