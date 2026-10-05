'use client';

import { useRef } from 'react';
import { motion } from 'motion/react';
import { useReducedMode } from '@/components/layout/motion-preference-provider';
import { cardLift, pointerThrottleMs, spring } from '@/lib/motion';

/**
 * Card with a 3px hover lift, brightening border and a cursor-following spotlight.
 * Pointer updates are throttled and write CSS variables (no React re-render).
 */
export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'li';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const last = useRef(0);
  const reduce = useReducedMode();
  const MotionTag = motion[Tag];

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const now = performance.now();
    if (now - last.current < pointerThrottleMs) return;
    last.current = now;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <MotionTag
      ref={ref as React.Ref<never>}
      onPointerMove={onMove}
      whileHover={reduce ? undefined : { y: -cardLift }}
      transition={spring.gentle}
      className={`spotlight border-line bg-card hover:border-line-strong rounded-2xl border shadow-[var(--shadow-card)] transition-colors duration-200 ${className}`}
    >
      {children}
    </MotionTag>
  );
}
