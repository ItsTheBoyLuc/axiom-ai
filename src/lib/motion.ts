import type { Transition, Variants } from 'motion/react';

/**
 * Central motion system. Every animated component imports from here so the feel stays
 * consistent and can be tuned in one place. Animate only transform and opacity.
 */

/** Cubic-bezier easings. */
export const ease = {
  /** Default UI ease: fast start, gentle settle. */
  out: [0.22, 1, 0.36, 1],
  /** Symmetric, for looping or state changes. */
  inOut: [0.65, 0, 0.35, 1],
  /** Quick exit. */
  in: [0.5, 0, 0.75, 0],
} as const;

/** Durations in seconds. */
export const duration = {
  instant: 0.12,
  fast: 0.2,
  base: 0.4,
  slow: 0.7,
  counter: 1.6,
} as const;

/** Spring presets (Motion for React). */
export const spring = {
  /** Dropdowns, menus, indicator. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  /** Modals, drawers. */
  soft: { type: 'spring', stiffness: 300, damping: 30, mass: 0.9 },
  /** Card lift / hover feedback. */
  gentle: { type: 'spring', stiffness: 220, damping: 24 },
} as const satisfies Record<string, Transition>;

/** Stagger between siblings. */
export const staggerDelay = 0.07;

/** Distance in px for entrance offsets. */
export const distance = { sm: 8, md: 16, lg: 28 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: distance.md },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: duration.base, ease: ease.out } },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -distance.lg },
  show: { opacity: 1, x: 0, transition: { duration: duration.base, ease: ease.out } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: staggerDelay, delayChildren: 0.05 } },
};

/** Viewport options for scroll-triggered reveals (once, slightly before entering). */
export const viewportOnce = { once: true, margin: '0px 0px -80px 0px' } as const;

/** Card hover lift (px) and pointer throttle (ms). */
export const cardLift = 3;
export const pointerThrottleMs = 16;
