/**
 * Every tunable of the cinematic scroll experience (Phase 11), in one place. Each value is listed
 * in docs/MOTION.md with this file and constant name. Units: seconds for durations, pixels for
 * distances, "vh"/"%" inside ScrollTrigger strings are percentages of the viewport height.
 *
 * Only the marketing and editorial routes use this (`/`, `/about`, `/releases`, provider
 * profiles). Data-heavy routes never load any of it.
 */

/** When the engine may start. It never starts before the page has loaded and the browser is idle. */
export const startConfig = {
  /** Wait for `load`, then for an idle callback, but at most this long (ms). */
  idleTimeoutMs: 1200,
  /** The hero intro (word-by-word headline) only plays if the engine starts within this many ms of
   *  navigation start; later, replaying it would make visible text vanish and rebuild. */
  introMaxStartMs: 2600,
  /** Viewport width at or below which the simpler mobile version runs. */
  mobileMaxWidth: 768,
} as const;

/** Lenis smooth scrolling (desktop pointer devices only; touch keeps native momentum). */
export const smoothConfig = {
  duration: 1.15,
  wheelMultiplier: 1,
} as const;

/** The hero load sequence (plays once, after first paint). */
export const introConfig = {
  title: { stagger: 0.085, duration: 0.95, y: 34, blur: 12, ease: 'power3.out' },
  logo: { duration: 1.3, ease: 'power2.inOut', delay: 0.05 },
  lead: {
    duration: 0.8,
    y: 18,
    blur: 8,
    delay: 0.55,
    ease: 'power2.out',
    stagger: 0.25,
    wordStagger: 0.05,
  },
  buttons: { duration: 0.7, y: 22, stagger: 0.12, delay: 0.85, ease: 'power3.out' },
  /** The network fades in from the centre outward over this long (s). */
  networkReveal: 2.0,
} as const;

/** Scroll-scrubbed text and cards. */
export const sceneConfig = {
  /** Seconds of smoothing between scroll position and animation progress (ScrollTrigger scrub). */
  scrub: 0.7,
  /** Pin length in px per section (desktop); sections not listed use `pinDefault`. */
  pinDefault: 420,
  pin: {
    stats: 520,
    featured: 460,
    providers: 420,
    compare: 420,
    releases: 460,
    news: 420,
    cta: 480,
  } as Record<string, number>,
  /** A pinned header is held with its centre at this percentage of the viewport height. */
  pinCenter: 46,
  /** Anchor links to a pinned heading scroll to this fraction of the heading's scene (built, still pinned). */
  anchorProgress: 0.9,
  /** Un-pinned (mobile and light level) text: start and end of the build, from the viewport top. */
  textStart: 'top 86%',
  textEnd: 'top 40%',
  title: { y: 30, blur: 10, stagger: 0.18 },
  lead: { y: 20, blur: 6, stagger: 0.5, wordStagger: 0.07 },
  eyebrow: { y: 12 },
  /** Cards arrive from these offsets, in this order (index % length). */
  cardFrom: [
    { x: -90, y: 40, scale: 0.94, rotate: -1.2 },
    { x: 0, y: 90, scale: 0.92, rotate: 0 },
    { x: 90, y: 40, scale: 0.94, rotate: 1.2 },
    { x: 0, y: -50, scale: 0.96, rotate: 0 },
  ],
  /** Mobile: smaller travel, vertical only. */
  cardFromMobile: { x: 0, y: 44, scale: 0.97, rotate: 0 },
  cardStart: 'top 98%',
  cardEnd: 'top 62%',
  /** Extra start offset (% of viewport) per column so siblings arrive one after another. */
  cardStagger: 4,
  /** Hero exit: how far and how much the headline block recedes while the page scrolls on. */
  heroExit: { y: -90, scale: 1.06, blur: 8 },
  /** Counters count from 0 over the pinned scene. */
  counterEase: 'power1.out',
  /** Parallax of marked decoration/cards: pixels of travel across the viewport (desktop / mobile). */
  drift: { desktop: 36, mobile: 14 },
} as const;

/** The fixed background layer. */
export const backgroundConfig = {
  /** Cap on device pixel ratio (desktop / mobile). */
  maxDpr: { desktop: 1.5, mobile: 1 },
  /** The glows are drawn on a second canvas at this fraction of the resolution and scaled up by
   *  CSS: soft gradients lose nothing, and filling two screen-sized gradients every frame was the
   *  most expensive thing the layer did. */
  glowScale: 0.25,
  /** The glow canvas is redrawn every this many frames (it changes slowly; every redraw re-uploads a layer). */
  glowEvery: 3,
  /** Adaptive quality: when frames take longer than `slowMs` (smoothed) for `degradeAfterMs`, the layer
   *  drops a level (1: no proximity links, half the particles; 2: also no pulses or grid, glows redrawn
   *  less often); when they stay under `fastMs` for `recoverAfterMs` it climbs back. */
  adaptive: { slowMs: 24, fastMs: 15, degradeAfterMs: 1500, recoverAfterMs: 6000, maxLevel: 2 },
  /** The network always has at least this many provider and model nodes; when the data has fewer,
   *  unlabelled decorative model nodes (not links) are added so the picture stays dense. */
  minNodes: 40,
  /** Ambient particles (desktop / mobile). Provider and model nodes come from the data. */
  particles: { desktop: 110, mobile: 44 },
  /** Layers: scroll-parallax speed (1 = moves a full 'travel' while the page scrolls). */
  layerSpeed: { grid: 0.12, glow: 0.2, particles: 0.35, models: 0.7, providers: 1.1 },
  /** Total vertical travel of the fastest layer over the whole page, in normalised units (2 = one screen height). */
  parallaxTravel: 1.9,
  /** How fast the displayed section position chases the real one (1/ms time constant, ms). */
  followMs: 150,
  /** Idle drift amplitude (normalised units) and speed (rad/ms). */
  idleDrift: 0.014,
  idleSpeed: 0.00055,
  /** Glow breathing: amplitude (fraction) and speed (rad/ms). */
  breathe: 0.16,
  breatheSpeed: 0.0009,
  /** Pointer attraction radius (px), strength (0..1) and whole-scene parallax (normalised). */
  pointerRadius: 190,
  pointerPull: 0.07,
  pointerParallax: 0.035,
  /** Edges between non-structural nodes appear when closer than this (normalised). */
  linkDistance: 0.3,
  /** Light pulses travelling along structural edges (speed in edge-fractions per ms). */
  pulseSpeed: 0.00032,
  /** Hit radius for hover/click (px) and how close a label appears (px). */
  hitRadius: 18,
  labelRadius: 120,
  /** Hero weight above which hover, labels and click navigation are live. */
  interactiveAbove: 0.55,
} as const;

/** Progress bar and debug overlay. */
export const chromeConfig = {
  progressHeight: 2,
} as const;
