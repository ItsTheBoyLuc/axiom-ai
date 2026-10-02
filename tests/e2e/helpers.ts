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
export async function gotoReady(page: Page, url: string) {
  const res = await page.goto(url);
  await page.waitForFunction(() => {
    const el = document.querySelector('button[aria-label="Change theme"]');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  });
  await page.waitForFunction(() => document.querySelector('[id^="S:"]') === null);
  return res;
}
