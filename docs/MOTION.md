# Motion values

Running list of every motion value in the product, kept current so it can be tuned in one place. Source of truth: `src/lib/motion.ts`. Only `transform` and `opacity` are animated. Reduced motion is applied globally by `MotionProvider` (`reducedMotion="user"`): transform and layout animations are skipped, opacity fades stay, and CSS transitions are capped at 0.12 s (`globals.css`).

## Easings (cubic-bezier)

| Name    | Value              | Use                                 |
| ------- | ------------------ | ----------------------------------- |
| `out`   | `0.22, 1, 0.36, 1` | Default UI ease: fast start, settle |
| `inOut` | `0.65, 0, 0.35, 1` | Looping or state changes            |
| `in`    | `0.5, 0, 0.75, 0`  | Quick exits                         |

## Durations (seconds)

| Name      | Value | Use                      |
| --------- | ----- | ------------------------ |
| `instant` | 0.12  | Hover/press feedback     |
| `fast`    | 0.20  | Small state changes      |
| `base`    | 0.40  | Entrances, page template |
| `slow`    | 0.70  | Large reveals            |
| `counter` | 1.60  | Stat counters            |

## Springs

| Name     | stiffness | damping | mass | Use                           |
| -------- | --------- | ------- | ---- | ----------------------------- |
| `snappy` | 520       | 34      | 0.7  | Dropdowns, menus, suggestions |
| `soft`   | 300       | 30      | 0.9  | Modals, drawers               |
| `gentle` | 220       | 24      | n/a  | Card lift / hover             |

## Offsets and stagger

| Name                | Value                                  |
| ------------------- | -------------------------------------- |
| `distance.sm/md/lg` | 8 / 16 / 28 px                         |
| `staggerDelay`      | 0.07 s between siblings (+0.05 s lead) |
| `cardLift`          | 3 px hover lift                        |
| `pointerThrottleMs` | 16 ms                                  |
| `viewportOnce`      | once, margin `0 0 -80px 0`             |

## Variants

| Name      | hidden                | show                              |
| --------- | --------------------- | --------------------------------- |
| `fadeUp`  | opacity 0, y 16       | opacity 1, y 0, `base`, `out`     |
| `scaleIn` | opacity 0, scale 0.96 | opacity 1, scale 1, `base`, `out` |
| `slideIn` | opacity 0, x -28      | opacity 1, x 0, `base`, `out`     |

## Where used (Phases 1-3)

- Page template (`src/app/template.tsx`): opacity 0 to 1 and y 8 px to 0, `base`, `out` (client-side navigations only since Phase 10, see the end of this file).
- Hero (`hero.tsx`): staggered `fadeUp`; canvas network (`hero-network.tsx`) and GSAP scroll effect (`hero-scroll.tsx`, dynamic import, skipped for reduced motion).
- Reveal / RevealItem (`ui/reveal.tsx`): `fadeUp` when scrolled into view.
- Search suggestions (`directory/search-box.tsx`): enter opacity 0, y -6, scale 0.98 with `snappy`; exit y -4.
- Counters: `counter` duration, written straight to the DOM node.

## Phase 4 (Compare)

- Bar and radar charts (`components/charts`): Recharts draw-in, 700 ms (`animationDuration`), `ease-out`. Recharts animates SVG geometry, not CSS transforms, so this is the one place the "transform/opacity only" rule is relaxed; it is skipped content-wise for nobody (the table view is the static alternative) and the chart area is a single small SVG.
- Model picker chevron (`compare-view.tsx`): `rotate-180` on open, 150 ms CSS transition (transform only).
- The compare page uses the page template and `fadeUp` reveals already listed above; the table, rows and chips do not animate. Adding or removing a model is a URL change and a server re-render, shown with `aria-busy` rather than motion.

## Phase 5 (Benchmarks)

- Score-over-time, distribution and provider dot charts (`components/charts`): Recharts draw-in, 700 ms (`animationDuration`), `ease-out`, the same value as the Phase 4 charts; the table view is the static alternative. Series differ by colour, dash and marker shape, so nothing depends on motion or colour.
- The explorer index and filters have no motion of their own beyond the page template and the card hover border colour (150 ms colour transition, no transform). Filter changes are URL replacements with `aria-busy`, not animations.

