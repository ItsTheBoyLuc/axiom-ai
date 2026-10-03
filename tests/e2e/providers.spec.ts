import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, revealAll, setTheme } from './helpers';

const SHOTS = 'test-results/screenshots';
const DIRECTORY = '/providers';
// Demo fixtures: 7 providers; provider A has 5 releases, models and a news item, and no publications.
const PROFILE = '/providers/demo-provider-a';

test.describe('provider directory', () => {
  test('lists every provider as a card with its type, verification and model count', async ({
    page,
  }) => {
    await gotoReady(page, DIRECTORY);
    await expect(
      page.getByRole('heading', { level: 1, name: 'The organisations behind the models' }),
    ).toBeVisible();
    await expect(page.getByRole('status').first()).toContainText('7 providers');
    await expect(page.locator('main article')).toHaveCount(7);
    const card = page.locator('main article').filter({ hasText: 'Demo Provider A' });
    await expect(card.getByText('Company')).toBeVisible();
    await expect(card.getByText('Latest announcement')).toBeVisible();
    await expect(card.getByText(/models?/i).first()).toBeVisible();
    // Headquarters is not on record for these providers, so none is invented.
    await expect(card.getByText(/headquarters/i)).toHaveCount(0);
  });

  test('a card opens the provider profile', async ({ page }) => {
    await gotoReady(page, DIRECTORY);
    await page.getByRole('link', { name: 'Demo Provider C', exact: true }).click();
    await expect(page).toHaveURL(/\/providers\/demo-provider-c$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Demo Provider C' })).toBeVisible();
  });

  test('search narrows the list (plain form, works via the URL) and can be cleared', async ({
    page,
  }) => {
    await gotoReady(page, DIRECTORY);
    await page.getByLabel('Search providers').fill('research lab');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=research\+lab|q=research%20lab/);
    // The search also matches the organisation type; none of the fixtures is a research lab.
    await expect(page.getByText('No providers match.')).toBeVisible();
    await gotoReady(page, '/providers?q=demo');
    await expect(page.locator('main article')).toHaveCount(7);
    await gotoReady(page, '/providers?q=zzzz-nothing');
    await expect(page.getByText('No providers match.')).toBeVisible();
    await page.getByRole('link', { name: 'Clear the search' }).click();
    await expect(page.locator('main article')).toHaveCount(7);
  });

  test('the organisation-type chips filter and mark the current type', async ({ page }) => {
    await gotoReady(page, DIRECTORY);
    const nav = page.getByRole('navigation', { name: 'Organisation type' });
    await expect(nav.getByRole('link', { name: /All types/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await nav.getByRole('link', { name: /Company/ }).click();
    await expect(page).toHaveURL(/type=company/);
    await expect(nav.getByRole('link', { name: /Company/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await gotoReady(page, '/providers?type=government');
    await expect(page.getByText('No providers match.')).toBeVisible();
  });

  test('the homepage links each provider to its profile', async ({ page }) => {
    await gotoReady(page, '/');
    const view = page.getByRole('link', { name: 'View Demo Provider A' });
    await expect(view).toHaveAttribute('href', '/providers/demo-provider-a');
  });
});

test.describe('provider profile', () => {
  test('has the header, a DEMO flag and the section navigation', async ({ page }) => {
    await gotoReady(page, PROFILE);
    await expect(page.getByRole('heading', { level: 1, name: 'Demo Provider A' })).toBeVisible();
    await expect(page.locator('main header').getByText('Demo data').first()).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'On this page' });
    for (const s of [
      'Overview',
      'Models',
      'Release timeline',
      'APIs and modalities',
      'Research',
      'Announcements',
    ]) {
      await expect(nav.getByRole('link', { name: s })).toBeVisible();
    }
    await nav.getByRole('link', { name: 'Release timeline' }).click();
    await expect(nav.getByRole('link', { name: 'Release timeline' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });

  test('the overview counts models and releases', async ({ page }) => {
    await gotoReady(page, PROFILE);
    const overview = page.locator('#overview');
    await expect(overview.getByText('Releases on record')).toBeVisible();
    await expect(overview.locator('dd').nth(1)).toHaveText('5');
  });

  test('the model portfolio filters by text, and cards keep their comparison control', async ({
    page,
  }) => {
    await gotoReady(page, PROFILE);
    const portfolio = page.locator('#models');
    const total = await portfolio.locator('article').count();
    expect(total).toBeGreaterThan(1);
    await portfolio.getByLabel('Search this portfolio').fill('zzzz-none');
    await expect(portfolio.getByText('No models match these filters.')).toBeVisible();
    await portfolio.getByRole('button', { name: 'Clear filters' }).click();
    await expect(portfolio.locator('article')).toHaveCount(total);
    await expect(
      portfolio.getByRole('button', { name: /^Add to comparison/ }).first(),
    ).toBeVisible();
  });

  test('the release timeline marks every release, links markers to entries and labels confirmation', async ({
    page,
  }) => {
    await gotoReady(page, PROFILE);
    const chart = page.locator('#releases figure');
    await expect(chart.getByRole('group', { name: /Timeline of 5 releases/ })).toBeVisible();
    const markers = chart.locator('svg a');
    await expect(markers).toHaveCount(5);
    await expect(markers.first()).toHaveAttribute('aria-label', /unconfirmed/);
    await expect(
      chart.getByRole('list', { name: 'Legend' }).getByText('Outlined = unconfirmed'),
    ).toBeVisible();
    // A marker jumps to its entry in the list below.
    const href = await markers.first().getAttribute('href');
    await markers.first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator(`${href}`)).toBeVisible();
    await expect(page.locator('#releases ol > li')).toHaveCount(5);
  });

  test("says plainly when there are no publications, and shows the provider's news with labels", async ({
    page,
  }) => {
    await gotoReady(page, PROFILE);
    await expect(
      page.locator('#research').getByText('No publications on record yet.'),
    ).toBeVisible();
    const news = page.locator('#announcements');
    await expect(news.getByText('Official', { exact: true })).toBeVisible();
    await expect(news.getByRole('link', { name: /Read at/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  test('access and modalities summarise how the models are reached', async ({ page }) => {
    await gotoReady(page, PROFILE);
    const access = page.locator('#access');
    await expect(access.getByRole('heading', { name: 'Access' })).toBeVisible();
    await expect(access.getByRole('heading', { name: 'Supported modalities' })).toBeVisible();
    await expect(access.getByText('Text').first()).toBeVisible();
  });

  test('an unknown provider is a 404', async ({ page }) => {
    const res = await page.goto('/providers/no-such-provider');
    expect(res?.status()).toBe(404);
  });
});

test.describe('providers: mobile and motion', () => {
  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    for (const route of [DIRECTORY, PROFILE]) {
      test(`${route} has no horizontal page scroll`, async ({ page }) => {
        await gotoReady(page, route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }

    test('the release timeline chart scrolls inside its own region instead of shrinking', async ({
      page,
    }) => {
      await gotoReady(page, PROFILE);
      const region = page.getByRole('region', { name: 'Release timeline chart' });
      expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('hydrates without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await gotoReady(page, PROFILE);
      await expect(page.getByRole('heading', { level: 1, name: 'Demo Provider A' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
});

test.describe('providers: accessibility (axe, WCAG 2.2 AA)', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const [name, route] of [
      ['directory', DIRECTORY],
      ['no results', '/providers?q=zzzz-nothing'],
      ['profile', PROFILE],
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

test.describe('providers screenshots', () => {
  mkdirSync(SHOTS, { recursive: true });
  for (const width of [390, 768, 1440] as const) {
    for (const [name, route] of [
      ['directory', DIRECTORY],
      ['profile', PROFILE],
    ] as const) {
      test(`providers ${name} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await gotoReady(page, route);
        await revealAll(page);
        await animationsSettled(page);
        await page.screenshot({ path: `${SHOTS}/providers-${name}-${width}.png`, fullPage: true });
      });
    }
  }
});
