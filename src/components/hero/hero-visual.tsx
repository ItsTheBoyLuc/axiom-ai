'use client';

import { useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';
import type { GraphSeed } from './graph';

/** Canvas is a separate chunk, loaded only on the homepage and never during SSR. */
const HeroNetwork = dynamic(() => import('./hero-network'), { ssr: false });

/** False on the server and during hydration, true afterwards (no effect, no extra state). */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Renders the animated canvas unless the user prefers reduced motion (the static SVG
 * underneath then stays as the hero visual). It renders nothing until after hydration so the
 * first client render matches the server HTML whatever the user's preference is.
 */
export function HeroVisual({ seed }: { seed: GraphSeed }) {
  const reduce = useReducedMotion();
  const mounted = useHydrated();
  if (!mounted || reduce) return null;
  return <HeroNetwork seed={seed} />;
}
