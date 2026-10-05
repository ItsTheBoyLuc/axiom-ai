'use client';

import { useEffect, useRef } from 'react';
import { useReducedMode } from '@/components/layout/motion-preference-provider';

/** Tunables of the releases timeline (docs/MOTION.md, Phase 11). */
export const timelineConfig = {
  /** Seconds of smoothing between scroll and animation (ScrollTrigger scrub). */
  scrub: 0.5,
  /** An entry is "in focus" while it crosses the middle of the viewport. */
  focus: { start: 'top 88%', end: 'bottom 12%' },
  /**
   * Entry state before it enters and after it leaves: rise in px and blur in px, and opacity. Opacity
   * stays 1 on purpose: any transparency pushes muted text below the WCAG contrast minimum, so the
   * entries "go out of focus" (blur) instead of fading, and stay readable.
   */
  soft: { opacity: 1, rise: 34, leaveRise: -14, blur: 3.5 },
  /** Share of the entry's scroll range spent arriving, holding, leaving (must sum to 1). */
  arrive: 0.36,
  hold: 0.3,
  leave: 0.34,
  /** The accent line draws between these viewport positions. */
  line: { start: 'top 70%', end: 'bottom 70%', scrub: 0.4 },
} as const;

/**
 * GSAP + ScrollTrigger scroll effects for the releases timeline (full motion only):
 *  - the accent line along the timeline draws down as the reader scrolls (scrubbed);
 *  - each entry comes into focus as it crosses the middle of the viewport (opacity, rise and a
 *    touch of blur) and softens again as it leaves, in both scroll directions.
 * Only transform, opacity and filter are animated. GSAP is imported dynamically, after the page
 * has loaded, so it never lands in other routes' bundles or on the critical path; reduced motion
 * leaves the timeline simply static. Without JavaScript everything is fully visible.
 */
export function TimelineScroll({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMode();

  useEffect(() => {
    if (reduce || !root.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const t = timelineConfig;
      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-release-entry]').forEach((el) => {
          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: { trigger: el, start: t.focus.start, end: t.focus.end, scrub: t.scrub },
          });
          tl.fromTo(
            el,
            { opacity: t.soft.opacity, y: t.soft.rise, filter: `blur(${t.soft.blur}px)` },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: t.arrive },
          )
            .to(el, { opacity: 1, duration: t.hold })
            .to(el, {
              opacity: t.soft.opacity,
              y: t.soft.leaveRise,
              filter: `blur(${t.soft.blur}px)`,
              duration: t.leave,
            });
        });
        gsap.fromTo(
          '[data-timeline-progress]',
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            transformOrigin: 'top',
            scrollTrigger: {
              trigger: root.current,
              start: t.line.start,
              end: t.line.end,
              scrub: t.line.scrub,
            },
          },
        );
      }, root);
      cleanup = () => ctx.revert();
    };

    // After the page has loaded and the browser is idle, like the rest of the cinematic engine.
    let idle = 0;
    let timer = 0;
    const schedule = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === 'function')
        idle = window.requestIdleCallback(() => void start(), { timeout: 1200 });
      else timer = window.setTimeout(() => void start(), 200);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      if (idle) window.cancelIdleCallback?.(idle);
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [reduce]);

  return <div ref={root}>{children}</div>;
}
