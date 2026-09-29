'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * GSAP + ScrollTrigger scroll sequence for the hero: content drifts up and fades while the
 * network layer moves slower (parallax). GSAP is imported dynamically so it never lands in
 * other routes' bundles. Skipped entirely under prefers-reduced-motion.
 */
export function HeroScroll({ children }: { children: React.ReactNode }) {
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
        const trigger = { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 0.6 };
        // Only transform + opacity are animated.
        gsap.to('[data-hero-content]', {
          yPercent: -14,
          opacity: 0.15,
          ease: 'none',
          scrollTrigger: trigger,
        });
        gsap.to('[data-hero-visual]', { yPercent: 10, ease: 'none', scrollTrigger: trigger });
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
