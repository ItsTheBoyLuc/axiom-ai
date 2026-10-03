import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, revealAll, setTheme } from './helpers';

const SHOTS = 'test-results/screenshots';
const INDEX = '/benchmarks';
// Demo fixtures: 8 results from 7 models and 5 providers, with independent and provider-reported mixed.
const DETAIL = '/benchmarks?benchmark=sample-benchmark-1';
const resultsTable = (page: Page) => page.getByRole('region', { name: 'Benchmark results table' });
const dataRows = (page: Page) => resultsTable(page).locator('tbody tr');

/** Charts are client-only chunks: wait until the first one has drawn. */
async function chartsReady(page: Page) {
  await expect(page.getByRole('img', { name: /^Latest result per model/ })).toBeVisible();
}

test.describe('benchmark index', () => {
  test('shows the catalogue totals, categories and one card per benchmark', async ({ page }) => {
    await gotoReady(page, INDEX);
    await expect(page.getByRole('heading', { level: 1, name: 'Benchmark explorer' })).toBeVisible();
    const totals = page.getByRole('region', { name: 'Benchmark catalogue totals' });
    await expect(totals.getByText('Independently evaluated')).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Benchmark categories' });
    await expect(nav.getByRole('link', { name: /All categories/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    for (let i = 1; i <= 5; i++) {
      await expect(
        page.getByRole('link', { name: new RegExp(`Sample Benchmark ${i}`) }),
      ).toBeVisible();
    }
    // Every card says how much data stands behind it and how it was evaluated.
    const card = page.getByRole('link', { name: /Sample Benchmark 1/ });
    await expect(card).toContainText(/\d+ results?/);
    await expect(card).toContainText('Independently evaluated');
    await expect(card).toContainText('Provider reported');
  });

  test('a category narrows the index and is kept in the URL', async ({ page }) => {
    await gotoReady(page, INDEX);
    await page
      .getByRole('navigation', { name: 'Benchmark categories' })
      .getByRole('link', { name: /Coding/ })
      .click();
    await expect(page).toHaveURL(/category=coding$/);
    await expect(page.getByRole('link', { name: /Sample Benchmark 2/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sample Benchmark 1/ })).toHaveCount(0);
    // The category survives reload.
    await page.reload();
    await expect(page.getByRole('link', { name: /Coding/ }).first()).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('a card opens that benchmark', async ({ page }) => {
    await gotoReady(page, INDEX);
    await page.getByRole('link', { name: /Sample Benchmark 1/ }).click();
    await expect(page).toHaveURL(/benchmark=sample-benchmark-1$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Sample Benchmark 1' })).toBeVisible();
    await page.getByRole('link', { name: 'All benchmarks' }).click();
    await expect(page.getByRole('navigation', { name: 'Benchmark categories' })).toBeVisible();
  });

  test('an unknown benchmark is reported and the index still works', async ({ page }) => {
    await gotoReady(page, '/benchmarks?benchmark=no-such-benchmark');
    await expect(page.locator('p[role="alert"]')).toContainText('Benchmark not found');
    await expect(page.getByRole('link', { name: /Sample Benchmark 1/ })).toBeVisible();
  });

  test('hostile or malformed parameters never break the page', async ({ page }) => {
    await gotoReady(page, '/benchmarks?category=%3Cscript%3E&benchmark=../x&from=nope&type=ZZZ');
    await expect(page.getByRole('heading', { level: 1, name: 'Benchmark explorer' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sample Benchmark 1/ })).toBeVisible();
  });
});

test.describe('benchmark detail', () => {
  test('shows what the benchmark is, its methodology and the evaluation mix', async ({ page }) => {
    await gotoReady(page, DETAIL);
    await expect(page.getByRole('heading', { level: 2, name: 'Sample Benchmark 1' })).toBeVisible();
    await expect(page.getByText(/Compare scores only within the same benchmark/)).toBeVisible();
    await expect(page.getByText('Methodology').first()).toBeVisible();
    await expect(page.getByText(/8 results from 7 models/)).toBeVisible();
    await expect(page.getByText(/There is no combined score/)).toBeVisible();
  });

  test('every result row carries its evaluation type, date, versions, methodology and source', async ({
    page,
  }) => {
    await gotoReady(page, DETAIL);
    const table = resultsTable(page);
    for (const h of [
      'Model',
      'Score',
      'Evaluation',
      'Evaluated',
      'Model version',
      'Benchmark version',
      'Methodology',
      'Source',
    ]) {
      await expect(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
    }
    await expect(dataRows(page)).toHaveCount(8);
    await expect(table.getByText('Independently evaluated').first()).toBeVisible();
    await expect(table.getByText('Provider reported').first()).toBeVisible();
  });

  test('draws the four views, each with a table view and CSV', async ({ page }) => {
    await gotoReady(page, DETAIL);
    await chartsReady(page);
    for (const name of [
      'Latest result per model',
      'Scores over time',
      'Score distribution',
      'Provider comparison',
    ]) {
      await expect(page.getByRole('figure').filter({ hasText: name }).first()).toBeVisible();
    }
    const figure = page.getByRole('figure').filter({ hasText: 'Score distribution' });
    await figure.getByRole('button', { name: 'Table view' }).click();
    await expect(figure.getByRole('table')).toBeVisible();
    const download = page.waitForEvent('download');
    await figure.getByRole('button', { name: 'CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  });

  test('bars are ordered by provider and name, never by score', async ({ page }) => {
    await gotoReady(page, DETAIL);
    await chartsReady(page);
    const summary = await page
      .getByRole('img', { name: /^Latest result per model/ })
      .getAttribute('aria-label');
    const names = [...summary!.matchAll(/(Sample Model \d+)/g)].map((m) => m[1]);
    // Provider A (model 1), B (2, 16), C (3), D (4, 11), E (5) with one latest bar per model.
    expect(names).toEqual([
      'Sample Model 1',
      'Sample Model 16',
      'Sample Model 2',
      'Sample Model 3',
      'Sample Model 11',
      'Sample Model 4',
      'Sample Model 5',
    ]);
  });

  test('sorting the table is a view choice only', async ({ page }) => {
    await gotoReady(page, DETAIL);
    const firstRow = () => dataRows(page).first().getByRole('rowheader').innerText();
    await page.getByLabel('Sort by', { exact: true }).selectOption('score-desc');
    expect(await firstRow()).toContain('Sample Model 11'); // 85%
    await page.getByLabel('Sort by', { exact: true }).selectOption('score-asc');
    expect(await firstRow()).toContain('Sample Model 3'); // 55%, the lowest
  });
});

test.describe('benchmark filters', () => {
  test('provider filter narrows table and charts and lives in the URL', async ({ page }) => {
    await gotoReady(page, DETAIL);
    await page.getByLabel('Provider', { exact: true }).selectOption('demo-provider-b');
    await expect(page).toHaveURL(/provider=demo-provider-b/);
    await expect(dataRows(page)).toHaveCount(3);
    await page.reload();
    await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('demo-provider-b');
    await expect(dataRows(page)).toHaveCount(3);
  });

  test('evaluation type filter separates independent from provider-reported', async ({ page }) => {
    await gotoReady(page, DETAIL);
    await page.getByLabel('Evaluation type', { exact: true }).selectOption('INDEPENDENT');
    await expect(dataRows(page)).toHaveCount(2);
    await expect(resultsTable(page).getByText('Provider reported')).toHaveCount(0);
    await page.getByLabel('Evaluation type', { exact: true }).selectOption('PROVIDER_REPORTED');
    await expect(dataRows(page)).toHaveCount(6);
    await expect(
      page.getByText(/Every result shown was reported by the model.s own provider/),
    ).toBeVisible();
  });

  test('family, model version and date range filters work together', async ({ page }) => {
    await gotoReady(page, DETAIL);
    await page.getByLabel('Model family', { exact: true }).selectOption('Sample Family W');
    await expect(dataRows(page)).toHaveCount(2);
    await page.getByLabel('Model version', { exact: true }).selectOption('3.5');
    await expect(dataRows(page)).toHaveCount(1);
    await page.getByLabel('Model version', { exact: true }).selectOption('');
    await page.getByLabel('Evaluated from', { exact: true }).fill('2026-08-01');
    await expect(dataRows(page)).toHaveCount(1);
    await expect(page).toHaveURL(/from=2026-08-01/);
  });

  test('a filter with no match says so and "Clear all filters" restores everything', async ({
    page,
  }) => {
    await gotoReady(page, `${DETAIL}&provider=demo-provider-a&type=INDEPENDENT`);
    await expect(page.getByText('No results match these filters.')).toBeVisible();
    await page.getByRole('link', { name: 'Clear all filters' }).first().click();
    await expect(page).toHaveURL(/benchmark=sample-benchmark-1$/);
    await expect(dataRows(page)).toHaveCount(8);
  });

  test('a benchmark with too little data explains why a chart is missing', async ({ page }) => {
    // Benchmark 5 has fewer than five models and a single provider: no distribution or provider comparison.
    await gotoReady(page, '/benchmarks?benchmark=sample-benchmark-5');
    await expect(page.getByText(/A distribution needs at least 5 models/)).toBeVisible();
    await expect(page.getByText(/Needs results from at least two providers/)).toBeVisible();
  });
});

test.describe('benchmark explorer: mobile and motion', () => {
  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    for (const route of [INDEX, DETAIL]) {
      test(`${route} has no horizontal page scroll`, async ({ page }) => {
        await gotoReady(page, route);
        if (route === DETAIL) await chartsReady(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('hydrates without errors and renders fully', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await gotoReady(page, DETAIL);
      await chartsReady(page);
      await expect(resultsTable(page)).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
});

test.describe('benchmark explorer: accessibility (axe, WCAG 2.2 AA)', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const [name, route] of [
      ['index', INDEX],
      ['detail', DETAIL],
      ['filtered detail', `${DETAIL}&provider=demo-provider-b`],
    ] as const) {
      test(`axe ${name} ${theme}`, async ({ page }) => {
        await setTheme(page, theme);
        await gotoReady(page, route);
        if (route !== INDEX) await chartsReady(page);
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

test.describe('benchmark screenshots', () => {
  mkdirSync(SHOTS, { recursive: true });
  for (const width of [390, 768, 1440] as const) {
    for (const [name, route] of [
      ['index', INDEX],
      ['detail', DETAIL],
    ] as const) {
      test(`benchmarks ${name} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await gotoReady(page, route);
        if (route === DETAIL) await chartsReady(page);
        await revealAll(page);
        await animationsSettled(page);
        await page.screenshot({ path: `${SHOTS}/benchmarks-${name}-${width}.png`, fullPage: true });
      });
    }
  }
});
