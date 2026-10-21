import { useId } from "react";

/* ------------------------------------------------------------------ *
 * OVEREO mark — an almost-complete cycle and the single cell it holds.
 * Flat vector with a soft tonal gradient so it reads as an icon, not a
 * photo. Colours come from --logo-a / --logo-b, so it re-tints in dark.
 * ------------------------------------------------------------------ */

export function LogoMark({ size = 24, className, title }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="6 6 52 52"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--logo-a)" />
          <stop offset="1" stopColor="var(--logo-b)" />
        </linearGradient>
        <radialGradient id={`${id}d`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="var(--logo-a)" />
          <stop offset="1" stopColor="var(--logo-b)" />
        </radialGradient>
      </defs>
      <path d="M23.62 53.52A24.5 24.5 0 1 1 51.31 45.58A5.5 5.5 0 0 1 42.64 38.81A13.5 13.5 0 1 0 27.38 43.19A5.5 5.5 0 0 1 23.62 53.52Z" fill={`url(#${id}r)`} />
      <circle cx="37.65" cy="50.21" r="6" fill={`url(#${id}d)`} />
    </svg>
  );
}

/** Mark + OVEREO wordmark. */
export function Wordmark({ big = false }: { big?: boolean }) {
  return (
    <span className={`wordmark ${big ? "big" : ""}`}>
      <LogoMark size={big ? 48 : 42} className="wm-logo" />
      OVEREO
    </span>
  );
}
