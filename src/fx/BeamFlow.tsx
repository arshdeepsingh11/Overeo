"use client";

import { useEffect, useRef } from "react";
import { useStore } from "../core/store";
import { useVisible } from "../lib/hooks";

/* ------------------------------------------------------------------ *
 * Beam Flow — a WebGL laser-flow shader with fbm fog turbulence,
 * directional cursor tilt and animated micro-wisp streaks. Beams
 * converge toward a focal point: scattered signals becoming one.
 * Raw WebGL (no three.js) so the hero stays light.
 * ------------------------------------------------------------------ */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uDark; uniform float uScroll;
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 r=mat2(.8,.6,-.6,.8);
  for(int i=0;i<5;i++){ v+=a*noise(p); p=r*p*2.03; a*=.5; } return v; }

void main(){
  vec2 p = (gl_FragCoord.xy - .5*uRes) / uRes.y;
  vec2 m = (uMouse - .5) * vec2(uRes.x/uRes.y, 1.);
  float t = uTime * .12;

  float ang = -0.36 + m.x * 0.22 - m.y * 0.12;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = rot * (p - vec2(0.18 + m.x * .12, -0.02 + m.y * .08));

  // turbulent fog
  vec2 fq = q * 1.5 + vec2(t * .7, -t * .35);
  float warpF = fbm(fq * 1.3 + vec2(t, -t));
  float fog = fbm(fq + warpF * 1.35);

  vec3 col = vec3(0.);
  float I = 0.;

  // focal point the beams converge to
  float conv = 1. - smoothstep(-1.25, 0.55, q.x);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float off = (fi - 2.) * 0.13 * (conv * .95 + .05) + sin(t * 1.7 + fi * 1.9) * 0.025 * conv;
    float warp = (fbm(vec2(q.x * 1.4 - t * 2.4, fi * 3.7)) - .5) * 0.16 * conv;
    float d = abs(q.y - off - warp);
    float fade = smoothstep(-1.6, -0.5, q.x) * (1. - smoothstep(0.55, 0.95, q.x));
    float core = exp(-d * d * 14000.) * 1.6;
    float halo = exp(-d * d * 260.) * 0.32;
    float wide = exp(-d * d * 24.) * 0.08;
    // micro-wisp streaks travelling along the beam
    float w = noise(vec2(q.x * 9. - uTime * (2.4 + fi * .55), fi * 11.));
    float wisp = smoothstep(.62, .98, w) * exp(-d * d * 2600.) * 1.2;
    vec3 c = mix(uC1, uC2, fi / 4.);
    float e = (core + halo + wide + wisp) * fade;
    col += c * e;
    I += e;
  }

  // the focal "hub" glow
  float hub = exp(-dot(q - vec2(0.62, 0.), q - vec2(0.62, 0.)) * 34.) * 0.9;
  col += mix(uC2, uC3, .5) * hub; I += hub;

  // fog tinted by the palette, denser near the beams
  float fogAmt = fog * fog * (0.42 + 0.5 * conv) * (uDark > .5 ? .55 : .3);
  col += mix(uC3, uC1, fog) * fogAmt; I += fogAmt;

  // cores whiten in dark mode, deepen in light mode
  vec3 C = I > 0. ? col / max(I, 1e-4) : vec3(0.);
  float hot = clamp(I - 1., 0., 1.);
  C = mix(C, uDark > .5 ? vec3(.95, .9, .92) : vec3(1.), hot * .35);

  // vignette & fade with scroll
  float vig = smoothstep(1.35, 0.25, length(p * vec2(.75, 1.05)));
  float a = clamp(I * (uDark > .5 ? .34 : .42), 0., 1.) * vig * (1. - uScroll * .9);
  // film grain
  a *= .94 + .06 * hash(gl_FragCoord.xy + uTime);
  gl_FragColor = vec4(C, a);
}`;

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function BeamFlow({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const vis = useVisible(canvas, "100px");
  const theme = useStore((s) => s.theme);
  const reduce = useStore((s) => s.reducedMotion);
  const state = useRef({ theme, vis, reduce });
  state.current = { theme, vis, reduce };

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) {
      cv.classList.add("no-webgl");
      return;
    }
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    // Single full-screen pass writing straight (non-premultiplied) colour — no blending needed.
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U("uRes"), uTime = U("uTime"), uMouse = U("uMouse"), uDark = U("uDark"), uScroll = U("uScroll");
    const uC1 = U("uC1"), uC2 = U("uC2"), uC3 = U("uC3");

    // soft effect: rendering at half resolution is invisible to the eye and 4× cheaper
    const scale = innerWidth < 760 ? 0.35 : 0.5;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(2, Math.floor(r.width * scale));
      cv.height = Math.max(2, Math.floor(r.height * scale));
      gl.viewport(0, 0, cv.width, cv.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / innerWidth;
      mouse.ty = 1 - e.clientY / innerHeight;
    };
    addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { vis: v, theme: th, reduce: rd } = state.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!v) return;
      if (!rd) t += dt;
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
      const dark = th === "dark";
      const pal = dark ? ["#B982A1", "#E8CBA8", "#8A5A77"] : ["#B982A1", "#D9B3C4", "#E8CBA8"];
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uTime, t + 3);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uDark, dark ? 1 : 0);
      gl.uniform1f(uScroll, Math.min(1, scrollY / (innerHeight * 1.1)));
      gl.uniform3fv(uC1, hex(pal[0]));
      gl.uniform3fv(uC2, hex(pal[1]));
      gl.uniform3fv(uC3, hex(pal[2]));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvas} className={`beamflow ${className ?? ""}`} aria-hidden="true" />;
}
