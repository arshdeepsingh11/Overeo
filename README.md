# OVEREO

**Your body. Your biology. Your future.**
A women's precision-health experience with **Overeo SI** — press **O** anywhere.

Built with **Next.js (App Router) + TypeScript + React**, Three.js for 3D, GSAP for scroll motion.

> Prototype. All personal data is synthetic ("Maya", 34, Calgary). Models are illustrative, not clinical.

---

## Run it

Requires **Node.js 18.18+** (20 LTS recommended).

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
npm run typecheck
```

### Optional: live model for Overeo SI
Overeo SI answers on-device by default. For open-ended answers from a live model:

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY in .env.local, then in two terminals:
npm run si-proxy                                         # server/si-proxy.mjs on :8787
NEXT_PUBLIC_SI_ENDPOINT=http://localhost:8787/si npm run dev
```

### Films
Drop `overeo-brand-film.mp4` and `overeo-app-demo.mp4` into `public/videos/`. Until then a calm placeholder shows.

---

## How it's organised

OVEREO is a **platform with routes and tabs**, not a single page. The dock, Overeo SI,
Space/AR and the live state live in a persistent app shell, so they survive navigation.

| Route | Tabs |
|---|---|
| `/` | Hub: hero, live tiles for every area, Overeo SI, specialties, convergence, Test Navigator |
| `/today` | Overview · Check-in · Insights · Plan |
| `/clock` | Clock · Markers · Fertility planning · Learn |
| `/cycle` | Lens · Forecast · Patterns · Learn |
| `/signals` | Radar · How it works · Send to care |
| `/future` | Simulator · Milestones · Menopause plan |
| `/specialties`, `/specialties/[slug]` | 10 specialties, each: Overview · Ask SI · Conditions (sub-tabs) · Tests & care · Tools & insights · Visit |
| `/tests` | Test Navigator: For you · Timing · Catalog (category sub-tabs) · How we recommend |
| `/tools` | Check-in · Pain map · PCOS criteria · Menopause scale · Heart · Bone |
| `/care` | Ecosystem (orbit ring) · Plan a visit · Agent · Directory |
| `/research`, `/privacy`, `/labs`, `/join` | Commons/Evidence/Gap · Your data/Controls · Labs · Join/App |

Tabs sync to `?tab=` (shareable, back-button safe) and support arrow keys and swipe.

```
src/
  app/          routes (server pages read ?tab=), layout with the app shell
  shell/        AppShell (persistent), backdrop, dock + Explore sheet, keys, cursors, toasts
  views/        one view per route, built from tabbed panels
  content/      specialties.ts (10 areas, conditions, FAQs, sources) · tests.ts (BioAro, NEA, clinical)
  core/         store, routes, command bus, engines (clock, signals, forecast, futures, recommend)
  tools/        guided tools — every result saves to the profile and feeds the Test Navigator
  si/           Overeo SI — intents, platform knowledge, provider, voice, orb
  fx/ ui/       effects (orbit ring, beams, three.js) and UI primitives (tabs, page blocks, calendar)
  sections/     story sections reused inside tabs
  styles/       tokens, base, components, sections, platform
```

### Test Navigator rules
Recommends a test only when it would change a decision · first-line clinical tests before premium panels ·
reuses recent results · times every test to her predicted cycle · shows what it can't tell you ·
grades evidence (guideline-backed / established / emerging / exploratory) · lists popular tests she doesn't need, and why.
Prices only where BioAro/NEYU publish them; confirm panel contents on bioarolabs.com.

### Design rules
- **Calm Rose Quartz** palette from the original artifact; **light by default**, dark only when chosen (moon button in the dock).
- **Frosted glass** with one blur radius; no animated blur layers.
- **One navigation**: the bottom dock. Its **Explore** sheet lists every route and specialty; each page has its own tab bar.
- **Responsive**: desktop, tablet (≤1024px) and phone (≤640px).

### Performance rules
- Three.js scenes, SI, Space and AR load **only when needed**.
- Every animation loop **pauses off-screen**; the dock only animates while hovered.
- Only one pinned scroll section (Convergence on Home, tablet/desktop only).
- Tab panels render only when active; the orbit ring sleeps when off-screen.
- The first render is identical on server and client (no hydration flashes); the visitor's clock and saved theme apply right after.

### Overeo SI
| Key | Action |
|---|---|
| **O** | open SI anywhere (not while typing) |
| hold **O** | talk (Chrome, Edge, Safari) |
| **⌘/Ctrl + K** | toggle SI |
| **Esc** | close SI / leave Space or AR |

Try: "Why is she so tired?", "Explain her Ovarian Clock", "dark mode", "enter space", "print dossier", "AMH 0.9", "I'm 41".

### Wiring a backend later
- Replace `createPersona()` in `src/core/persona.ts` with real data (same `Profile` shape).
- Engines in `src/core/engines/` are pure functions — move them server-side or validate them clinically.
- **The Ovarian Clock curve is illustrative.** Replace it with a validated, assay-specific AMH nomogram before clinical use.

## Credits
Research cited on the page: Westergaard et al. (Nature Communications, 2019) · ComPaRe-Endometriosis (J Women's Health, 2026) · Mayo Clinic Proceedings (2025) · Zucker & Prendergast (Biology of Sex Differences, 2020) · WEF × McKinsey Health Institute (2024) · Columbia University Irving Medical Center · AAN 2026 abstract. Map: Natural Earth (public domain). Fonts: Hanken Grotesk, Instrument Serif, JetBrains Mono (SIL OFL).
