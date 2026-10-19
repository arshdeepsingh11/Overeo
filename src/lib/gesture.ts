/* ------------------------------------------------------------------ *
 * Unified pointer gestures: drag (with velocity for inertia), pinch,
 * and wheel — for mouse, pen and touch. Returns a cleanup function.
 * ------------------------------------------------------------------ */

export interface GestureHandlers {
  onDragStart?: (x: number, y: number) => void;
  onDrag?: (dx: number, dy: number, x: number, y: number) => void;
  onDragEnd?: (vx: number, vy: number) => void;
  onPinch?: (scale: number, cx: number, cy: number) => void;
  onWheel?: (dx: number, dy: number, ctrl: boolean, e: WheelEvent) => void;
  onTap?: (x: number, y: number) => void;
}

export function attachGestures(el: HTMLElement, h: GestureHandlers, opts: { wheelPassive?: boolean } = {}) {
  const pts = new Map<number, { x: number; y: number }>();
  let last = { x: 0, y: 0, t: 0 };
  let vel = { x: 0, y: 0 };
  let startDist = 0;
  let moved = 0;
  let down = { x: 0, y: 0 };

  const dist = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const pd = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    el.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
      down = { x: e.clientX, y: e.clientY };
      vel = { x: 0, y: 0 };
      moved = 0;
      h.onDragStart?.(e.clientX, e.clientY);
    } else if (pts.size === 2) {
      startDist = dist();
    }
  };
  const pm = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && h.onPinch) {
      const d = dist();
      const [a, b] = [...pts.values()];
      if (startDist > 0) h.onPinch(d / startDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      startDist = d;
      return;
    }
    if (pts.size !== 1) return;
    const now = performance.now();
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    const dt = Math.max(1, now - last.t);
    vel = { x: 0.8 * (dx / dt) * 16 + 0.2 * vel.x, y: 0.8 * (dy / dt) * 16 + 0.2 * vel.y };
    moved += Math.abs(dx) + Math.abs(dy);
    last = { x: e.clientX, y: e.clientY, t: now };
    h.onDrag?.(dx, dy, e.clientX, e.clientY);
  };
  const pu = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) {
      if (moved < 6) h.onTap?.(down.x, down.y);
      // stale velocity if the pointer paused before release
      const idle = performance.now() - last.t > 90;
      h.onDragEnd?.(idle ? 0 : vel.x, idle ? 0 : vel.y);
    }
  };
  const wh = (e: WheelEvent) => {
    if (!h.onWheel) return;
    h.onWheel(e.deltaX, e.deltaY, e.ctrlKey || e.metaKey, e);
  };

  el.addEventListener("pointerdown", pd);
  el.addEventListener("pointermove", pm);
  el.addEventListener("pointerup", pu);
  el.addEventListener("pointercancel", pu);
  el.addEventListener("wheel", wh, { passive: opts.wheelPassive ?? false });
  return () => {
    el.removeEventListener("pointerdown", pd);
    el.removeEventListener("pointermove", pm);
    el.removeEventListener("pointerup", pu);
    el.removeEventListener("pointercancel", pu);
    el.removeEventListener("wheel", wh);
  };
}
