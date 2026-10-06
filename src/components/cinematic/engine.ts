import {
  backgroundConfig as bgConfig,
  introConfig as intro,
  sceneConfig as scene,
  smoothConfig,
  startConfig,
} from './config';
import { splitSentences, splitWords, type Split } from './split';
import type Lenis from 'lenis';
import type { Background, BackgroundSeed, BackgroundStatus } from './background';

/**
 * The cinematic scroll engine (Phase 11). Loaded with a dynamic import after the page has loaded
 * and the browser is idle, so it is never on the critical path, and only on the marketing and
 * editorial routes. It owns:
 *
 *  - Lenis smooth scrolling (desktop pointer devices),
 *  - the fixed background canvas (./background),
 *  - ScrollTrigger scenes: text that builds word by word and sentence by sentence, pinned
 *    headers, cards arriving from different directions, counters, the hero exit,
 *  - the hero load sequence, the progress bar and a status object for tests and the debug overlay.
 *
 * Contract with the markup (all server-rendered and fully visible without JavaScript):
 *   [data-cine-state]      a section; the value names its background formation
 *   [data-cine-head]       the part that is pinned and built (header block, or the whole section)
 *   [data-cine-eyebrow] [data-cine-title] [data-cine-lead] [data-cine-action] [data-cine-stat]
 *   [data-cine-count=N]    a counter that counts up with the scene
 *   [data-cine-cards]      a container whose children arrive from different directions
 *   [data-cine-block]      a single block that arrives as one card
 * Initial hidden states are set here, in JavaScript, never in the HTML. Animations touch only
 * transform, opacity and filter, so nothing shifts layout. Everything reverses on scroll up.
 */

export type EngineOptions = {
  level: 'full' | 'light';
  seed: BackgroundSeed | null;
  navigate: (href: string) => void;
  /** Play the hero load sequence if the engine starts early enough. */
  intro: boolean;
  /** The slim scroll-progress bar (created by the caller, appended to <body>). */
  bar: HTMLElement | null;
};

export type CineStatus = {
  mode: 'full';
  level: 'full' | 'light';
  mobile: boolean;
  lenis: boolean;
  triggers: number;
  pins: number;
  section: string;
  /** Page scroll progress 0..1. */
  progress: number;
  canvas: boolean;
  intro: 'played' | 'skipped';
  background: BackgroundStatus | null;
};

declare global {
  interface Window {
    __cine?: CineStatus;
  }
}

export type Controller = { destroy: () => void };

/** Scrubbed "arrival" scenes (text and cards that build while they scroll into view) carry this id. */
const ARRIVE = 'arrive';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const q = <T extends Element>(root: ParentNode, sel: string) => [...root.querySelectorAll<T>(sel)];

