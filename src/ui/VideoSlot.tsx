"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useVisible } from "../lib/hooks";
import { openSI } from "../core/store";

/* ------------------------------------------------------------------ *
 * Video slot with a smart empty state.
 * Drop files into /public/videos/ with these names and they appear:
 *   overeo-brand-film.mp4   (+ optional overeo-brand-film.jpg poster)
 *   overeo-app-demo.mp4     (+ optional overeo-app-demo.jpg poster)
 * Until then a generative "film" plays and explains what goes here.
 * ------------------------------------------------------------------ */

export function VideoSlot({
  src,
  poster,
  title,
  kicker,
  ratio = "21 / 9",
  silent = false,
}: {
  src: string;
  poster?: string;
  title: string;
  kicker: string;
  ratio?: string;
  /** the file has no audio track, so there is nothing to unmute */
  silent?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const vis = useVisible(box, "120px");
  const [state, setState] = useState<"ready" | "missing">("ready");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  // Render the film straight away (poster first); if the file is missing the
  // <video> errors and we fall back to an honest empty state.
  useEffect(() => {
    const v = vid.current;
    if (!v || state !== "ready") return;
    if (vis) v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else v.pause();
  }, [vis, state]);

  return (
    <div ref={box} className="vslot glass holo" style={{ aspectRatio: ratio }}>
      {state === "ready" ? (
        <>
          <video
            ref={vid}
            className="vslot-video"
            poster={poster}
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <source src={src} type="video/mp4" />
            {/* same film as WebM for browsers without H.264; the last source erroring means none could play */}
            <source src={src.replace(/\.mp4$/, ".webm")} type="video/webm" onError={() => setState("missing")} />
          </video>
          <div className="vslot-ui">
            <span className="chip">
              <span className="eyebrow" style={{ fontSize: 11 }}>
                <span className="dot" /> {kicker}
              </span>
            </span>
            <div className="vslot-ctrls">
              <button
                className="btn ghost sm"
                onClick={() => {
                  const v = vid.current;
                  if (!v) return;
                  if (v.paused) void v.play();
                  else v.pause();
                }}
                aria-label={playing ? "Pause video" : "Play video"}
              >
                <Icon name={playing ? "pause" : "play"} size={16} /> {playing ? "Pause" : "Play"}
              </button>
              {!silent && (
                <button className="btn ghost sm" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
                  <Icon name={muted ? "mute" : "sound"} size={16} />
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="vslot-empty">
          <div className="vslot-gen" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="vslot-msg">
            <span className="badge">Film slot</span>
            <h3 className="title-md">{title}</h3>
            {(
              <p className="small muted" style={{ maxWidth: 520, margin: 0 }}>
                Add <code className="mono">{src.replace(/^\//, "public/")}</code> and it will play here automatically —
                muted, looping, and paused when you scroll away.
              </p>
            )}
            <button className="btn ghost sm" onClick={() => openSI("What will the OVEREO film show?")}>
              <Icon name="sparkle" size={16} /> Ask SI what goes here
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
