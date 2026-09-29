'use client';

import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';

/** Canvas is a separate chunk, loaded only on the homepage and never during SSR. */
const HeroNetwork = dynamic(() => import('./hero-network'), { ssr: false });

/**
 * Renders the animated canvas unless the user prefers reduced motion (the static SVG
 * underneath then stays as the hero visual).
 */
export function HeroVisual() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return <HeroNetwork />;
}
