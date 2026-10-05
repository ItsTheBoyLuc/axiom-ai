'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { motion } from 'motion/react';
import { fadeUp, stagger, viewportOnce } from '@/lib/motion';

/**
 * Scroll-triggered reveals, without hiding what the visitor is already looking at.
 *
 * The server renders every reveal VISIBLE, so the first screen paints as soon as the HTML and CSS
 * arrive instead of waiting for JavaScript (a hidden-until-hydrated first screen made Largest
 * Contentful Paint equal to the time it takes to load and run the scripts). After hydration, a
 * reveal that sits entirely below the fold is "armed": it drops to the hidden state (off screen, so
 * nobody sees it happen) and animates in when scrolled to. Reveals that are already on screen
 * stay as they are.
 *
 * Reduced motion (fade only) is applied by MotionProvider; nothing here branches on it, so the
 * server and the first client render always agree.
 */
function useArmed(ref: RefObject<HTMLElement | null>) {
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().top >= window.innerHeight) setArmed(true);
  }, [ref]);
  return armed;
}

/** Props that make a `motion` element reveal on scroll once armed, and stay visible until then. */
function revealProps(armed: boolean) {
  return {
    initial: false as const,
    animate: armed ? 'hidden' : 'show',
    whileInView: armed ? 'show' : undefined,
    viewport: viewportOnce,
  };
}

/** Scroll-triggered reveal (once). */
export function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'ol';
}) {
  const M = motion[as] as typeof motion.div;
  const ref = useRef<HTMLDivElement>(null);
  const armed = useArmed(ref);
  return (
    <M ref={ref} variants={fadeUp} {...revealProps(armed)} className={className}>
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
  const M = motion[as] as typeof motion.div;
  const ref = useRef<HTMLDivElement>(null);
  const armed = useArmed(ref);
  return (
    <M ref={ref} variants={stagger} {...revealProps(armed)} className={className}>
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
