import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, revealAll, setTheme } from './helpers';

const SHOTS = 'test-results/screenshots';
const THREE = '/compare?models=sample-model-1,sample-model-2,sample-model-3';
const table = (page: Page) => page.getByRole('region', { name: 'Comparison table' });

/** Charts are client-only chunks: wait until the first one has drawn. */
async function chartsReady(page: Page) {
  await expect(page.getByRole('img', { name: /^Context window/ })).toBeVisible();
}

test.describe('compare page', () => {
  test('a shared URL renders the table with one column per model', async ({ page }) => {
    await gotoReady(page, THREE);
    await expect(page.getByRole('heading', { level: 1, name: 'Compare models' })).toBeVisible();
    const t = table(page);
    for (const name of ['Sample Model 1', 'Sample Model 2', 'Sample Model 3']) {
      await expect(t.getByRole('link', { name, exact: true })).toBeVisible();
    }
    for (const group of ['General', 'Technical', 'Performance', 'Pricing', 'Availability']) {
      await expect(t.getByRole('columnheader', { name: group })).toBeVisible();
    }
    // Missing data is explicit, never blank or zero.
    await expect(t.getByText('Not publicly disclosed').first()).toBeVisible();
    // Benchmarks are separate rows: there is no combined score anywhere.
    await expect(page.getByText(/overall score|average score/i)).toHaveCount(0);
  });

  test('highlight differences labels differing rows with text', async ({ page }) => {
    await gotoReady(page, THREE);
    await expect(table(page).getByText('Differs')).toHaveCount(0);
    await page.getByRole('button', { name: 'Highlight differences' }).click();
    await expect(page.getByRole('button', { name: 'Highlight differences' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(table(page).getByText('Differs').first()).toBeVisible();
  });

  test('"shared benchmarks only" hides benchmarks that only one model has', async ({ page }) => {
    await gotoReady(page, THREE);
    const before = await table(page).getByRole('rowheader').count();
    await page.getByRole('button', { name: 'Shared benchmarks only' }).click();
    const after = await table(page).getByRole('rowheader').count();
    expect(after).toBeLessThan(before);
  });

  test('adding and removing models changes the URL', async ({ page }) => {
    await gotoReady(page, '/compare?models=sample-model-1,sample-model-2');
    // Two models selected: the picker starts collapsed.
    const toggle = page.getByRole('button', { name: 'Add or change models' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await page.getByLabel('Search models').fill('Sample Model 3');
    await page.getByRole('button', { name: 'Add Sample Model 3 to the comparison' }).click();
    await expect(page).toHaveURL(/models=sample-model-1,sample-model-2,sample-model-3$/);
    await expect(
      table(page).getByRole('link', { name: 'Sample Model 3', exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Remove Sample Model 1 from the comparison' }).click();
    await expect(page).toHaveURL(/models=sample-model-2,sample-model-3$/);
    await expect(
      table(page).getByRole('link', { name: 'Sample Model 1', exact: true }),
    ).toHaveCount(0);
  });

  test('a fifth model is refused, with the reason shown', async ({ page }) => {
    await gotoReady(
      page,
      '/compare?models=sample-model-1,sample-model-2,sample-model-3,sample-model-4',
    );
    await page.getByRole('button', { name: 'Add or change models' }).click();
    await expect(page.getByText(/the maximum\. Remove one to add another/)).toBeVisible();
    await page.getByLabel('Search models').fill('Sample Model 5');
    const add = page.getByRole('button', { name: 'Add Sample Model 5 to the comparison' });
    await expect(add).toBeDisabled();
  });

  test('provider and category filters narrow the picker', async ({ page }) => {
    await gotoReady(page, '/compare');
    await expect(page.getByText(/models? shown/)).toBeVisible();
    await page.getByLabel('Category').selectOption('image-generation');
    await expect(page.getByText(/models? shown|No models match/)).toBeVisible();
    await page.getByLabel('Search models').fill('zzzz-no-such-model');
    await expect(page.getByText('No models match these filters.')).toBeVisible();
  });

  test('unknown and malformed slugs are reported, not fatal', async ({ page }) => {
    await gotoReady(page, '/compare?models=sample-model-1,no-such-model,../x');
    // Next.js has its own role=alert route announcer, so target ours by its text.
    await expect(page.locator('p[role="alert"]')).toContainText('no-such-model');
    await expect(page.getByRole('status').filter({ hasText: 'Ignored in the link' })).toContainText(
      '../x',
    );
    await expect(
      table(page).getByRole('link', { name: 'Sample Model 1', exact: true }),
    ).toBeVisible();
    // Only one model is left, so the page says another is needed instead of drawing charts.
    await expect(page.getByText('Add a second model to compare')).toBeVisible();
  });

  test('an empty page invites a selection and has no table', async ({ page }) => {
    await gotoReady(page, '/compare');
    await expect(page.getByText(/No models selected yet/)).toBeVisible();
    await expect(table(page)).toHaveCount(0);
  });

  test('copy link puts the shareable URL on the clipboard', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoReady(page, THREE);
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/\/compare\?models=sample-model-1,sample-model-2,sample-model-3$/);
  });

  test('CSV export downloads one column per model', async ({ page }) => {
    await gotoReady(page, THREE);
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
      /^axiom-compare-sample-model-1-sample-model-2-sample-model-3\.csv$/,
    );
    const res = await page.request.get(
      '/api/v1/compare/export.csv?models=sample-model-1,sample-model-2,sample-model-3',
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    const header = (await res.text()).split('\r\n')[0];
    expect(header).toBe('Attribute,Sample Model 1,Sample Model 2,Sample Model 3');
  });

  test('charts have units, a table view and a CSV download', async ({ page }) => {
    await gotoReady(page, THREE);
    await chartsReady(page);
    await expect(page.getByRole('heading', { name: 'Charts' })).toBeVisible();
    // The benchmark chart is one benchmark at a time, chosen explicitly.
    await expect(page.getByLabel('Benchmark', { exact: true })).toBeVisible();
    const figure = page.getByRole('figure').filter({ hasText: 'Context window' });
    await expect(figure.getByText('(tokens)')).toBeVisible();
    await figure.getByRole('button', { name: 'Table view' }).click();
    await expect(figure.getByRole('table')).toBeVisible();
    const download = page.waitForEvent('download');
    await figure.getByRole('button', { name: 'CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
    // No radar here: the fixtures share fewer than three benchmarks, and the page says why.
    await expect(page.getByText(/A radar needs at least 3 benchmarks/)).toBeVisible();
  });

  test('the comparison tray follows the URL and is hidden on /compare', async ({ page }) => {
    await gotoReady(page, '/compare?models=sample-model-1,sample-model-2');
    await expect(page.getByRole('complementary', { name: 'Comparison tray' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Models', exact: true }).first().click();
    await expect(page).toHaveURL(/\/models/);
    await expect(page.getByRole('complementary', { name: 'Comparison tray' })).toContainText('2/4');
  });

  test('recent comparisons are remembered and reopen the same set', async ({ page }) => {
    await gotoReady(page, '/compare?models=sample-model-1,sample-model-2');
    await gotoReady(page, '/compare');
    const recent = page.getByRole('link', { name: 'Sample Model 1 vs Sample Model 2' });
    await expect(recent).toBeVisible();
    await recent.click();
    await expect(page).toHaveURL(/models=sample-model-1,sample-model-2$/);
    // The picker stays open after following a history link from the empty page.
    await page.getByRole('button', { name: 'Clear history' }).click();
    await expect(page.getByRole('link', { name: 'Sample Model 1 vs Sample Model 2' })).toHaveCount(
      0,
    );
  });

  test('recently viewed models can be added in one click', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-3');
    await gotoReady(page, '/compare?models=sample-model-1,sample-model-2');
    await page.getByRole('button', { name: 'Add or change models' }).click();
    const recent = page.getByRole('heading', { name: 'Recently viewed' });
    await expect(recent).toBeVisible();
    await page
      .getByRole('list')
      .filter({ has: page.getByRole('button', { name: 'Add Sample Model 3 to the comparison' }) })
      .last()
      .getByRole('button', { name: 'Add Sample Model 3 to the comparison' })
      .click();
    await expect(page).toHaveURL(/models=sample-model-1,sample-model-2,sample-model-3$/);
  });

  test('a specific comparison is not indexable, the bare page is', async ({ page }) => {
    await gotoReady(page, THREE);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await gotoReady(page, '/compare');
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });

  test('the whole flow from the directory tray to a shared comparison works', async ({ page }) => {
    await gotoReady(page, '/models');
    for (let i = 0; i < 2; i++) {
      await page
        .getByRole('button', { name: /^Add to comparison/ })
        .first()
        .click();
    }
    const tray = page.getByRole('complementary', { name: 'Comparison tray' });
    await tray.getByRole('link', { name: 'Compare' }).click();
    await expect(page).toHaveURL(/\/compare\?models=/);
    await expect(table(page)).toBeVisible();
    await expect(table(page).locator('th[scope="col"]')).toHaveCount(3);
  });
});

test.describe('compare page: mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('has no horizontal page scroll, and the table scrolls inside its own region', async ({
    page,
  }) => {
    await gotoReady(page, THREE);
    await chartsReady(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const region = table(page);
    const scrolls = await region.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(true);
  });
});

test.describe('compare page: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('renders fully and hydrates without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await gotoReady(page, THREE);
    await chartsReady(page);
    await expect(table(page)).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('compare page: accessibility (axe, WCAG 2.2 AA)', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const [name, route] of [
      ['three models', THREE],
      ['empty', '/compare'],
    ] as const) {
      test(`axe ${name} ${theme}`, async ({ page }) => {
        await setTheme(page, theme);
        await gotoReady(page, route);
        if (route === THREE) {
          await chartsReady(page);
          await page.getByRole('button', { name: 'Highlight differences' }).click();
        }
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

test.describe('compare screenshots', () => {
  mkdirSync(SHOTS, { recursive: true });
  for (const width of [390, 768, 1440] as const) {
    test(`compare ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await gotoReady(page, THREE);
      await chartsReady(page);
      await revealAll(page);
      await animationsSettled(page);
      await page.screenshot({ path: `${SHOTS}/compare-${width}.png`, fullPage: true });
    });
  }
});
