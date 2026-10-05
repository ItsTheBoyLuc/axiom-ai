'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMotionPreference } from '@/components/layout/motion-preference-provider';
import { chromeConfig, startConfig } from './config';
import type { BackgroundSeed } from './background';
import type { CineStatus, Controller } from './engine';

/**
 * Wraps a marketing or editorial page and turns it into the cinematic scroll experience once the
 * page has loaded. Everything is progressive: the server renders complete, readable content, and
 * this component only ADDS behaviour afterwards.
 *
 * - Full motion: after `load` and an idle callback it imports the engine (GSAP, ScrollTrigger,
 *   Lenis, the background canvas) as a separate chunk. Nothing here is on the critical path.
 * - Reduced motion (OS setting with "System default", or "Reduced"): none of those libraries is
 *   loaded; sections below the fold simply fade in briefly. No pinning, parallax, smooth
 *   scrolling or scroll-linked effects.
 * - The canvas and the progress bar are created in JavaScript and appended to <body>, so no
 *   transformed ancestor (the page transition) can break `position: fixed`.
 */
export function CinematicRoot({
  level = 'full',
  seed = null,
  debug = false,
  children,
}: {
  level?: 'full' | 'light';
  seed?: BackgroundSeed | null;
  /** Show the debug overlay (`?debug=scroll`, only when the server allows it). */
  debug?: boolean;
  children: React.ReactNode;
}) {
  const { mode } = useMotionPreference();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (mode === 'reduced') return startReduced(root);

    let cancelled = false;
    let controller: Controller | null = null;
    let teardown: (() => void) | null = null;

    const begin = async () => {
      if (cancelled) return;
      const canvas = makeCanvas();
      const bar = makeBar();
      teardown = () => {
        canvas.remove();
        bar.remove();
      };
      try {
        const { startEngine } = await import('./engine');
        if (cancelled) throw new Error('cancelled');
        controller = await startEngine(root, canvas, {
          level,
          seed: seed ?? { providers: [], models: [] },
          navigate: (href) => router.push(href),
          intro: level === 'full',
          bar,
        });
        if (cancelled) controller.destroy();
      } catch {
        teardown?.();
        teardown = null;
      }
    };

    // Never before the page has loaded and the browser is idle (keeps LCP and TBT untouched).
    let idleHandle = 0;
    let timer = 0;
    const schedule = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(() => void begin(), {
          timeout: startConfig.idleTimeoutMs,
        });
      } else {
        timer = window.setTimeout(() => void begin(), 200);
      }
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      if (idleHandle) window.cancelIdleCallback?.(idleHandle);
      window.clearTimeout(timer);
      controller?.destroy();
      teardown?.();
    };
    // `seed` is stable server data; the effect restarts only when the mode or level changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, level]);

  return (
    <div ref={rootRef} data-cine-root data-cine-level={level}>
      {children}
      {debug && <DebugOverlay />}
    </div>
  );
}

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.dataset.cineCanvas = '';
  // CSSOM property writes are allowed under the strict CSP (unlike style="" attributes in markup).
  Object.assign(c.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '-1',
    pointerEvents: 'none',
  });
  document.body.prepend(c);
  return c;
}

function makeBar(): HTMLElement {
  const b = document.createElement('div');
  b.setAttribute('aria-hidden', 'true');
  b.dataset.cineProgress = '';
  Object.assign(b.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: `${chromeConfig.progressHeight}px`,
    zIndex: '60',
    transformOrigin: 'left center',
    transform: 'scaleX(0)',
    background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
    pointerEvents: 'none',
  });
  document.body.appendChild(b);
  return b;
}

/** Reduced motion: sections below the fold fade in briefly. Nothing else moves. */
function startReduced(root: HTMLElement): () => void {
  const targets = [...root.querySelectorAll<HTMLElement>('[data-cine-state]')].filter(
    (el) => el.getBoundingClientRect().top > window.innerHeight * 0.9,
  );
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        (e.target as HTMLElement).style.opacity = '1';
        io.unobserve(e.target);
      });
    },
    { threshold: 0.05 },
  );
  targets.forEach((el) => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    io.observe(el);
  });
  return () => {
    io.disconnect();
    targets.forEach((el) => {
      el.style.opacity = '';
      el.style.transition = '';
    });
  };
}

/** `?debug=scroll`: scroll progress, the active section and frame stats, live. */
function DebugOverlay() {
  const [s, setS] = useState<CineStatus | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setS(window.__cine ? { ...window.__cine } : null), 120);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div
      data-cine-debug
      className="bg-elevated/90 text-fg border-line-strong fixed bottom-3 left-3 z-[90] rounded-lg border px-3 py-2 font-mono text-[11px] leading-5 shadow-[var(--shadow-pop)] backdrop-blur"
    >
      {s ? (
        <>
          <div>
            scroll {(s.progress * 100).toFixed(1)}% · section <b>{s.section || '-'}</b>
          </div>
          <div>
            triggers {s.triggers} · pins {s.pins} · lenis {String(s.lenis)} ·{' '}
            {s.mobile ? 'mobile' : 'desktop'}
          </div>
          {s.background && (
            <div>
              f {s.background.f.toFixed(2)} · fps p50 {s.background.fps.p50} p95{' '}
              {s.background.fps.p95} · slow {s.background.fps.slowFrames}/{s.background.fps.sampled}
            </div>
          )}
        </>
      ) : (
        <div>engine not running (reduced motion or still loading)</div>
      )}
    </div>
  );
}
