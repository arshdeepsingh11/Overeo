import { translateMany, type Result } from "./engine";
import { langByCode } from "./languages";

/* =====================================================================
   Whole-page translation. Walks the page's text (and placeholders,
   labels, tooltips and alt text), translates what's visible first, and
   keeps translating as the page changes (new screens, live updates).
   Turning it off puts every original word back exactly.
   Skips: code, inputs she types in, anything marked translate="no",
   ECHO's own controls, and text with no letters (numbers, symbols).
   ===================================================================== */

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "SVG", "CANVAS", "KBD", "SAMP", "MATH", "TEMPLATE", "IFRAME"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
const LETTERS = /\p{L}{2,}/u;
// brand names and agent names stay as they are
const KEEP = /^(OVEREO|Overeo SI|BioAro|BioAro Labs|NEYU|NEA|Xevyo|LUNA|VERA|SAGE|PIP|IRIS|NOOR|BLOOM|MAEVE|ORA|ECHO|AMH|FSH|LH|TSH|PCOS|BMI|HRT|PDF|OK)$/i;

type Track = { orig: string; tr: string };

export interface PageTranslator {
  stop: () => void;
  setLang: (l: string) => void;
}

export function translatePage(lang: string, on: (s: { status: "working" | "done" | "error"; r?: Result }) => void): PageTranslator {
  let target = lang;
  const texts = new Map<Text, Track>();
  const attrs = new Map<Element, Map<string, Track>>();
  const queue = new Set<Text | [Element, string]>();
  // text the app keeps changing (timers, counters) is left in English
  const churn = new WeakMap<Text, { n: number; first: number }>();
  let stopped = false;
  let timer = 0;
  let running = false;
  const html = document.documentElement;
  const prevLang = html.lang;
  html.lang = target;
  html.setAttribute("data-echo", "on");

  const skipEl = (el: Element | null): boolean => {
    for (let e = el; e; e = e.parentElement) {
      if (SKIP.has(e.tagName.toUpperCase())) return true;
      if (e.getAttribute("translate") === "no" || e.hasAttribute("data-no-translate") || (e as HTMLElement).isContentEditable) return true;
    }
    return false;
  };
  const worth = (t: string) => {
    const s = t.trim();
    return s.length > 1 && s.length < 5000 && LETTERS.test(s) && !KEEP.test(s);
  };

  function collect(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) {
      const t = root as Text;
      if (!texts.has(t) && worth(t.data) && !skipEl(t.parentElement)) queue.add(t);
      return;
    }
    if (!(root instanceof Element) || skipEl(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE ? (SKIP.has((n as Element).tagName.toUpperCase()) || (n as Element).getAttribute("translate") === "no" || (n as Element).hasAttribute("data-no-translate") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n as Text;
      if (!texts.has(t) && worth(t.data)) queue.add(t);
    }
    // labels she reads: placeholders (also on inputs), aria-labels, tooltips, alt text
    const els = [root, ...root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))];
    for (const el of els) {
      if (el.closest("[translate=no],[data-no-translate],script,style,code,pre,template")) continue;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v && worth(v) && !attrs.get(el)?.has(a)) queue.add([el, a]);
      }
    }
  }

  const visible = (n: Text | [Element, string]) => {
    const el = Array.isArray(n) ? n[0] : n.parentElement;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > -100 && r.top < innerHeight + 300 && r.width > 0;
  };

  async function flush() {
    if (stopped || running || !queue.size) return;
    running = true;
    on({ status: "working" });
    // visible text first, the rest after
    const all = [...queue].filter((n) => (Array.isArray(n) ? n[0].isConnected : n.isConnected));
    queue.clear();
    all.sort((a, b) => Number(visible(b)) - Number(visible(a)));
    const lang = target;
    let last: Result | undefined;
    for (let i = 0; i < all.length && !stopped && lang === target; i += 80) {
      const part = all.slice(i, i + 80);
      const src = part.map((n) => {
        if (Array.isArray(n)) return n[0].getAttribute(n[1]) ?? "";
        return n.data;
      });
      // translate the words, keep the spaces around them
      const core = src.map((s) => s.trim());
      const uniq = [...new Set(core)];
      const r = await translateMany(uniq, lang);
      last = r;
      if (stopped || lang !== target) break;
      const map = new Map(uniq.map((u, k) => [u, r.out[k]]));
      part.forEach((n, k) => {
        const s = src[k];
        const tr = s.replace(core[k], map.get(core[k]) ?? core[k]);
        if (Array.isArray(n)) {
          const [el, a] = n;
          const m = attrs.get(el) ?? new Map<string, Track>();
          attrs.set(el, m);
          m.set(a, { orig: s, tr });
          if (tr !== s) el.setAttribute(a, tr);
        } else {
          texts.set(n, { orig: s, tr });
          if (tr !== s) n.data = tr;
        }
      });
    }
    running = false;
    on({ status: last && last.missed && last.engine === null ? "error" : "done", r: last });
    if (queue.size) schedule();
  }
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void flush(), 220);
  };

  const mo = new MutationObserver((list) => {
    if (stopped) return;
    for (const m of list) {
      if (m.type === "characterData") {
        const t = m.target as Text;
        const tr = texts.get(t);
        if (tr && t.data === tr.tr) continue; // our own write
        // the app changed this text (a live counter, a new answer…)
        texts.delete(t);
        const c = churn.get(t) ?? { n: 0, first: Date.now() };
        c.n++;
        churn.set(t, c);
        if (c.n > 6 && Date.now() - c.first < 15_000) continue;
        if (worth(t.data) && !skipEl(t.parentElement)) queue.add(t);
      } else if (m.type === "attributes" && m.attributeName) {
        const el = m.target as Element;
        const a = m.attributeName;
        const tk = attrs.get(el)?.get(a);
        const v = el.getAttribute(a) ?? "";
        if (tk && v === tk.tr) continue;
        attrs.get(el)?.delete(a);
        if (worth(v)) queue.add([el, a]);
      } else m.addedNodes.forEach((n) => !(n instanceof Element && n.closest("[data-no-translate]")) && collect(n));
    }
    if (queue.size) schedule();
  });

  collect(document.body);
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  void flush();

  const prune = window.setInterval(() => {
    for (const t of texts.keys()) if (!t.isConnected) texts.delete(t);
    for (const e of attrs.keys()) if (!e.isConnected) attrs.delete(e);
  }, 30_000);

  function restore() {
    mo.disconnect();
    for (const [t, k] of texts) if (t.isConnected && t.data === k.tr) t.data = k.orig;
    for (const [el, m] of attrs) for (const [a, k] of m) if (el.isConnected && el.getAttribute(a) === k.tr) el.setAttribute(a, k.orig);
    texts.clear();
    attrs.clear();
  }

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      clearInterval(prune);
      restore();
      html.lang = prevLang || "en";
      html.removeAttribute("data-echo");
    },
    setLang(l: string) {
      if (l === target || !langByCode(l)) return;
      restore();
      target = l;
      html.lang = l;
      collect(document.body);
      mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
      void flush();
    },
  };
}
