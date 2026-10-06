import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { animationsSettled, gotoReady, setTheme } from './helpers';

/**
 * Phase 11: the cinematic scroll experience on `/`. These tests prove the effects exist and move
 * with scroll (pixels, opacities, transforms), that reduced motion removes them, and that the page
 * stays usable without them. The engine starts after load and an idle callback, so every test
 * waits for `window.__cine` (the engine's status object) instead of sleeping.
 */

type Cine = {
  mode: string;
  lenis: boolean;
  triggers: number;
  pins: number;
  section: string;
  progress: number;
  canvas: boolean;
  mobile: boolean;
  intro: string;
  background: {
    frames: number;
    f: number;
    fps: { p50: number; p95: number; slowFrames: number; sampled: number };
    nodes: number;
    particles: number;
  } | null;
};
const cine = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cine?: Cine }).__cine ?? null);
const waitEngine = (page: Page) =>
  page.waitForFunction(
    () => {
      const c = (window as unknown as { __cine?: { canvas: boolean; triggers: number } }).__cine;
      return !!c && c.canvas && c.triggers > 3;
    },
    undefined,
    { timeout: 20_000 },
  );
const scrollTo = (page: Page, y: number) =>
  page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
/** Waits until the background has finished following the scroll (its section position stops moving). */
const settleScene = async (page: Page) => {
  let last = -1;
  let calm = 0;
  for (let i = 0; i < 60 && calm < 3; i++) {
    await page.waitForTimeout(150);
    const f = (await cine(page))?.background?.f ?? 0;
    calm = Math.abs(f - last) < 0.004 ? calm + 1 : 0;
    last = f;
  }
};
const docHeight = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

/** A cheap fingerprint of the background canvas: ~2000 sampled pixels (summed channels). */
const canvasSample = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas[data-cine-canvas]');
    if (!c) return null;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const out: number[] = [];
    const step = Math.max(4, Math.floor(d.length / 2000 / 4) * 4);
    for (let i = 0; i < d.length; i += step) out.push(d[i]! + d[i + 1]! + d[i + 2]! + d[i + 3]!);
    return out;
  });
/** Fraction of sampled pixels that changed visibly (more than a faint gradient shimmer). */
const diff = (a: number[], b: number[], tolerance = 60) => {
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    if (Math.abs(a[i]! - b[i]!) > tolerance) n++;
  return n / Math.min(a.length, b.length);
};

