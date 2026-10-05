'use client';

import { useEffect, useRef } from 'react';
import { useMotionPreference } from '@/components/layout/motion-preference-provider';

/** Pointer-following hover for primary calls to action (full motion only). */
export const magneticConfig = {
  /** How far (px) from the element's edge the pull begins. */
  reach: 70,
  /** Maximum displacement (px) of the element and of its content (the arrow rides further). */
  maxMove: 9,
  /** Fraction of the remaining distance closed per frame (0..1). */
  ease: 0.18,
} as const;

/**
 * Wraps a control so it leans toward the pointer when the pointer is near it, and settles back
 * when it leaves. Transform only (written to the element's style by script, so it is allowed
 * under the strict CSP). Disabled in reduced-motion mode and on touch devices; the wrapped
 * control is otherwise completely unchanged and stays fully keyboard and screen-reader operable.
 */
export function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { mode } = useMotionPreference();

  useEffect(() => {
    const el = ref.current;
    if (!el || mode === 'reduced' || window.matchMedia('(pointer: coarse)').matches) return;
    const cfg = magneticConfig;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;

    const loop = () => {
      x += (tx - x) * cfg.ease;
      y += (ty - y) * cfg.ease;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const nearX = Math.max(0, Math.abs(dx) - r.width / 2);
      const nearY = Math.max(0, Math.abs(dy) - r.height / 2);
      if (Math.hypot(nearX, nearY) > cfg.reach) {
        tx = 0;
        ty = 0;
      } else {
        tx = Math.max(-1, Math.min(1, dx / (r.width / 2 + cfg.reach))) * cfg.maxMove;
        ty = Math.max(-1, Math.min(1, dy / (r.height / 2 + cfg.reach))) * cfg.maxMove;
      }
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [mode]);

  return (
    <span ref={ref} className="inline-flex">
      {children}
    </span>
  );
}