export async function startEngine(
  root: HTMLElement,
  canvas: HTMLCanvasElement | null,
  opts: EngineOptions,
): Promise<Controller> {
  const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const mobile = window.innerWidth <= startConfig.mobileMaxWidth;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const pins = opts.level === 'full' && !mobile;

  const [{ gsap }, { ScrollTrigger }, lenisModule, bgModule] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    coarse ? Promise.resolve(null) : import('lenis'),
    canvas && opts.seed ? import('./background') : Promise.resolve(null),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const splits: Split[] = [];
  const counters: { el: HTMLElement; value: number }[] = [];
  const cleanups: (() => void)[] = [];

  // ---------------------------------------------------------------- smooth scrolling
  let lenis: Lenis | null = null;
  if (lenisModule) {
    lenis = new lenisModule.default({
      duration: smoothConfig.duration,
      wheelMultiplier: smoothConfig.wheelMultiplier,
      autoRaf: false,
    });
    const tick = (time: number) => lenis!.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', ScrollTrigger.update);
    cleanups.push(() => {
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
    });
  }

  await yieldToMain();
  // ------------------------------------------------------------------- background
  const startedLate = performance.now() > startConfig.introMaxStartMs || window.scrollY > 200;
  const playIntro = opts.intro && !startedLate;
  let background: Background | null = null;
  if (bgModule && canvas && opts.seed) {
    background = bgModule.createBackground(canvas, root, opts.seed, {
      mobile,
      navigate: opts.navigate,
      reveal: playIntro ? intro.networkReveal : 0.9,
      opacity: opts.level === 'light' ? bgConfig.lightLevelOpacity : 1,
    });
    canvas.dataset.ready = 'true';
    // The server-rendered static network gives way to the live one.
    const stat = root.querySelector<HTMLElement>('[data-hero-static]');
    if (stat) {
      stat.style.transition = 'opacity 1.2s ease';
      requestAnimationFrame(() => (stat.style.opacity = '0'));
    }
    cleanups.push(() => {
      background?.destroy();
      background = null;
      if (stat) stat.style.opacity = '';
    });
  }

  // --------------------------------------------------------------------- scenes
  // Built section by section, each in its own task: one long task would block the main thread (and
  // the page's responsiveness) for as long as the whole build takes on a slow CPU.
  const ctx = gsap.context(() => {}, root);
  for (const sec of q<HTMLElement>(root, '[data-cine-state]')) {
    await yieldToMain();
    ctx.add(() => {
      const name = sec.dataset.cineState ?? '';
      const head = sec.querySelector<HTMLElement>('[data-cine-head]');
      if (head) buildHead(sec, head, name);
      const cards = sec.querySelector<HTMLElement>('[data-cine-cards]');
      if (cards) buildCards([...cards.children] as HTMLElement[]);
      q<HTMLElement>(sec, '[data-cine-block]').forEach((b) => buildCards([b], 0, true));
    });
  }
  await yieldToMain();
  ctx.add(() => {
    // Hero exit: the headline block recedes (scale up, blur, fade) while the page scrolls on and the
    // background regroups into the next formation. Not pinned: the hero is a flex-centred block and
    // a pin spacer would change its layout.
    const heroSection = root.querySelector<HTMLElement>('[data-cine-state="hero"]');
    const hero = heroSection?.querySelector<HTMLElement>('[data-cine-head]');
    if (heroSection && hero) {
      gsap.to(hero, {
        y: scene.heroExit.y,
        scale: scene.heroExit.scale,
        opacity: 0,
        filter: `blur(${scene.heroExit.blur}px)`,
        ease: 'none',
        scrollTrigger: {
          trigger: heroSection,
          start: 'top top',
          end: 'bottom 20%',
          scrub: scene.scrub,
        },
      });
    }

    // Progress bar
    const bar = opts.bar;
    if (bar) {
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
        },
      });
    }
  });

  function buildHead(sec: HTMLElement, head: HTMLElement, name: string) {
    if (name === 'hero') return; // the hero has its own sequence (intro and exit)
    const eyebrow = head.querySelector<HTMLElement>('[data-cine-eyebrow]');
    const title = head.querySelector<HTMLElement>('[data-cine-title]');
    const lead = head.querySelector<HTMLElement>('[data-cine-lead]');
    const action = head.querySelector<HTMLElement>('[data-cine-action]');
    const stats = q<HTMLElement>(head, '[data-cine-stat]');
    const pinPx = scene.pin[name] ?? scene.pinDefault;
    const pin = pins && sec.hasAttribute('data-cine-pin');

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: pin
        ? {
            trigger: head,
            start: `center ${scene.pinCenter}%`,
            end: `+=${pinPx}`,
            pin: true,
            pinSpacing: true,
            scrub: scene.scrub,
            anticipatePin: 1,
          }
        : {
            id: ARRIVE,
            trigger: head,
            start: scene.textStart,
            end: scene.textEnd,
            scrub: scene.scrub,
          },
    });
    let at = 0;
    if (eyebrow) {
      tl.fromTo(eyebrow, { opacity: 0, y: scene.eyebrow.y }, { opacity: 1, y: 0, duration: 1 }, at);
      at += 0.6;
    }
    if (title) {
      const s = splitWords(title);
      splits.push(s);
      tl.fromTo(
        s.parts,
        { opacity: 0, y: scene.title.y, filter: `blur(${scene.title.blur}px)` },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: scene.title.stagger },
        at,
      );
      at += 1 + scene.title.stagger * Math.max(0, s.parts.length - 1) - 0.3;
    }
    if (lead) {
      const s = splitSentences(lead);
      splits.push(s);
      const leadStagger = s.kind === 'words' ? scene.lead.wordStagger : scene.lead.stagger;
      tl.fromTo(
        s.parts,
        { opacity: 0, y: scene.lead.y, filter: `blur(${scene.lead.blur}px)` },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: leadStagger },
        at,
      );
      at += 1.2 + leadStagger * Math.max(0, s.parts.length - 1) - 0.2;
    }
    if (stats.length) {
      tl.fromTo(
        stats,
        { opacity: 0, y: 36, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 1.2, stagger: 0.45 },
        at,
      );
      stats.forEach((st, i) => {
        const el = st.querySelector<HTMLElement>('[data-cine-count]');
        if (!el) return;
        const value = Number(el.dataset.cineCount ?? '0');
        counters.push({ el, value });
        const o = { v: 0 };
        el.textContent = fmt(0);
        tl.to(
          o,
          {
            v: value,
            duration: 1.8,
            ease: scene.counterEase,
            onUpdate: () => (el.textContent = fmt(o.v)),
          },
          at + i * 0.45,
        );
      });
      at += 1.2 + 0.45 * (stats.length - 1);
    }
    if (action) {
      tl.fromTo(
        action,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1 },
        Math.max(0, at - 0.4),
      );
    }
  }

  function buildCards(items: HTMLElement[], offset = 0, vertical = false) {
    items.forEach((el, i) => {
      const from =
        mobile || vertical
          ? scene.cardFromMobile
          : scene.cardFrom[(i + offset) % scene.cardFrom.length]!;
      const stagger = (i % 3) * scene.cardStagger;
      gsap.fromTo(
        el,
        { x: from.x, y: from.y, scale: from.scale, rotate: from.rotate, opacity: 0 },
        {
          x: 0,
          y: 0,
          scale: 1,
          rotate: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            id: ARRIVE,
            trigger: el,
            start: `top ${scene.cardStartPct - stagger}%`,
            end: `top ${scene.cardEndPct - stagger}%`,
            scrub: scene.scrub,
          },
        },
      );
    });
  }

  await yieldToMain();
  // ----------------------------------------------------------------- hero intro
  let introState: CineStatus['intro'] = 'skipped';
  if (playIntro) {
    const hero = root.querySelector<HTMLElement>('[data-cine-state="hero"]');
    if (hero) {
      introState = 'played';
      const title = hero.querySelector<HTMLElement>('[data-cine-title]');
      const lead = hero.querySelector<HTMLElement>('[data-cine-lead]');
      const buttons = q<HTMLElement>(hero, '[data-cine-buttons] > *');
      const logoPaths = q<SVGPathElement>(hero, '[data-cine-logo] path');
      ctx.add(() => {
        const tl = gsap.timeline();
        if (logoPaths.length) {
          logoPaths.forEach((p) => {
            const len = p.getTotalLength?.() ?? 60;
            if (p.getAttribute('stroke')) {
              p.style.strokeDasharray = `${len}`;
              tl.fromTo(
                p,
                { strokeDashoffset: len },
                {
                  strokeDashoffset: 0,
                  duration: intro.logo.duration,
                  ease: intro.logo.ease,
                  onComplete: () => {
                    p.style.strokeDasharray = '';
                    p.style.strokeDashoffset = '';
                  },
                },
                intro.logo.delay,
              );
            } else {
              tl.fromTo(
                p,
                { opacity: 0 },
                { opacity: 1, duration: 0.6 },
                intro.logo.delay + intro.logo.duration * 0.6,
              );
            }
          });
        }
        if (title) {
          const s = splitWords(title);
          splits.push(s);
          tl.fromTo(
            s.parts,
            { opacity: 0, y: intro.title.y, filter: `blur(${intro.title.blur}px)` },
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: intro.title.duration,
              stagger: intro.title.stagger,
              ease: intro.title.ease,
            },
            0.1,
          );
        }
        if (lead) {
          const s = splitSentences(lead);
          splits.push(s);
          tl.fromTo(
            s.parts,
            { opacity: 0, y: intro.lead.y, filter: `blur(${intro.lead.blur}px)` },
            {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: intro.lead.duration,
              stagger: s.kind === 'words' ? intro.lead.wordStagger : intro.lead.stagger,
              ease: intro.lead.ease,
            },
            intro.lead.delay,
          );
        }
        if (buttons.length) {
          tl.fromTo(
            buttons,
            { opacity: 0, y: intro.buttons.y },
            {
              opacity: 1,
              y: 0,
              duration: intro.buttons.duration,
              stagger: intro.buttons.stagger,
              ease: intro.buttons.ease,
            },
            intro.buttons.delay,
          );
        }
      });
    }
  }

  // -------------------------------------------------------------------- status
  const sectionsEls = q<HTMLElement>(root, '[data-cine-state]');
  const status: CineStatus = {
    mode: 'full',
    level: opts.level,
    mobile,
    lenis: !!lenis,
    triggers: 0,
    pins: 0,
    section: '',
    progress: 0,
    canvas: !!background,
    intro: introState,
    background: null,
  };
  window.__cine = status;
  let lastStats = 0;
  // The status reads layout (bounding boxes of every section) and sorts frame samples: do it a few
  // times a second, never every frame, or it forces layout between GSAP's writes.
  const update = () => {
    const now = performance.now();
    if (now - lastStats < 200) return;
    lastStats = now;
    status.triggers = ScrollTrigger.getAll().length;
    status.pins = document.querySelectorAll('.pin-spacer').length;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    status.progress = Math.round((window.scrollY / max) * 1000) / 1000;
    const mid = window.innerHeight / 2;
    let best = '';
    let bd = Infinity;
    sectionsEls.forEach((s) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (r.top < mid && r.bottom > mid) {
        best = s.dataset.cineState ?? '';
        bd = -1;
      } else if (bd >= 0 && d < bd) {
        best = s.dataset.cineState ?? '';
        bd = d;
      }
    });
    status.section = best;
    if (background) status.background = background.status();
  };
  gsap.ticker.add(update);
  cleanups.push(() => gsap.ticker.remove(update));

  // Where the page should be scrolled for a link to #something. Pins add spacers, so a target's
  // natural position is not where it is shown: for a heading built by a scene, go to where that
  // scene is complete (and, if pinned, still held); otherwise honour the element's scroll margin
  // (the sticky navigation bars) like the browser would.
  const positionFor = (target: Element): number => {
    const st = ScrollTrigger.getAll().find(
      (t) => t.trigger instanceof Element && t.trigger.contains(target),
    );
    if (st) return st.start + (st.end - st.start) * scene.anchorProgress;
    const margin =
      parseFloat(getComputedStyle(target).scrollMarginTop) ||
      parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) ||
      0;
    return target.getBoundingClientRect().top + window.scrollY - margin;
  };
  const goTo = (target: Element, immediate: boolean) => {
    const y = Math.max(0, positionFor(target));
    if (lenis) lenis.scrollTo(y, { immediate, force: immediate });
    else window.scrollTo({ top: y, behavior: immediate ? 'instant' : 'smooth' });
  };

  // A link to #something that was opened before the pin spacers existed lands in the wrong place
  // once they are inserted; put the visitor back on the target (also on a later hash change).
  let hashHandled = false;
  const settleHash = () => {
    if (hashHandled || !location.hash || location.hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    hashHandled = true;
    goTo(target, true);
  };
  const onHash = () => {
    hashHandled = false;
    settleHash();
  };
  window.addEventListener('hashchange', onHash);
  cleanups.push(() => window.removeEventListener('hashchange', onHash));

  // In-page anchor clicks scroll smoothly through the same positioning (and keep working with
  // keyboard activation, since Enter on a link fires click).
  const onAnchorClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
    if (
      !a ||
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    goTo(target, false);
    history.pushState(null, '', `#${id}`);
    // Move focus to the target for keyboard and screen-reader users, without a second scroll.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  document.addEventListener('click', onAnchorClick, true);
  cleanups.push(() => document.removeEventListener('click', onAnchorClick, true));

  // Content that is already on screen when the page opens has nothing left to arrive from: a scene
  // whose start has passed would otherwise sit half built (faint, blurred, failing contrast) until
  // the visitor scrolls. Snap those to their arrived state and stop scrubbing them; scenes still
  // below the fold stay hidden until they arrive. Only while the visitor has not scrolled yet.
  const startY = window.scrollY;
  const arriveInView = () => {
    if (Math.abs(window.scrollY - startY) > 2) return;
    for (const t of ScrollTrigger.getAll()) {
      if (t.vars.id !== ARRIVE || !t.animation || t.progress <= 0 || t.progress >= 1) continue;
      t.animation.progress(1);
      t.kill(false);
    }
  };

  // Layout changes (fonts, images, sections streaming in) move every trigger; keep them honest.
  const refresh = () => {
    ScrollTrigger.refresh();
    arriveInView();
    background?.measure();
    settleHash();
  };
  ScrollTrigger.addEventListener('refresh', () => background?.measure());
  void document.fonts?.ready.then(refresh);
  const settle = window.setTimeout(refresh, 600);
  cleanups.push(() => window.clearTimeout(settle));
  ScrollTrigger.refresh();
  arriveInView();
  settleHash();

  return {
    destroy() {
      ctx.revert();
      splits.forEach((s) => s.revert());
      counters.forEach((c) => (c.el.textContent = fmt(c.value)));
      cleanups.forEach((c) => c());
      if (window.__cine === status) delete window.__cine;
    },
  };
}