test.describe('cinematic home: the page moves and builds with scroll', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  // Full quality regardless of how busy the test machine is (see background.ts).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cineLockQuality: boolean }).__cineLockQuality = true;
    });
  });

  test('the engine starts after load: Lenis, ScrollTrigger scenes, pins and a canvas', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    const c = await cine(page);
    expect(c).toMatchObject({ mode: 'full', lenis: true, canvas: true, mobile: false });
    expect(c!.triggers).toBeGreaterThan(10);
    expect(c!.pins).toBeGreaterThanOrEqual(5); // stats, featured, providers, compare, releases, news, cta
    await expect(page.locator('html')).toHaveClass(/lenis/);
    expect(c!.background!.nodes).toBeGreaterThanOrEqual(40); // padded with decorative nodes when the data is short
    expect(c!.background!.particles).toBeGreaterThan(50);
  });

  test('the background canvas looks different at each of 8 scroll positions', async ({ page }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    const H = await docHeight(page);
    // Baseline: how much does the canvas change by itself (idle drift) over 600 ms?
    await scrollTo(page, 0);
    await settleScene(page);
    const a = (await canvasSample(page))!;
    await page.waitForTimeout(600);
    const idle = diff(a, (await canvasSample(page))!);

    // After each scroll the picture must change visibly; give a busy machine time to get there.
    const samples: number[][] = [(await canvasSample(page))!];
    // Under heavy machine load the adaptive quality governor sheds detail (grid, links, half the
    // particles), which shrinks the pixel difference between scenes; on a quiet machine it is ~0.1.
    const need = Math.max(0.012, idle * 1.5);
    for (let i = 1; i < 8; i++) {
      await scrollTo(page, Math.round((H * i) / 7));
      await expect
        .poll(async () => diff(samples[i - 1]!, (await canvasSample(page))!), {
          timeout: 12_000,
          message: `scroll position ${i}: the background should change (idle drift alone: ${idle.toFixed(3)})`,
        })
        .toBeGreaterThan(need);
      await settleScene(page);
      samples.push((await canvasSample(page))!);
    }
    console.log(
      'canvas change between scroll positions:',
      samples
        .slice(1)
        .map((x, i) => diff(samples[i]!, x).toFixed(3))
        .join(' '),
      '| idle drift:',
      idle.toFixed(3),
    );
    // And far-apart positions are very different pictures.
    expect(diff(samples[0]!, samples[7]!)).toBeGreaterThan(0.05);
  });

  test('section headline words build monotonically with scroll, and reverse going back up', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    const heading = page.locator('#featured-title');
    const top = await heading.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const progress = () =>
      heading.evaluate((el) => {
        const w = [...el.querySelectorAll<HTMLElement>('.cine-w')];
        if (!w.length) return -1;
        return w.reduce((s, x) => s + Number(getComputedStyle(x).opacity), 0) / w.length;
      });
    // The headline builds over a few hundred pixels of scroll around the pin: sample it finely.
    const ys: number[] = [];
    for (let i = 0; i <= 22; i++) ys.push(Math.round(top - 520 + i * 36));
    const up: number[] = [];
    for (const y of ys) {
      await scrollTo(page, y);
      await page.waitForTimeout(350);
      up.push(await progress());
    }
    expect(up[0], 'starts hidden, built by script').toBeLessThan(0.15);
    expect(up.at(-1), 'ends fully built').toBeGreaterThan(0.95);
    for (let i = 1; i < up.length; i++) {
      expect(up[i]!, `step ${i}: ${up.map((v) => v.toFixed(2)).join(' ')}`).toBeGreaterThanOrEqual(
        up[i - 1]! - 0.02,
      );
    }
    expect(
      new Set(up.map((v) => v.toFixed(1))).size,
      'passes through partial states',
    ).toBeGreaterThan(3);
    // Reverse
    const down: number[] = [];
    for (const y of [...ys].reverse()) {
      await scrollTo(page, y);
      await page.waitForTimeout(350);
      down.push(await progress());
    }
    for (let i = 1; i < down.length; i++) expect(down[i]!).toBeLessThanOrEqual(down[i - 1]! + 0.02);
    expect(down.at(-1)!).toBeLessThan(0.15);
  });

  test('sections pin for a few hundred pixels and cards move toward place from different directions', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    const spacers = await page
      .locator('.pin-spacer')
      .evaluateAll((els) => els.map((e) => ({ h: e.getBoundingClientRect().height })));
    expect(spacers.length).toBeGreaterThanOrEqual(5);
    // A pinned header is held in place while the page scrolls (position: fixed during the pin).
    const head = page.locator('[data-cine-state="featured"] [data-cine-head]');
    const top = await head.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, top - 150); // inside the pin range (pin starts at 22% of the viewport)
    await page.waitForTimeout(500);
    const y1 = await head.evaluate((el) => el.getBoundingClientRect().top);
    await scrollTo(page, top - 150 + 200);
    await page.waitForTimeout(500);
    const y2 = await head.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(y2 - y1), 'pinned header does not move for 200px of scroll').toBeLessThan(6);

    // Cards: transforms differ by direction while arriving.
    const cards = page.locator('[data-cine-state="featured"] [data-cine-cards] > *');
    const firstTop = await cards
      .first()
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, firstTop - 900 + 120);
    await page.waitForTimeout(600);
    const tf = await cards.evaluateAll((els) =>
      els.slice(0, 3).map((e) => getComputedStyle(e).transform),
    );
    expect(new Set(tf).size, `distinct transforms: ${tf.join(' | ')}`).toBeGreaterThan(1);
  });

  test('stats counters count up with the scene and end on the real values', async ({ page }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    const counters = page.locator('[data-cine-count]');
    const finals = await counters.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.cineCount),
    );
    const top = await page
      .locator('[data-cine-state="stats"]')
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, top - 220);
    await page.waitForTimeout(500);
    const early = await counters.first().innerText();
    await scrollTo(page, top + 700);
    // The scrub smooths over 0.7 s, so wait for the values instead of sleeping a fixed time.
    const read = () =>
      counters.evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/,/g, '')));
    await expect.poll(read, { timeout: 10_000 }).toEqual(finals);
    expect(Number(early.replace(/,/g, ''))).toBeLessThanOrEqual(Number(finals[0]));
  });

  test('counters still end on the real values when the visitor jumps in right after the engine starts, on a slow CPU', async ({
    page,
  }) => {
    // GSAP skips tween callbacks when ScrollTrigger re-applies progress itself; a refresh (the
    // engine refreshes shortly after it starts and again when fonts settle) landing mid-scrub left
    // a counter frozen part-way ("2" for "3") for good. Found on CI; reproduced here at 3 in 10.
    await gotoReady(page, '/');
    await waitEngine(page);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const counters = page.locator('[data-cine-count]');
    const finals = await counters.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.cineCount),
    );
    const top = await page
      .locator('[data-cine-state="stats"]')
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, top + 700);
    const read = () =>
      counters.evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/,/g, '')));
    await expect.poll(read, { timeout: 10_000 }).toEqual(finals);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });

  test('the hero canvas is alive with motion on: it differs between t=0 and t=1.5 s', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    await page.waitForTimeout(2500); // let the centre-out fade-in finish
    const a = (await canvasSample(page))!;
    await page.waitForTimeout(1500);
    const b = (await canvasSample(page))!;
    expect(diff(a, b)).toBeGreaterThan(0.004);
  });

  test('a progress bar fills with scroll, and ?debug=scroll shows the overlay', async ({
    page,
  }) => {
    await gotoReady(page, '/?debug=scroll');
    await waitEngine(page);
    await expect(page.locator('[data-cine-debug]')).toContainText('scroll');
    const H = await docHeight(page);
    await scrollTo(page, Math.round(H / 2));
    await page.waitForTimeout(500);
    const mid = await page
      .locator('[data-cine-progress]')
      .evaluate((e) => (e as HTMLElement).style.transform);
    expect(mid).toMatch(/scaleX\(0\.[3-7]/);
    await expect(page.locator('[data-cine-debug]')).toContainText(/section/);
  });

  test('all of the text is in the server HTML and nothing is hidden by markup', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text();
    for (const text of [
      'Explore the Intelligence Shaping Our Future.',
      'A directory built for precision.',
      'The organisations behind the models.',
      'Side by side, without the noise.',
      'A timeline of what shipped.',
      'Understand the Models Defining Tomorrow.',
    ]) {
      expect(html, text).toContain(text.replace(/'/g, '&#x27;'));
    }
    // Hidden states are applied by script only: no inline opacity:0 in the server HTML (outside the
    // Motion components that belong to the calm data pages, like the page transition).
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(main).not.toMatch(/data-cine-[a-z-]+[^>]*style="[^"]*opacity:\s*0/);
    expect(main).not.toMatch(/display:\s*none/);
  });
});

