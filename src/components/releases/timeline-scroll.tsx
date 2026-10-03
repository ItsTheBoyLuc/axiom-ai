'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * GSAP + ScrollTrigger scroll effects for the releases timeline: each entry rises and fades in
 * once as it scrolls into view, and the accent line along the timeline draws down as the reader
 * scrolls (scrubbed). Only transform and opacity are animated. GSAP is imported dynamically so
 * it never lands in other routes' bundles, and everything is skipped under
 * prefers-reduced-motion (the timeline is then simply static). Without JavaScript the content is
 * fully visible: the effects only start after hydration.
 */
export function TimelineScroll({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !root.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-release-entry]').forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 28,
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
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
              start: 'top 70%',
              end: 'bottom 70%',
              scrub: 0.4,
            },
          },
        );
      }, root);
      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reduce]);

  return <div ref={root}>{children}</div>;
}
