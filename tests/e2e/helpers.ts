import type { Page } from '@playwright/test';

export async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.addInitScript((t) => localStorage.setItem('axiom-theme', t), theme);
}

/** Scrolls through the page so every whileInView reveal fires before screenshots/scans. */
export async function revealAll(page: Page) {
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

/**
 * page.goto + wait for React hydration. Interactive controls (Radix menus, controlled
 * checkboxes) ignore clicks that land before hydration, which makes tests flaky under load.
 * The navbar theme button gets its React props only once its subtree has hydrated.
 *
 * It also waits for streaming SSR to finish. React streams Suspense content into a hidden
 * staging element (`div#S:n`) and then moves it into place; until that happens the DOM briefly
 * holds two copies of the content (one hidden), and strict locators such as getByLabel (which
 * ignore visibility) match both. This was seen as a CI-only failure of the "Sort by" test.
 */
async function waitForHydrationAndStreaming(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('button[aria-label="Change theme"]');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  });
  await page.waitForFunction(() => document.querySelector('[id^="S:"]') === null);
}

export async function gotoReady(page: Page, url: string) {
  const res = await page.goto(url);
  await waitForHydrationAndStreaming(page);
  return res;
}

/** page.reload() + the same waits as gotoReady (a bare reload can still show the streaming duplicate). */
export async function reloadReady(page: Page) {
  const res = await page.reload();
  await waitForHydrationAndStreaming(page);
  return res;
}

/**
 * Waits until the page has stopped moving: no finite WAAPI animation is running AND the computed
 * transform and opacity of every element stay unchanged for several consecutive frames (Motion's
 * springs are JS-driven, so `getAnimations()` alone cannot see them). Axe samples the background
 * under each text node by on-screen position, so scanning while a sheet, menu or fade is still
 * moving can pick the wrong background and report a flaky color-contrast violation (seen in CI on
 * the mobile filter sheet, which is still sliding in when it first counts as visible). Infinite
 * animations (skeleton shimmer, ambient loops) are ignored.
 */
export async function animationsSettled(page: Page, timeoutMs = 5_000) {
  await page.evaluate(async (limit) => {
    const finite = () =>
      document
        .getAnimations()
        .every(
          (a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity,
        );
    const signature = () => {
      const parts: string[] = [];
      let i = 0;
      for (const el of document.querySelectorAll('body *')) {
        i++;
        const cs = getComputedStyle(el);
        if (
          cs.opacity !== '1' ||
          (cs.transform !== 'none' && !cs.transform.startsWith('matrix(1, 0, 0, 1, 0, 0)'))
        )
          parts.push(`${i}:${cs.transform}|${cs.opacity}`);
      }
      return parts.join(';');
    };
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const start = performance.now();
    let last = '';
    let stable = 0;
    while (performance.now() - start < limit) {
      await frame();
      const sig = signature();
      stable = finite() && sig === last ? stable + 1 : 0;
      last = sig;
      if (stable >= 6) return;
    }
    throw new Error('page did not settle: animations or transforms kept changing');
  }, timeoutMs);
}
