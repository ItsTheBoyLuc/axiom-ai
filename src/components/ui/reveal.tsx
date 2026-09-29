'use client';

import { motion, useReducedMotion } from 'motion/react';
import { fadeUp, reducedFade, stagger, viewportOnce } from '@/lib/motion';

/** Scroll-triggered reveal (once). Reduced motion: opacity fade only. */
export function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'ol';
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M
      variants={reduce ? reducedFade : fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={className}
    >
      {children}
    </M>
  );
}

/** Staggered group: children should be <RevealItem>. */
export function RevealGroup({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol';
}) {
  const M = motion[as];
  return (
    <M
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={className}
    >
      {children}
    </M>
  );
}

export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'li';
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M variants={reduce ? reducedFade : fadeUp} className={className}>
      {children}
    </M>
  );
}
