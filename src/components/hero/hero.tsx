import Link from 'next/link';
import { Magnetic } from '@/components/cinematic/magnetic';
import { DemoBadge } from '@/components/ui/badges';
import { ButtonLink } from '@/components/ui/button';
import { LogoMark } from '@/components/ui/logo';
import type { GraphSeed } from './graph';
import { StaticNetwork } from './static-network';

/**
 * The hero. Rendered entirely on the server and fully visible as sent: the headline is the page's
 * Largest Contentful Paint element and must never wait for JavaScript. The cinematic engine
 * (components/cinematic) adds the load sequence (logo draws in, headline builds word by word, the
 * live network fades in from the centre) AFTER first paint, and the scroll exit afterwards. The
 * static SVG below is what everybody sees first, and what reduced-motion users keep.
 */
export function Hero({ seed }: { seed: GraphSeed }) {
  return (
    <section
      aria-labelledby="hero-title"
      data-cine-state="hero"
      className="bg-noise relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden"
    >
      {/* Layers: ambient gradient, grid, static network (the live canvas is fixed behind the page) */}
      <div aria-hidden className="bg-ambient absolute inset-0 -z-10" />
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div data-hero-static className="absolute inset-0 -z-10 opacity-70">
        <StaticNetwork seed={seed} className="absolute inset-0 size-full" />
      </div>
      {/* Soft vignette keeps the headline legible over the network */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 50% 38% at 50% 48%, var(--bg-primary) 20%, transparent 100%)',
          opacity: 0.55,
        }}
      />

      <div
        data-cine-head
        className="pointer-events-none mx-auto flex w-full max-w-[1280px] flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8"
      >
        <div data-cine-logo className="text-fg mb-8">
          <LogoMark size={44} />
        </div>
        <h1 id="hero-title" data-cine-title className="t-display max-w-4xl text-balance">
          Explore the Intelligence Shaping Our Future.
        </h1>
        <p data-cine-lead className="t-lead mt-6 max-w-2xl text-balance">
          Discover, compare, and understand the world&apos;s most advanced AI models in one place.
        </p>
        <div
          data-cine-buttons
          className="pointer-events-auto mt-10 flex flex-wrap justify-center gap-3"
        >
          <Magnetic>
            <ButtonLink href="/models" size="lg" arrow>
              Explore AI Models
            </ButtonLink>
          </Magnetic>
          <ButtonLink href="/compare" size="lg" variant="secondary">
            Compare Models
          </ButtonLink>
        </div>
        {seed.isDemo && (
          <div className="mt-8">
            <DemoBadge />
            <span className="sr-only">
              {' '}
              The network in the background shows placeholder providers and models.
            </span>
          </div>
        )}
      </div>

      {/* Keyboard / screen-reader alternative to the canvas: the same links as a real list,
          visible when focused. */}
      <nav
        aria-label={seed.isDemo ? 'Providers and models (demo)' : 'Providers and models'}
        className="sr-only-focusable border-line-strong bg-elevated absolute bottom-4 left-4 z-20 max-h-[40vh] max-w-[calc(100%-2rem)] overflow-auto rounded-xl border p-4 text-sm shadow-[var(--shadow-pop)]"
      >
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {seed.providers.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/providers/${p.slug}`}
                className="text-fg underline-offset-4 hover:underline"
              >
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
  );
}
