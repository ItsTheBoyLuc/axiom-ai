import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, reloadReady, revealAll, setTheme } from './helpers';

const SHOTS = 'test-results/screenshots';
const NEWS = '/news';
const RESEARCH = '/news?tab=research';
// Demo fixtures: 3 stories (1 official, 2 independent or research) and no research publications.
const cards = (page: import('@playwright/test').Page) => page.locator('main article');

test.describe('news', () => {
  test('lists the stories with their source labels and a link to the original', async ({
    page,
  }) => {
    await gotoReady(page, NEWS);
    await expect(
      page.getByRole('heading', { level: 1, name: 'What is being announced and published' }),
    ).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /stories/ })).toContainText(
      '3 stories',
    );
    // The official story is featured, and every card says how it was sourced.
    await expect(page.getByRole('heading', { level: 2, name: 'Featured' })).toBeVisible();
    await expect(page.getByText('Official', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Independent', { exact: true }).first()).toBeVisible();
    const link = page.getByRole('link', { name: /Read at/ }).first();
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('the tabs show counts and switch between news and research', async ({ page }) => {
    await gotoReady(page, NEWS);
    const tabs = page.getByRole('group', { name: 'Section' });
    await expect(tabs.getByRole('link', { name: /News/ })).toHaveAttribute('aria-current', 'true');
    await expect(tabs.getByRole('link', { name: /Research/ })).toContainText('0');
    await tabs.getByRole('link', { name: /Research/ }).click();
    await expect(page).toHaveURL(/tab=research/);
    await expect(page.getByText('No publications match these filters.')).toBeVisible();
  });

  test('the source chips split official announcements from independent reporting, with counts', async ({
    page,
  }) => {
    await gotoReady(page, NEWS);
    const nav = page.getByRole('navigation', { name: 'Source type' });
    await expect(nav.getByRole('link', { name: /All sources/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await nav.getByRole('link', { name: /^Official/ }).click();
    await expect(page).toHaveURL(/source=official/);
    await expect(nav.getByRole('link', { name: /^Official/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    const official = await cards(page).count();
    expect(official).toBeGreaterThan(0);
    await expect(page.getByText('Independent', { exact: true })).toHaveCount(0);
    await nav.getByRole('link', { name: /^Independent/ }).click();
    await expect(page).toHaveURL(/source=independent/);
    await expect(page.getByText('Official', { exact: true })).toHaveCount(0);
    expect(await cards(page).count()).toBeGreaterThan(0);
  });

  test('categories show how many stories each has, and an empty one says so', async ({ page }) => {
    await gotoReady(page, NEWS);
    const nav = page.getByRole('navigation', { name: 'Categories' });
    for (const c of [
      'Model releases',
      'Research',
      'Companies',
      'Infrastructure',
      'Hardware',
      'Safety',
      'Regulation',
    ]) {
      await expect(nav.getByRole('link', { name: new RegExp(`^${c}`) })).toBeVisible();
    }
    await nav.getByRole('link', { name: /^Regulation/ }).click();
    await expect(page).toHaveURL(/category=regulation/);
    await expect(page.getByText('No stories match these filters.')).toBeVisible();
    await page.getByRole('link', { name: 'Clear all filters' }).first().click();
    await expect(page.getByRole('status').filter({ hasText: /stories/ })).toContainText(
      '3 stories',
    );
  });

  test('search and provider filters narrow the stories and live in the URL', async ({ page }) => {
    await gotoReady(page, NEWS);
    await page.getByLabel('Search news').fill('official');
    await expect(page).toHaveURL(/q=official/);
    await expect(cards(page)).toHaveCount(1);
    await reloadReady(page);
    await expect(page.getByLabel('Search news')).toHaveValue('official');
    await expect(cards(page)).toHaveCount(1);
    await page.getByLabel('Provider', { exact: true }).selectOption('demo-provider-b');
    await expect(page).toHaveURL(/provider=demo-provider-b/);
    await expect(page.getByText('No stories match these filters.')).toBeVisible();
  });

  test('hostile or malformed parameters never break the page', async ({ page }) => {
    await gotoReady(page, '/news?tab=%3Cb%3E&category=x&source=rumour&provider=../x&page=-3');
    await expect(
      page.getByRole('heading', { level: 1, name: /announced and published/ }),
    ).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /stories/ })).toContainText(
      '3 stories',
    );
  });

  test('a specific filter is not indexable, the default tab is', async ({ page }) => {
    await gotoReady(page, '/news?q=official');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await gotoReady(page, NEWS);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });

  test('structured data lists the stories as news articles', async ({ page }) => {
    await gotoReady(page, NEWS);
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const data = scripts.map((s) => JSON.parse(s)).find((d) => d['@type'] === 'ItemList');
    expect(data, 'an ItemList block').toBeTruthy();
    expect(data.itemListElement.length).toBeGreaterThan(0);
    expect(data.itemListElement[0].item['@type']).toBe('NewsArticle');
  });
});

test.describe('news: mobile and motion', () => {
  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    for (const route of [NEWS, RESEARCH]) {
      test(`${route} has no horizontal page scroll`, async ({ page }) => {
        await gotoReady(page, route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
});

test.describe('news: accessibility (axe, WCAG 2.2 AA)', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const [name, route] of [
      ['news', NEWS],
      ['research', RESEARCH],
      ['filtered', '/news?source=official'],
      ['no results', '/news?category=regulation'],
    ] as const) {
      test(`axe ${name} ${theme}`, async ({ page }) => {
        await setTheme(page, theme);
        await gotoReady(page, route);
        await revealAll(page);
        await animationsSettled(page);
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

test.describe('news screenshots', () => {
  mkdirSync(SHOTS, { recursive: true });
  for (const width of [390, 768, 1440] as const) {
    test(`news ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await gotoReady(page, NEWS);
      await revealAll(page);
      await animationsSettled(page);
      await page.screenshot({ path: `${SHOTS}/news-${width}.png`, fullPage: true });
    });
  }
});