## Phase 6 (Providers and releases): GSAP scroll effects on `/releases`

`src/components/releases/timeline-scroll.tsx`; GSAP and ScrollTrigger are imported dynamically (only this route's chunk); everything is skipped under `prefers-reduced-motion`, and without JavaScript the timeline is simply visible.

| Effect                    | Values                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Entry rise (each release) | `opacity 0 -> 1`, `y 28 px -> 0`, 0.6 s, `power2.out`; trigger `top 90%`, once                      |
| Timeline line draw        | accent line `scaleY 0 -> 1`, `transformOrigin: top`, scrubbed 0.4 s; from `top 70%` to `bottom 70%` |
| Provider timeline chart   | static server-rendered SVG; no motion                                                               |
| Provider card hover       | border colour only (150 ms), no transform                                                           |

Tests check that the effects run (the line's transform changes with scroll, entries reach opacity 1) and that under reduced motion nothing is hidden or transformed.

## Phase 7 (News and search)

- Command palette (`layout/command-palette.tsx`): unchanged dialog motion from Phase 1 (overlay 200 ms `out`; content spring `soft`, scale 0.97 and y -8 px in, 0.98 and -4 px out). Selection and chip changes are colour transitions only (100 ms and 150 ms). Results appear without animation so typing never feels laggy.
- News and search pages: no motion beyond the page template; filters change the URL.

## Phase 8 (Admin)

No new motion. Admin pages use the existing button press (`whileTap` scale 0.97, `spring.snappy`) and CSS colour transitions only; there are no scroll or entrance effects in the admin area.

## Phase 10 (Core Web Vitals): what changed and why

The server-rendered page must be visible as sent. Hiding content until JavaScript hydrated it made Largest Contentful Paint equal to "time to load and run the scripts" (4 to 5 s on a throttled phone).

- **Page template** (`src/app/template.tsx`): the first page load is **not** animated (`initial={false}`). Later client-side navigations still fade in (opacity 0 to 1, y 8 px to 0, `base`, `out`). Detected with a module flag that flips after mount, so the server and the first client render agree.
- **Reveal / RevealGroup** (`ui/reveal.tsx`): rendered visible on the server. After hydration, only reveals entirely **below the fold** are armed (dropped to `hidden` off screen) and animate in with `fadeUp` when scrolled to (same viewport margin, `-80px`). Reveals already on screen simply stay.
- **Home hero**: the headline and lead no longer fade; they only rise (`y` 16 px to 0, `base`, `out`). The logo mark and the buttons keep the `fadeUp` stagger.
- Tune: `distance.md` (16 px) and `duration.base` (0.40 s) in `src/lib/motion.ts` affect all of the above.

## Phase 11: the cinematic scroll experience

Applies **only** to `/` (full level) and to `/about`, `/releases` and provider profiles (light level: no pins). `/models`, `/compare`, `/benchmarks`, `/news`, `/search`, `/admin`, `/settings` and `/account` load none of it and stay calm. This overrides the "avoid excessive movement" guidance of docs/PROMPT.md section 4 and 6 for those routes only (docs/DECISIONS.md, 2026-10-05).

**Everything tunable lives in `src/components/cinematic/config.ts`** (constant names below), plus `magneticConfig` in `cinematic/magnetic.tsx` and `timelineConfig` in `releases/timeline-scroll.tsx`. Only `transform`, `opacity`, `filter` and canvas drawing are animated. Add `?debug=scroll` to `/` for a live overlay (scroll progress, active section, triggers, pins, frame statistics); it exists in development and where the server sets `ENABLE_DEBUG_OVERLAY=true`.

### How the motion setting works

Three values, stored in `localStorage['axiom-motion']` and in the account (`UserPreference.settings.motion`): **System default** (follows the OS "reduce motion" setting), **Full motion** (the full experience even if the OS asks for less), **Reduced**. An inline script sets `<html data-motion="full|reduced">` before first paint (`src/lib/motion-preference.ts`); CSS, Motion (`MotionConfig`) and the engine all read that. In reduced mode **no** GSAP, ScrollTrigger, Lenis or canvas is loaded: no pinning, no parallax, no scroll-linked effects, no smooth scrolling, no progress bar; sections below the fold fade in over 0.25 s and everything else is simply visible.

| What you have                                   | Effect                                                   |
| ----------------------------------------------- | -------------------------------------------------------- |
| OS "reduce motion" ON, setting "System default" | Reduced: static page                                     |
| OS "reduce motion" ON, setting "Full motion"    | Full experience                                          |
| OS "reduce motion" OFF, setting "Reduced"       | Reduced: static page                                     |
| Windows "Show animations in Windows" OFF        | The browser reports reduce-motion: same as the first row |

### Start-up (`startConfig`)

| Constant          | Value | Meaning                                                                                                                     |
| ----------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `idleTimeoutMs`   | 1200  | Engine starts after `load` and an idle callback, at most this long after                                                    |
| `introMaxStartMs` | 2600  | The hero intro only plays if the engine starts within this many ms of navigation start (else text would vanish and rebuild) |
| `mobileMaxWidth`  | 768   | At or below: no pins, no Lenis (touch), fewer particles, vertical-only cards                                                |

The engine builds its scenes one section per task (`yieldToMain`) so no single long task blocks the page.

### Smooth scrolling (`smoothConfig`)

`duration` 1.15 s, `wheelMultiplier` 1. Desktop pointer devices only. In-page anchor clicks scroll smoothly to where their scene is complete (`sceneConfig.anchorProgress`), honouring scroll margins.

### Hero load sequence (`introConfig`)

| Constant        | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `title`         | per-word stagger 0.085 s, 0.95 s each, rise 34 px, blur 12 px, `power3.out`                             |
| `logo`          | strokes draw in over 1.3 s (`power2.inOut`), after 0.05 s; the accent triangle fades in at 60%          |
| `lead`          | 0.8 s, rise 18 px, blur 8 px, from 0.55 s; per sentence 0.25 s (per word 0.05 s when a single sentence) |
| `buttons`       | 0.7 s, rise 22 px, stagger 0.12 s, from 0.85 s                                                          |
| `networkReveal` | the network fades in from the centre outward over 2.0 s                                                 |

### Scroll scenes (`sceneConfig`)

| Constant                                      | Value                                                                                                   | Meaning                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `scrub`                                       | 0.7 s                                                                                                   | Smoothing between scroll and animation progress                                  |
| `pin` / `pinDefault`                          | stats 520, featured 460, providers 420, compare 420, releases 460, news 420, cta 480; default 420 px    | How long each section header is held while its text builds (desktop, full level) |
| `pinCenter`                                   | 46                                                                                                      | A pinned header is held with its centre at 46% of the viewport height            |
| `anchorProgress`                              | 0.9                                                                                                     | Anchor links go to this fraction of the heading's scene                          |
| `textStart` / `textEnd`                       | `top 86%` / `top 40%`                                                                                   | Un-pinned text (mobile, light level): build range                                |
| `title`                                       | rise 30 px, blur 10 px, stagger 0.18 (timeline units)                                                   | Headline words                                                                   |
| `lead`                                        | rise 20 px, blur 6 px, stagger 0.5 sentences / 0.07 words                                               | Paragraph pieces                                                                 |
| `eyebrow`                                     | rise 12 px                                                                                              |                                                                                  |
| `cardFrom`                                    | left (-90, 40, 0.94, -1.2 deg), bottom (0, 90, 0.92), right (90, 40, 0.94, 1.2 deg), top (0, -50, 0.96) | Card arrival offsets, by index modulo 4                                          |
| `cardFromMobile`                              | y 44, scale 0.97                                                                                        | Mobile and text blocks                                                           |
| `cardStartPct` / `cardEndPct` / `cardStagger` | 98 / 62 / 4 per column                                                                                  | When cards arrive                                                                |
| `heroExit`                                    | y -90 px, scale 1.06, blur 8 px, opacity to 0                                                           | Hero headline block recedes while scrolling on (not pinned)                      |
| `counterEase`                                 | `power1.out`                                                                                            | Stats count up over the pinned scene                                             |

**Arrived at load (behaviour, not a tunable).** A scrubbed text or card scene whose start has already passed when the page opens (content in the first viewport that is not the hero) snaps to its arrived state and stops being scrubbed; scenes still below the fold stay hidden until they arrive. Without this, content at rest in the lower part of the first screen sat part way through its build (faint, blurred, failing contrast) until the visitor scrolled. It runs after the first layout refresh and again after fonts settle, only while the visitor has not scrolled. Tested at four viewport sizes in `tests/e2e/cinematic.spec.ts` ("no half-built text at rest").

### The background layer (`backgroundConfig`)

| Constant                                            | Value                                                                       | Meaning                                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `maxDpr`                                            | 1.5 desktop / 1 mobile                                                      | Canvas pixel ratio cap                                                                                                   |
| `lightLevelOpacity`                                 | 0.5                                                                         | Opacity of the whole layer on the light level (about, provider profiles, releases) so lines behind paragraphs stay quiet |
| `particles`                                         | 110 desktop / 44 mobile                                                     | Ambient layer                                                                                                            |
| `minNodes`                                          | 40                                                                          | Provider and model nodes; unlabelled decorative nodes pad a short catalogue                                              |
| `layerSpeed`                                        | grid 0.12, glow 0.2, particles 0.35, models 0.7, providers 1.1              | Scroll parallax speed per depth layer                                                                                    |
| `parallaxTravel`                                    | 1.9                                                                         | Vertical travel of the fastest layer over the whole page (2 = one screen height)                                         |
| `followMs`                                          | 150                                                                         | Time constant with which the scene chases the scroll position                                                            |
| `idleDrift` / `idleSpeed`                           | 0.014 / 0.00055                                                             | Idle drift when scrolling stops                                                                                          |
| `breathe` / `breatheSpeed`                          | 0.16 / 0.0009                                                               | Glow breathing                                                                                                           |
| `pointerRadius` / `pointerPull` / `pointerParallax` | 190 px / 0.07 / 0.035                                                       | Cursor attraction and parallax                                                                                           |
| `linkDistance`                                      | 0.3                                                                         | Proximity links between nodes                                                                                            |
| `pulseSpeed`                                        | 0.00032                                                                     | Light pulses along links                                                                                                 |
| `hitRadius` / `labelRadius` / `interactiveAbove`    | 18 px / 120 px / 0.55                                                       | Hover, label proximity, and when the hero is "live" (hover, labels, click to open)                                       |
| `glowScale` / `glowEvery`                           | 0.25 / 3                                                                    | Glows on a quarter-resolution canvas redrawn every 3rd frame                                                             |
| `adaptive`                                          | slow 24 ms, fast 15 ms, degrade after 1.5 s, recover after 6 s, max level 2 | Drops proximity links, half the particles, then pulses and grid when frames are slow                                     |

Formations (one per section, `FORMATIONS` in `cinematic/background.ts`: camera zoom/pan/rotation, two glows, grid angle and spacing, link density): hero (orbit), stats (dense core, zoom 1.5), featured (lattice), providers (ring), compare (two columns), releases (timeline spine), news (spiral), cta (convergence). Sections on other pages cycle through them.

### Other pieces

| Where                                                                  | Value                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress bar (`chromeConfig.progressHeight`)                           | 2 px, accent gradient, `scaleX` with scroll                                                                                                                                                                                                                     |
| Magnetic CTA (`magneticConfig` in `cinematic/magnetic.tsx`)            | reach 70 px, max move 9 px, ease 0.18 per frame; off in reduced mode and on touch                                                                                                                                                                               |
| Releases timeline (`timelineConfig` in `releases/timeline-scroll.tsx`) | scrub 0.5; focus range `top 88%` to `bottom 12%`; arrive 0.36 / hold 0.30 / leave 0.34; out-of-focus state: rise 34 px, blur 3.5 px, **opacity stays 1** (transparency would fail WCAG contrast for muted text); line draw `top 70%` to `bottom 70%`, scrub 0.4 |
| Page transition (`app/template.tsx`)                                   | first load not animated (Phase 10); later navigations fade and rise 6 px (`ROUTE_RISE`) over 0.20 s (`duration.fast`), shortened in Phase 11 so content is never held back; applies to every route                                                              |
| Navbar (`layout/navbar.tsx`)                                           | transparent with no border at the top; blurred glass (`bg-bg/80`, `backdrop-blur-xl`) with a hairline after 8 px of scroll; the active-link pill slides (`layoutId`, `spring.snappy`)                                                                           |
