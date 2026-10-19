# Commit plan — platform update

Copy the zip contents into the project root (overwrite), then push these **in order** from VS Code, or run `commit-history.ps1` (PowerShell) / `commit-history.sh` (Git Bash), then **Push**.

> `COMMITS.md` and the `commit-history.*` scripts are delivery helpers — don't commit them.

## Delete these files first

- `src/OvereoApp.tsx`
- `src/fx/SphereGallery.tsx`

The scripts delete them for you (`git rm`).

## Commits

### 1. `feat(core): add route map, tab targets and navigation hooks`

Every area is a route with its own tabs; SI section ids resolve to route + tab.

- `src/core/routes.ts`

### 2. `feat(content): add ten specialty guides`

Conditions, when-to-see, red flags, care paths, FAQs and sources — modelled on NEYU specialty pages.

- `src/content/specialties.ts`

### 3. `feat(content): add BioAro, NEA and clinical test catalog`

What each test tells, what it can't, cycle timing, evidence grade and published prices.

- `src/content/tests.ts`

### 4. `feat(core): add Test Navigator recommendation engine`

Recommends only decision-changing tests: first-line before premium, reuses recent results, times to her cycle, lists tests she doesn't need and why.

- `src/core/engines/recommend.ts`

### 5. `feat(core): persist tool results, navigator answers and visit requests`

Saved per device; erase-all for privacy controls.

- `src/core/store.ts`

### 6. `refactor(core): make the command bus route-aware`

goto navigates between routes and tabs; print-dossier and run-agent wait for their page to mount.

- `src/core/bus.ts`
- `src/sections/Agent.tsx`
- `src/sections/Radar.tsx`

### 7. `feat(core): narrate the new routes in live insights`

- `src/core/insights.ts`

### 8. `feat(ui): add tab system with URL sync, keyboard and swipe`

Sticky glass tab bar with spring indicator, ?tab= sync without Suspense, sub-tabs.

- `src/ui/Tabs.tsx`

### 9. `feat(ui): add page blocks and predictive cycle calendar`

Hero, stat tiles, ask chips, callouts, four-step path, feature cards, sources, smart empty states.

- `src/ui/Page.tsx`
- `src/ui/CycleCalendar.tsx`

### 10. `feat(fx): replace sphere gallery with orbit ring`

Evenly spaced cards on a tilted orbit, front card in focus, drag with inertia and spring snap, keys and dots; sleeps off-screen.

- `src/fx/OrbitRing.tsx`
- `src/sections/Ecosystem.tsx`
- delete `src/fx/SphereGallery.tsx`

### 11. `feat(shell): move the app shell into the root layout`

Dock, Overeo SI, Space/AR and live state persist across routes.

- `src/shell/AppShell.tsx`
- `src/app/layout.tsx`
- delete `src/OvereoApp.tsx`

### 12. `feat(shell): route the dock and turn Sections into Explore`

Explore lists every area and all ten specialties.

- `src/shell/Shell.tsx`

### 13. `feat(tools): add tool kit and daily check-in`

Check-in rewrites today's entry; signals and forecast recompute instantly.

- `src/tools/ToolKit.tsx`
- `src/tools/CheckIn.tsx`

### 14. `feat(tools): add pain map and PCOS criteria check`

Mapped to NICE NG73 features and the 2023 international PCOS criteria, pre-filled from her logs.

- `src/tools/PainMap.tsx`
- `src/tools/PcosCriteria.tsx`

### 15. `feat(tools): add Menopause Rating Scale, heart and bone checks`

Validated MRS scoring; heart red flags route to 911; women-specific risk enhancers; bone scan guidance.

- `src/tools/MenopauseScale.tsx`
- `src/tools/HeartCheck.tsx`
- `src/tools/BoneCheck.tsx`

### 16. `feat(views): add tabbed page frame`

- `src/views/TabbedPage.tsx`

### 17. `feat(home): turn the home page into the hub`

Live tiles for every area, specialties strip and Test Navigator teaser; everything else moves to its own route.

- `src/views/HomeView.tsx`
- `src/app/page.tsx`
- `src/sections/Hero.tsx`

### 18. `feat(today): add Today dashboard`

Cycle ring, 7-day predictive strip, next best steps, signals, live SI insights, check-in and plan.

- `src/views/TodayView.tsx`
- `src/app/today/page.tsx`

### 19. `feat(clock): add Ovarian Clock route`

Clock, markers timeline, egg-freezing planning with sourced numbers, learn.

- `src/views/ClockView.tsx`
- `src/app/clock/page.tsx`

### 20. `feat(cycle): add Cycle route`

Lens, six-week forecast calendar, cycle-by-cycle patterns, phases.

- `src/views/CycleView.tsx`
- `src/app/cycle/page.tsx`

### 21. `feat(signals): add Silent Signals route`

Radar, how it works, and where each signal goes.

- `src/views/SignalsView.tsx`
- `src/app/signals/page.tsx`

### 22. `feat(future): add Future Self route`

Simulator, life-stage milestones and a menopause plan.

- `src/views/FutureView.tsx`
- `src/app/future/page.tsx`

### 23. `feat(specialties): add specialty index and specialty pages`

Overview, Ask SI, Conditions sub-tabs, Tests & care ranked for her, Tools & insights, Visit.

- `src/views/SpecialtyView.tsx`
- `src/app/specialties/page.tsx`
- `src/app/specialties/[slug]/page.tsx`

### 24. `feat(tests): add Test Navigator route`

For you, timing calendar, catalog with category sub-tabs, and how we recommend.

- `src/views/TestsView.tsx`
- `src/app/tests/page.tsx`

### 25. `feat(tools): add Tools route`

- `src/views/ToolsView.tsx`
- `src/app/tools/page.tsx`

### 26. `feat(care): add Care route`

Ecosystem orbit, visit planner with consent toggles, agent, directory.

- `src/views/CareView.tsx`
- `src/app/care/page.tsx`

### 27. `feat(app): add research, privacy, labs and join routes`

Evidence library, privacy controls with export and erase, 404 page.

- `src/views/MoreViews.tsx`
- `src/app/research/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/labs/page.tsx`
- `src/app/join/page.tsx`
- `src/app/not-found.tsx`

### 28. `feat(si): teach Overeo SI the platform`

Test recommendations and evaluations, conditions and FAQs from the guides, tools, specialty routing and page-aware suggestions.

- `src/si/platform.ts`
- `src/si/engine.ts`
- `src/si/OvereoSI.tsx`
- `src/si/provider.ts`

### 29. `style(platform): add platform styles and remove sphere styles`

Pages, tabs, tools, navigator, calendar, orbit ring; responsive to tablet and phone.

- `src/styles/platform.css`
- `src/app/globals.css`
- `src/styles/components.css`
- `src/styles/sections.css`

### 30. `feat(footer): link every route and specialty`

- `src/sections/Join.tsx`

### 31. `docs: document routes, tabs and Test Navigator rules`

- `README.md`
