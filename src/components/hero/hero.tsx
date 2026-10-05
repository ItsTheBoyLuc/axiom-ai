'use client';

import Link from 'next/link';
import { motion, type Variants } from 'motion/react';
import { ButtonLink } from '@/components/ui/button';
import { DemoBadge } from '@/components/ui/badges';
import { LogoMark } from '@/components/ui/logo';
import { distance, duration, ease, fadeUp, stagger } from '@/lib/motion';
import type { GraphSeed } from './graph';
import { HeroScroll } from './hero-scroll';
import { HeroVisual } from './hero-visual';
import { StaticNetwork } from './static-network';

/**
 * The headline and lead only rise into place; they never start transparent. They are the largest
 * content on the page, so they must be visible in the server-rendered HTML: a fade-in that waits
 * for hydration would make Largest Contentful Paint equal to "time to load and run the scripts".
 */
const rise: Variants = {
  hidden: { y: distance.md },
  show: { y: 0, transition: { duration: duration.base, ease: ease.out } },
};

export function Hero({ seed }: { seed: GraphSeed }) {
  // Reduced motion is applied by MotionProvider (fade only); never branch on it while rendering.
  const item = fadeUp;

  return (
    <HeroScroll>
      <section
        aria-labelledby="hero-title"
        className="bg-noise relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden"
      >
        {/* Layers: ambient gradient, grid, network (static SVG + optional canvas) */}
        <div aria-hidden className="bg-ambient absolute inset-0 -z-10" />
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div data-hero-visual className="absolute inset-0 -z-10 opacity-70">
          <StaticNetwork seed={seed} className="absolute inset-0 size-full" />
          <HeroVisual seed={seed} />
        </div>
        {/* Soft vignette keeps text legible over the network */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 55% 45% at 50% 48%, var(--bg-primary) 30%, transparent 100%)',
            opacity: 0.85,
          }}
        />

        <motion.div
          data-hero-content
          variants={stagger}
          initial="hidden"
          animate="show"
          className="pointer-events-none mx-auto flex w-full max-w-[1280px] flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8"
        >
          <motion.div variants={item} className="text-fg mb-8">
            <LogoMark size={44} />
          </motion.div>
          <motion.h1 id="hero-title" variants={rise} className="t-display max-w-4xl text-balance">
            Explore the Intelligence Shaping Our Future.
          </motion.h1>
          <motion.p variants={rise} className="t-lead mt-6 max-w-2xl text-balance">
            Discover, compare, and understand the world&apos;s most advanced AI models in one place.
          </motion.p>
          <motion.div
            variants={item}
            className="pointer-events-auto mt-10 flex flex-wrap justify-center gap-3"
          >
            <ButtonLink href="/models" size="lg" arrow>
              Explore AI Models
            </ButtonLink>
            <ButtonLink href="/compare" size="lg" variant="secondary">
              Compare Models
            </ButtonLink>
          </motion.div>
          {seed.isDemo && (
            <motion.div variants={item} className="mt-8">
              <DemoBadge />
              <span className="sr-only">
                {' '}
                The network in the background shows placeholder providers and models.
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Keyboard / screen-reader alternative to the canvas: the same links as a real list,
            visible when focused. */}
        <nav
          aria-label={seed.isDemo ? 'Providers and models (demo)' : 'Providers and models'}
          className="sr-only-focusable border-line-strong bg-elevated absolute bottom-4 left-4 z-20 max-h-[40vh] max-w-[calc(100%-2rem)] overflow-auto rounded-xl border p-4 text-sm shadow-[var(--shadow-pop)]"
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {seed.providers.map((p) => (
              <li key={p.slug}>
                <Link href="/providers" className="text-fg underline-offset-4 hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
            {seed.models.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/models/${m.slug}`}
                  className="text-fg-2 underline-offset-4 hover:underline"
                >
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </HeroScroll>
  );
}
