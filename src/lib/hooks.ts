import { useEffect, useRef, useState, type RefObject } from "react";
import { store } from "../core/store";

/** True once the element has come near the viewport (stays true). */
export function useNear<T extends Element>(ref: RefObject<T | null>, margin = "300px") {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);
  return near;
}

/** Live visibility (toggles), used to pause render loops off-screen. */
export function useVisible<T extends Element>(ref: RefObject<T | null>, margin = "0px") {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setVis(es[0]?.isIntersecting ?? false), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return vis;
}

/**
 * requestAnimationFrame loop that only runs while `active`.
 * The callback receives elapsed seconds and the frame delta.
 */
export function useRaf(cb: (t: number, dt: number) => void, active = true) {
  const fn = useRef(cb);
  fn.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const start = last;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fn.current((now - start) / 1000, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export function useReducedMotion() {
  const [r, setR] = useState(store.get().reducedMotion);
  useEffect(() => store.subscribe(() => setR(store.get().reducedMotion)), []);
  return r;
}

/** Critically-damped-ish spring integrator (semi-implicit Euler). */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  constructor(
    v: number,
    public stiffness = 170,
    public damping = 22,
  ) {
    this.value = v;
    this.target = v;
  }
  step(dt: number) {
    const f = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += f * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
  get settled() {
    return Math.abs(this.value - this.target) < 0.001 && Math.abs(this.velocity) < 0.001;
  }
}

/** Animate a number toward a target with a spring; returns the live value. */
export function useSpringValue(target: number, stiffness = 120, damping = 20) {
  const [v, setV] = useState(target);
  const s = useRef(new Spring(target, stiffness, damping));
  useEffect(() => {
    s.current.target = target;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      setV(s.current.step(dt));
      if (!s.current.settled) raf = requestAnimationFrame(loop);
      else setV(target);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}
