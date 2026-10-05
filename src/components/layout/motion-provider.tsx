'use client';

import { MotionConfig } from 'motion/react';
import { useMotionPreference } from './motion-preference-provider';

/**
 * One place that applies the motion setting to every Motion component: in reduced mode transform
 * and layout animations are skipped and opacity fades remain; "full" ignores the OS setting.
 * Components render the SAME markup on the server and on the first client render (no branching on
 * the preference while rendering), which keeps hydration stable. See docs/DECISIONS.md.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { preference } = useMotionPreference();
  const reducedMotion =
    preference === 'full' ? 'never' : preference === 'reduced' ? 'always' : 'user';
  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
}
