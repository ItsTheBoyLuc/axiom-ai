'use client';

import { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { duration, ease } from '@/lib/motion';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Animated counter: counts up once when scrolled into view. The final value is rendered
 * by default (SSR / no JS / reduced motion); the animation writes straight to the DOM node
 * so there is no per-frame React re-render.
 */
export function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!inView || reduce || !node) return;
    const controls = animate(0, value, {
      duration: duration.counter,
      ease: ease.out,
      onUpdate: (v) => {
        node.textContent = fmt(v);
      },
      onComplete: () => {
        node.textContent = fmt(value);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {fmt(value)}
    </span>
  );
}
