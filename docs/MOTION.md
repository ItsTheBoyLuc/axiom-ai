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
