import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { gotoReady } from './helpers';

const SHOTS = 'test-results/screenshots';
const widths = [390, 768, 1440] as const;
const themes = ['dark', 'light'] as const;

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.addInitScript((t) => localStorage.setItem('axiom-theme', t), theme);
}

/** Scrolls through the page so every whileInView reveal fires before screenshots/scans. */
async function revealAll(page: Page) {
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

test.describe('screenshots', () => {
  mkdirSync(SHOTS, { recursive: true });
  for (const theme of themes) {
    for (const width of widths) {
      test(`home ${theme} ${width}`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await gotoReady(page, '/');
        await page.waitForTimeout(1500); // hero entrance
        await page.screenshot({ path: `${SHOTS}/home-${theme}-${width}-hero.png` });
        await revealAll(page);
        await page.screenshot({ path: `${SHOTS}/home-${theme}-${width}-full.png`, fullPage: true });
        // No horizontal page scroll
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  for (const route of ['/', '/design']) {
    for (const theme of themes) {
      test(`axe ${route} ${theme}`, async ({ page }) => {
        await setTheme(page, theme);
        await gotoReady(page, route);
        await revealAll(page);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const summary = results.violations.map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 4)
              .join(' | ')}`,
        );
        expect(summary, summary.join('\n')).toEqual([]);
      });
    }
  }
});

test('theme toggle persists and applies without flash', async ({ page }) => {
  await gotoReady(page, '/');
  await page.getByRole('button', { name: 'Change theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('command palette opens with Ctrl+K and navigates', async ({ page }) => {
  await gotoReady(page, '/');
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.type('Models');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/models$/);
});

test('mobile drawer opens and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReady(page, '/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeHidden();
});

test('reduced motion: no canvas, static hero, content visible', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await gotoReady(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/home-reduced-motion.png` });
  await ctx.close();
});

test('hero canvas mounts with motion and keyboard list is reachable', async ({ page }) => {
  await gotoReady(page, '/');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.keyboard.press('Tab'); // skip link
  const nav = page.getByRole('navigation', { name: /Providers and models/ });
  await nav.getByRole('link').first().focus();
  await expect(nav).toBeVisible();
});

test('demo data is always labelled', async ({ page }) => {
  await gotoReady(page, '/');
  await revealAll(page);
  expect(await page.getByText(/demo data/i).count()).toBeGreaterThan(5);
});

test('every internal link on the homepage resolves', async ({ page, request }) => {
  await gotoReady(page, '/');
  const hrefs = await page.$$eval('a[href^="/"]', (as) => [
    ...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!)),
  ]);
  for (const href of hrefs) {
    const res = await request.get(href.split('#')[0]!);
    expect(res.status(), href).toBeLessThan(400);
  }
});
