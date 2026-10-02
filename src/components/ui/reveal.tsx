'use client';

import { motion } from 'motion/react';
import { fadeUp, stagger, viewportOnce } from '@/lib/motion';

/** Scroll-triggered reveal (once). Reduced motion (fade only) is applied by MotionProvider. */
export function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'ol';
}) {
  const M = motion[as];
  return (
    <M
      variants={fadeUp}
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
  const M = motion[as];
  return (
    <M variants={fadeUp} className={className}>
      {children}
    </M>
  );
}
