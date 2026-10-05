'use client';

import { useEffect, useRef } from 'react';
import { animate, useInView } from 'motion/react';
import { useReducedMode } from '@/components/layout/motion-preference-provider';
import { duration, ease } from '@/lib/motion';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Animated counter: counts up once when scrolled into view. The final value is rendered
 * by default (SSR / no JS / reduced motion); the animation writes straight to the DOM node
 * so there is no per-frame React re-render.
 */
export function Counter({ value, driven = false }: { value: number; driven?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });
  const reduce = useReducedMode();

  useEffect(() => {
    const node = ref.current;
    // `driven`: the cinematic engine counts it up with the scene (data-cine-count).
    if (driven || !inView || reduce || !node) return;
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
  }, [driven, inView, reduce, value]);

  return (
    <span ref={ref} className="tabular-nums" data-cine-count={driven ? value : undefined}>
      {fmt(value)}
    </span>
  );
}