test.describe('reduced motion: nothing pinned, no Lenis, no scroll-linked effects', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('the OS setting alone switches everything off and content is simply visible', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await page.waitForTimeout(3000); // long enough for the engine to have started, had it been allowed
    expect(await cine(page)).toBeNull();
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    expect(await page.locator('.pin-spacer').count()).toBe(0);
    expect(await page.locator('canvas[data-cine-canvas]').count()).toBe(0);
    expect(await page.locator('[data-cine-progress]').count()).toBe(0);
    // Scrolling changes nothing about the headline: no transform, no filter, full opacity.
    const h1 = page.locator('#hero-title');
    await scrollTo(page, 300);
    await page.waitForTimeout(500);
    const s = await h1.evaluate((el) => {
      const cs = getComputedStyle(el.closest<HTMLElement>('[data-cine-head]')!);
      return { tf: cs.transform, op: cs.opacity, filter: cs.filter };
    });
    expect(s).toEqual({ tf: 'none', op: '1', filter: 'none' });
    // Everything below fades in briefly and ends fully visible.
    const H = await docHeight(page);
    for (let y = 0; y <= H; y += 600) {
      await scrollTo(page, y);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    const hidden = await page.evaluate(
      () =>
        [...document.querySelectorAll('main *')].filter((e) => {
          const cs = getComputedStyle(e);
          return (
            Number(cs.opacity) < 0.99 &&
            (e.textContent ?? '').trim().length > 3 &&
            cs.display !== 'none'
          );
        }).length,
    );
    expect(hidden).toBe(0);
  });

  test('the hero is static: two screenshots 1.5 s apart are identical', async ({ page }) => {
    await gotoReady(page, '/');
    await page.waitForTimeout(1500);
    const clip = { x: 0, y: 64, width: 1440, height: 780 };
    const a = await page.screenshot({ clip });
    await page.waitForTimeout(1500);
    const b = await page.screenshot({ clip });
    expect(a.equals(b)).toBe(true);
  });

  test('"Full motion" in the footer switches the effects on despite the OS setting, and it persists', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    expect(await cine(page)).toBeNull();
    await page.getByLabel('Motion').selectOption('full');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await waitEngine(page);
    expect(await cine(page)).toMatchObject({ mode: 'full', lenis: true });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await waitEngine(page);
    // And back: "Reduced" removes them again without a reload.
    await page.getByLabel('Motion').selectOption('reduced');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect.poll(async () => cine(page)).toBeNull();
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
  });
});

