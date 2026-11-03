/* =====================================================================
   Small, dependency-free statistics used by OVEREO Mind.
   Everything here is pure and deterministic, so it can be unit-tested
   and gives the same answer on every device.
   ===================================================================== */

export const DAY = 86_400_000;

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function sd(xs: number[]) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  // sample standard deviation (n − 1)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

export const r1 = (x: number) => Math.round(x * 10) / 10;
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Local calendar-day key (DST-safe) — "2026-11-03". */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole calendar days a − b (DST-safe). */
export const dayDiff = (a: Date, b: Date) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / DAY);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

/** Ordinary least squares y = a + b·x. Returns null when x has no spread. */
export function linreg(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  // standard error of the slope
  const resid = ys.slice(0, n).reduce((a, y, i) => a + (y - (intercept + slope * xs[i])) ** 2, 0);
  const se = n > 2 ? Math.sqrt(resid / (n - 2) / sxx) : NaN;
  return { slope, intercept, r, n, se, sxx, mx, my };
}

/** Pearson r with a two-sided p-value (t-distribution, normal approximation for large n). */
export function correlation(xs: number[], ys: number[]) {
  const fit = linreg(xs, ys);
  if (!fit) return null;
  const { r, n } = fit;
  if (Math.abs(r) >= 1) return { r, n, p: 0 };
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  return { r, n, p: 2 * (1 - studentCdf(Math.abs(t), n - 2)) };
}

/** CDF of Student's t (via the regularised incomplete beta function). */
export function studentCdf(t: number, df: number) {
  const x = df / (df + t * t);
  const ib = incBeta(df / 2, 0.5, x);
  return t >= 0 ? 1 - ib / 2 : ib / 2;
}

function logGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function incBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betaCf(a, b, x)) / a;
  return 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

function betaCf(a: number, b: number, x: number) {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/**
 * Shrink a personal estimate toward a population prior, weighting by how
 * much of her own data there is (empirical-Bayes style). With little data
 * the answer stays near the prior; with plenty it becomes hers.
 */
export function shrink(personal: number, n: number, prior: number, priorWeight: number) {
  if (!Number.isFinite(personal) || n <= 0) return prior;
  return (personal * n + prior * priorWeight) / (n + priorWeight);
}

/** Exponentially-weighted mean (most recent last), half-life in items. */
export function ewMean(xs: number[], halfLife: number) {
  if (!xs.length) return NaN;
  const k = Math.log(2) / Math.max(0.5, halfLife);
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    const w = Math.exp(-k * (xs.length - 1 - i));
    num += w * x;
    den += w;
  });
  return num / den;
}

/** Plain-words confidence label from a 0–1 score. */
export const sureLabel = (c: number) => (c >= 0.8 ? "very sure" : c >= 0.6 ? "fairly sure" : c >= 0.4 ? "a first read" : "too early to say");
