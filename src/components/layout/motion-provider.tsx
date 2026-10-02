'use client';

import { MotionConfig } from 'motion/react';

/**
 * One place that honours prefers-reduced-motion for every Motion component: transform and layout
 * animations are skipped for those users and opacity fades remain. Components render the SAME
 * markup on the server and on the first client render (no branching on the preference while
 * rendering), which keeps hydration stable. See docs/DECISIONS.md.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