test.describe('the motion setting', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('"Reduced" removes the effects even when the OS asks for nothing, and "System default" restores them', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('axiom-motion', 'reduced'));
    await gotoReady(page, '/');
    await page.waitForTimeout(2500);
    expect(await cine(page)).toBeNull();
    await expect(page.getByLabel('Motion')).toHaveValue('reduced');
    await page.getByLabel('Motion').selectOption('system');
    await waitEngine(page);
    expect(await cine(page)).toMatchObject({ mode: 'full' });
  });
});

test.describe('usable without the effects and without JavaScript', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keyboard only: Tab reaches the hero buttons and Enter opens the directory', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
      if (name.startsWith('Explore AI Models')) break;
    }
    await expect(page.getByRole('link', { name: /^Explore AI Models/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/models$/);
  });

  test('the skip link and anchors work with smooth scrolling on', async ({ page }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    await scrollTo(page, 2000);
    await page.waitForTimeout(400);
    await page.keyboard.press('Tab');
    await page.getByRole('link', { name: 'Skip to content' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    // A hash on load lands on its target even though pin spacers are added afterwards.
    await page.goto('/#compare-title');
    await waitEngine(page);
    await page.waitForTimeout(1500);
    const box = await page.locator('#compare-title').boundingBox();
    expect(box && box.y > -20 && box.y < 800, `heading at y=${box?.y}`).toBe(true);
  });

  test('find-in-page style jumps (scrollIntoView) and back/forward keep working', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    await page.locator('#news-title').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(1500);
    await page.getByRole('link', { name: 'All news' }).click();
    await expect(page).toHaveURL(/\/news/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitEngine(page); // the engine restarts cleanly on the way back
  });

  test('without JavaScript the whole page is readable and complete', async ({ browser }) => {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const t of [
      'A directory built for precision.',
      'The organisations behind the models.',
      'Understand the Models Defining Tomorrow.',
    ]) {
      await expect(page.getByRole('heading', { name: t })).toBeVisible();
    }
    const invisible = await page.evaluate(
      () =>
        [...document.querySelectorAll('main *')].filter((e) => {
          const cs = getComputedStyle(e);
          return (
            (Number(cs.opacity) < 1 || cs.visibility === 'hidden') &&
            (e.textContent ?? '').trim().length > 3 &&
            !e.closest('.sr-only-focusable')
          );
        }).length,
    );
    expect(invisible).toBe(0);
    await ctx.close();
  });
});

