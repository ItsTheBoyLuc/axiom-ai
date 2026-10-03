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

- Page template (`src/app/template.tsx`): opacity 0 to 1 and y 8 px to 0, `base`, `out`.
- Hero (`hero.tsx`): staggered `fadeUp`; canvas network (`hero-network.tsx`) and GSAP scroll effect (`hero-scroll.tsx`, dynamic import, skipped for reduced motion).
- Reveal / RevealItem (`ui/reveal.tsx`): `fadeUp` when scrolled into view.
- Search suggestions (`directory/search-box.tsx`): enter opacity 0, y -6, scale 0.98 with `snappy`; exit y -4.
- Counters: `counter` duration, written straight to the DOM node.

## Phase 4 (Compare)

- Bar and radar charts (`components/charts`): Recharts draw-in, 700 ms (`animationDuration`), `ease-out`. Recharts animates SVG geometry, not CSS transforms, so this is the one place the "transform/opacity only" rule is relaxed; it is skipped content-wise for nobody (the table view is the static alternative) and the chart area is a single small SVG.
- Model picker chevron (`compare-view.tsx`): `rotate-180` on open, 150 ms CSS transition (transform only).
- The compare page uses the page template and `fadeUp` reveals already listed above; the table, rows and chips do not animate. Adding or removing a model is a URL change and a server re-render, shown with `aria-busy` rather than motion.