test.describe('mobile (390 px): simpler, still scroll-linked, no overflow', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('no pins, no Lenis, fewer particles, text still builds with scroll, no horizontal overflow', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    const c = await cine(page);
    expect(c).toMatchObject({ mobile: true, pins: 0, lenis: false });
    expect(c!.background!.particles).toBeLessThan(60);
    const heading = page.locator('#providers-title');
    const top = await heading.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const op = () =>
      heading.evaluate((el) => Number(getComputedStyle(el.querySelector('.cine-w')!).opacity));
    await scrollTo(page, top - 800);
    await page.waitForTimeout(500);
    const before = await op();
    await scrollTo(page, top - 300);
    await page.waitForTimeout(700);
    const after = await op();
    expect(after).toBeGreaterThan(before);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('security and frame budget', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('GSAP, Lenis and the canvas run under the strict CSP: no violations while scrolling the whole page', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        (window as unknown as { __csp: string[] }).__csp.push(
          `${e.violatedDirective} ${e.blockedURI || 'inline'} ${e.sourceFile ?? ''}`,
        );
      });
    });
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror ${e.message}`));
    await gotoReady(page, '/');
    await waitEngine(page);
    const H = await docHeight(page);
    for (let y = 0; y <= H; y += 500) {
      await scrollTo(page, y);
      await page.waitForTimeout(60);
    }
    await page.mouse.move(700, 400);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('frame stats at 4x CPU slowdown while scrolling the page (reported, loosely bounded)', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await waitEngine(page);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.mouse.move(700, 450);
    for (let i = 0; i < 70; i++) {
      await page.mouse.wheel(0, 160);
      await page.waitForTimeout(110);
    }
    const stats = (await cine(page))!.background!.fps;
    console.log(`FRAME STATS (4x CPU throttle, 1440x900): ${JSON.stringify(stats)}`);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    expect(stats.sampled).toBeGreaterThan(100);
    expect(stats.p50).toBeGreaterThan(15); // loose: this runs beside seven other workers
  });
});

test.describe('filmstrip', () => {
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    test(`scroll filmstrip at ${w}px (dark), for judging by eye`, async ({ page }) => {
      test.setTimeout(120_000);
      await setTheme(page, 'dark');
      await page.setViewportSize({ width: w, height: h });
      await gotoReady(page, '/');
      await waitEngine(page);
      await page.waitForTimeout(2500);
      const dir = 'test-results/scroll-filmstrip';
      mkdirSync(dir, { recursive: true });
      const H = await docHeight(page);
      for (const pct of [0, 15, 30, 45, 60, 75, 90, 100]) {
        await scrollTo(page, Math.round((H * pct) / 100));
        await page.waitForTimeout(1600);
        await page.screenshot({ path: `${dir}/${w}-${String(pct).padStart(3, '0')}.png` });
      }
    });
  }
});

test.describe('light level: what is on screen when the page opens is already built', () => {
  // A scrubbed scene whose start has passed at load would sit half built (faint, blurred) until the
  // visitor scrolls. Whatever intersects the viewport at rest must be fully opaque and sharp;
  // whatever is still below the fold may be hidden (opacity 0) but never half way.
  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
    [768, 1024],
    [390, 844],
  ] as const) {
    for (const path of ['/about', '/releases']) {
      test(`${path} at ${width}x${height}: no half-built text at rest`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await gotoReady(page, path);
        await waitEngine(page);
        await animationsSettled(page);
        const halfBuilt = await page.evaluate(() => {
          const out: string[] = [];
          const sel =
            '[data-cine-block], [data-cine-head] *, [data-cine-cards] > *, [data-cine-title] *';
          for (const el of document.querySelectorAll<HTMLElement>(sel)) {
            const cs = getComputedStyle(el);
            const o = Number(cs.opacity);
            const r = el.getBoundingClientRect();
            const inView = r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
            const blurred = cs.filter !== 'none' && !/blur\(0(px)?\)/.test(cs.filter);
            if (inView && (o < 0.99 || blurred) && o > 0)
              out.push(
                `${el.tagName}.${el.className.toString().slice(0, 24)} op=${o} f=${cs.filter}`,
              );
            else if (!inView && o > 0 && o < 0.99) out.push(`below fold op=${o}`);
          }
          return out;
        });
        expect(halfBuilt).toEqual([]);
      });
    }
  }
});
