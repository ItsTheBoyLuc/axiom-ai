import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, revealAll, setTheme } from './helpers';

const SHOTS = 'test-results/screenshots';
mkdirSync(SHOTS, { recursive: true });

const cards = (page: Page) => page.locator('#results article');
const search = (page: Page) => page.getByRole('combobox', { name: 'Search models' });
const countText = (page: Page) => page.locator('#results').getByRole('status');
const names = async (page: Page) =>
  (await cards(page).getByRole('heading', { level: 3 }).allInnerTexts()).map((s) => s.trim());

test.describe('directory: browse, filter, URL state', () => {
  test('lists models with a count, pagination and demo labelling', async ({ page }) => {
    await gotoReady(page, '/models');
    await expect(page.getByRole('heading', { level: 1, name: 'AI models' })).toBeVisible();
    await expect(cards(page)).toHaveCount(9);
    await expect(countText(page)).toContainText('16 models');
    await expect(countText(page)).toContainText('page 1 of 2');
    await expect(page.getByText(/^Demo data\./)).toBeVisible();
    // No overall ranking anywhere.
    await expect(page.getByText(/rank(ed|ing)?\s*#?\d+|#\d+ overall/i)).toHaveCount(0);
    await expect(page.getByText(/overall score/i)).toHaveCount(0);
  });

  test('a filter updates the URL, the results, survives reload and the back button', async ({
    page,
  }) => {
    await gotoReady(page, '/models');
    await page.getByRole('checkbox', { name: /^Coding/ }).check();
    await expect(page).toHaveURL(/category=coding/);
    await expect(countText(page)).toContainText('4 models');
    await expect(page.getByRole('group', { name: 'Active filters' })).toContainText(
      'Category: Coding',
    );

    await page.reload();
    await expect(page.getByRole('checkbox', { name: /^Coding/ })).toBeChecked();
    await expect(countText(page)).toContainText('4 models');

    await page.goBack();
    await expect(page).not.toHaveURL(/category=/);
    await expect(countText(page)).toContainText('16 models');
    await expect(page.getByRole('checkbox', { name: /^Coding/ })).not.toBeChecked();
    await page.goForward();
    await expect(countText(page)).toContainText('4 models');
  });

  test('multi-select ORs within a group and ANDs across groups', async ({ page }) => {
    await gotoReady(page, '/models?category=embedding,video-generation');
    await expect(countText(page)).toContainText('2 models');
    // Groups without a selection start collapsed (except Provider and Category).
    await page.getByRole('button', { name: /^Pricing/ }).click();
    await page.getByRole('checkbox', { name: /^Free tier/ }).check();
    // embedding is paid and video is custom: no model is both, so the AND is empty.
    await expect(page.getByRole('heading', { name: 'No models match' })).toBeVisible();
  });

  test('shareable URL restores the whole view', async ({ page }) => {
    await gotoReady(page, '/models?category=coding&deployment=local&sort=alpha');
    await expect(cards(page)).toHaveCount(1);
    expect(await names(page)).toEqual(['Sample Model 3']);
    await expect(page.getByRole('checkbox', { name: /^Local deployment/ })).toBeChecked();
    await expect(page.getByLabel('Sort by')).toHaveValue('alpha');
  });

  test('"Other" provider bucket groups non-listed providers', async ({ page }) => {
    await gotoReady(page, '/models');
    await page.getByRole('checkbox', { name: /^Other/ }).check();
    await expect(page).toHaveURL(/provider=other/);
    await expect(countText(page)).toContainText('2 models');
  });

  test('groups: Provider and Category start open, the rest collapsed unless they have a selection', async ({
    page,
  }) => {
    await gotoReady(page, '/models');
    const expanded = async (name: RegExp) =>
      page.getByRole('button', { name }).getAttribute('aria-expanded');
    expect(await expanded(/^Provider/)).toBe('true');
    expect(await expanded(/^Category/)).toBe('true');
    expect(await expanded(/^Capabilities/)).toBe('false');
    expect(await expanded(/^Deployment/)).toBe('false');
    expect(await expanded(/^Pricing/)).toBe('false');

    await gotoReady(page, '/models?pricing=free&capability=reasoning');
    expect(await expanded(/^Pricing/)).toBe('true');
    expect(await expanded(/^Capabilities/)).toBe('true');
    expect(await expanded(/^Deployment/)).toBe('false');
  });

  test('desktop can hide and show the filter sidebar', async ({ page }) => {
    await gotoReady(page, '/models');
    const sidebar = page.getByRole('region', { name: 'Filters' });
    await expect(sidebar).toBeVisible();
    await page.getByRole('button', { name: 'Hide filters' }).click();
    await expect(sidebar).toBeHidden();
    await page.getByRole('button', { name: 'Show filters' }).click();
    await expect(sidebar).toBeVisible();
  });

  test('chips remove single filters and Clear all resets everything', async ({ page }) => {
    await gotoReady(page, '/models?category=coding&pricing=free&q=sample');
    const chips = page.getByRole('group', { name: 'Active filters' });
    await expect(chips).toContainText('Search: “sample”');
    await chips.getByRole('button', { name: /Remove filter Pricing: Free/ }).click();
    await expect(page).not.toHaveURL(/pricing=/);
    await chips.getByRole('button', { name: 'Clear all' }).click();
    await expect(page).toHaveURL(/\/models$/);
    await expect(countText(page)).toContainText('16 models');
    await expect(search(page)).toHaveValue('');
  });

  test('empty state offers a way out', async ({ page }) => {
    await gotoReady(page, '/models?q=zzzzqq');
    await expect(page.getByRole('heading', { name: 'No models match' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search and filters' }).click();
    await expect(countText(page)).toContainText('16 models');
  });

  test('invalid or hostile params fall back to safe defaults', async ({ page }) => {
    const res = await gotoReady(
      page,
      '/models?category=nope&page=abc&sort=xyz&pageSize=99999&q=%3Cscript%3E',
    );
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'AI models' })).toBeVisible();
    await expect(page.locator('#results script')).toHaveCount(0);
  });

  test('pagination uses links, keeps the query and clamps out-of-range pages', async ({ page }) => {
    await gotoReady(page, '/models');
    await page.getByRole('link', { name: 'Page 2' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cards(page)).toHaveCount(7);
    await expect(page.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await gotoReady(page, '/models?page=99');
    await expect(countText(page)).toContainText('page 2 of 2');
  });
});

test.describe('directory: search and sort', () => {
  test('typing filters as you type and writes ?q= to the URL', async ({ page }) => {
    await gotoReady(page, '/models');
    await search(page).pressSequentially('embedding', { delay: 20 });
    await expect(page).toHaveURL(/q=embedding/);
    await expect(cards(page)).toHaveCount(1);
    expect(await names(page)).toEqual(['Sample Model 10']);
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(countText(page)).toContainText('16 models');
  });

  test('suggestions: keyboard navigation and Enter opens the model', async ({ page }) => {
    await gotoReady(page, '/models');
    const box = search(page);
    await box.pressSequentially('video', { delay: 20 });
    const list = page.getByRole('listbox', { name: 'Model suggestions' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('option').first()).toContainText('Sample Model 9');
    await box.press('ArrowDown');
    await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/models\/sample-model-9$/);
  });

  test('suggestions highlight the matched text', async ({ page }) => {
    await gotoReady(page, '/models');
    await search(page).pressSequentially('audio', { delay: 20 });
    await expect(page.getByRole('listbox').locator('mark').first()).toBeVisible();
  });

  test('sort options reorder results server-side and persist in the URL', async ({ page }) => {
    await gotoReady(page, '/models');
    await page.getByLabel('Sort by').selectOption({ label: 'Alphabetical' });
    await expect(page).toHaveURL(/sort=alpha/);
    expect((await names(page))[0]).toBe('Sample Model 1');

    await page.getByLabel('Sort by').selectOption({ label: 'Context window' });
    await expect(page).toHaveURL(/sort=context/);
    expect((await names(page))[0]).toBe('Sample Model 4'); // 1M tokens
  });

  test('sorting by ONE benchmark shows that score and says it is not an overall ranking', async ({
    page,
  }) => {
    await gotoReady(page, '/models');
    await page.getByLabel('Sort by').selectOption({ label: 'Benchmark score (pick one)' });
    await expect(page).toHaveURL(/sort=benchmark/);
    await expect(page).toHaveURL(/benchmark=sample-benchmark-1/);
    await expect(page.getByText(/never combined into an overall ranking/)).toBeVisible();
    expect((await names(page))[0]).toBe('Sample Model 11'); // 85%
    await expect(cards(page).first()).toContainText('Sample Benchmark 1:');
    await expect(cards(page).first()).toContainText('85%');

    await page.getByLabel('Benchmark', { exact: true }).selectOption('sample-benchmark-2');
    await expect(page).toHaveURL(/benchmark=sample-benchmark-2/);
    expect((await names(page))[0]).toBe('Sample Model 11'); // 79% (provider reported)
  });
});

test.describe('comparison tray', () => {
  test('holds up to 4, refuses a 5th, persists across pages and reloads', async ({ page }) => {
    await gotoReady(page, '/models');
    for (let i = 0; i < 4; i++) {
      await page
        .getByRole('button', { name: /^Add to comparison/ })
        .first()
        .click();
    }
    const tray = page.getByRole('complementary', { name: 'Comparison tray' });
    await expect(tray).toContainText('4/4');
    await expect(page.getByRole('button', { name: /^Add to comparison/ }).first()).toBeDisabled();

    // Center the link first: the fixed navbar and tray can otherwise cover it.
    const view = page.getByRole('link', { name: /^View Sample Model/ }).first();
    await view.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await view.click();
    await expect(page).toHaveURL(/\/models\//);
    await expect(tray).toContainText('4/4');
    await page.reload();
    await expect(tray).toContainText('4/4');

    const href = await tray.getByRole('link', { name: 'Compare' }).getAttribute('href');
    expect(href).toMatch(/^\/compare\?models=([a-z0-9-]+,){3}[a-z0-9-]+$/);
    await tray.getByRole('link', { name: 'Compare' }).click();
    await expect(page).toHaveURL(/\/compare\?models=/);
    await expect(page.getByText('Not built yet')).toBeVisible();
  });

  test('removing and clearing works', async ({ page }) => {
    await gotoReady(page, '/models');
    await page
      .getByRole('button', { name: /^Add to comparison/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /^Add to comparison/ })
      .first()
      .click();
    const tray = page.getByRole('complementary', { name: 'Comparison tray' });
    await expect(tray).toContainText('2/4');
    await tray
      .getByRole('button', { name: /^Remove/ })
      .first()
      .click();
    await expect(tray).toContainText('1/4');
    await expect(tray.getByText('Select 2 or more')).toBeVisible();
    await tray.getByRole('button', { name: 'Clear' }).click();
    await expect(tray).toHaveCount(0);
  });

  test('a profile can add itself to the comparison', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-1');
    // Scope to the profile header: related-model cards have their own compare buttons.
    const header = page.locator('main header');
    await header.getByRole('button', { name: /^Add to comparison/ }).click();
    await expect(page.getByRole('complementary', { name: 'Comparison tray' })).toContainText(
      'Sample Model 1',
    );
    await expect(header.getByRole('button', { name: /^In comparison/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('model profile', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('has every required section, a sticky nav and breadcrumbs', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-2');
    await expect(page.getByRole('heading', { level: 1, name: 'Sample Model 2' })).toBeVisible();
    for (const h of [
      'Overview',
      'Technical specifications',
      'Pricing',
      'Capabilities matrix',
      'Benchmarks',
      'Release history',
      'Related models',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    }
    const nav = page.getByRole('navigation', { name: 'On this page' });
    await expect(nav.getByRole('link')).toHaveCount(7);
    await nav.getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL(/#pricing$/);
    await expect(nav.getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'aria-current',
      'location',
    );

    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('link', { name: 'Models' })).toHaveAttribute('href', '/models');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Sample Model 2');
  });

  test('pricing labels current vs historical and the cost estimator computes', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-2');
    const pricing = page.locator('#pricing');
    await expect(pricing.getByRole('cell', { name: /Historical/ }).first()).toBeVisible();
    await expect(pricing.getByRole('cell', { name: /Current/ }).first()).toBeVisible();
    // default workload: 1,000,000 in x $2 + 250,000 out x $8 = $4.00
    await expect(pricing.getByTestId('estimate-total')).toHaveText('$4.00');
    await pricing.getByLabel('Input tokens', { exact: true }).fill('3000000');
    await expect(pricing.getByTestId('estimate-total')).toHaveText('$8.00');
    await pricing.getByLabel('Input tokens', { exact: true }).fill('nope');
    await expect(pricing.getByText(/non-negative token counts/)).toBeVisible();
  });

  test('capabilities matrix shows evidence or "No verified data", never invented scores', async ({
    page,
  }) => {
    await gotoReady(page, '/models/sample-model-2');
    const matrix = page.locator('#capabilities');
    await expect(matrix.getByRole('row', { name: /Reasoning/ })).toContainText(
      'Sample Benchmark 1',
    );
    await expect(matrix.getByRole('row', { name: /Creative writing/ })).toContainText(
      'No verified data',
    );
    await expect(matrix.getByRole('row', { name: /Coding/ })).toContainText('No verified data');
  });

  test('benchmarks: table shows full metadata and toggles to a chart', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-2');
    const b = page.locator('#benchmarks');
    const table = b.getByRole('table');
    await expect(table.getByRole('columnheader')).toContainText([
      'Benchmark',
      'Score',
      'Evaluated',
      'Model version',
      'Evaluation',
      'Methodology',
      'Source',
    ]);
    await expect(table).toContainText('Independently evaluated');
    await expect(table).toContainText('Provider reported');
    await expect(b.getByText(/Methodologies differ/)).toBeVisible();
    await b.getByRole('button', { name: 'Chart' }).click();
    await expect(b.locator('.recharts-surface').first()).toBeVisible();
    await expect(b.getByRole('button', { name: 'Chart' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('missing data reads "Not publicly disclosed" and nothing is invented', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-14');
    await expect(
      page.locator('#specifications').getByText('Not publicly disclosed').first(),
    ).toBeVisible();
    await expect(page.locator('#pricing')).toContainText('cost estimator is unavailable');
    await expect(page.locator('#benchmarks')).toContainText('No verified data');
    await expect(page.locator('#capabilities').getByText('No verified data')).toHaveCount(8);
    await expect(page.locator('main')).not.toContainText('undefined');
    await expect(page.locator('main')).not.toContainText('NaN');
  });

  test('share copies the link', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-3');
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByText('Link copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      /\/models\/sample-model-3$/,
    );
  });

  test('does not render controls that are not built yet (Save, dead Documentation)', async ({
    page,
  }) => {
    await gotoReady(page, '/models/sample-model-1');
    await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Documentation' })).toHaveCount(0);
  });

  test('metadata: unique title, canonical, noindex for demo data, valid JSON-LD', async ({
    page,
  }) => {
    await gotoReady(page, '/models/sample-model-4');
    await expect(page).toHaveTitle(/Sample Model 4 - Demo Provider D/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/models\/sample-model-4$/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allInnerTexts();
    const parsed = blocks.map((b) => JSON.parse(b));
    expect(parsed.map((p) => p['@type']).sort()).toEqual(['BreadcrumbList', 'SoftwareApplication']);
    const app = parsed.find((p) => p['@type'] === 'SoftwareApplication');
    expect(app.name).toBe('Sample Model 4');
  });

  test('records recently viewed models for the directory', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-5');
    // The view is recorded after hydration, so wait for it to be stored before leaving.
    await page.waitForFunction(() =>
      localStorage.getItem('axiom-recent')?.includes('sample-model-5'),
    );
    await gotoReady(page, '/models');
    const recent = page.getByRole('region', { name: 'Recently viewed models' });
    await expect(recent.getByRole('link', { name: 'Sample Model 5' })).toBeVisible();
  });

  test('related models link to other profiles', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-1');
    const related = page.locator('#related');
    await expect(related.getByRole('article')).toHaveCount(3);
    await related
      .getByRole('link', { name: /^View Sample Model/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/models\/sample-model-\d+$/);
  });

  test('unknown model returns a real 404', async ({ page }) => {
    const res = await gotoReady(page, '/models/does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('suggest API validates input and returns the error envelope', async ({ request }) => {
    const bad = await request.get('/api/v1/models/suggest?q=');
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error.code).toBe('INVALID_QUERY');
    const ok = await request.get('/api/v1/models/suggest?q=video&limit=2');
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((s: { isDemo: boolean }) => s.isDemo)).toBe(true);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('filters open in a sheet, apply live and close', async ({ page }) => {
    await gotoReady(page, '/models');
    // The desktop-only sidebar toggle must not show (it would control a hidden sidebar).
    await expect(page.getByRole('button', { name: /^(Hide|Show) filters/ })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Filters' })).toBeHidden();
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filter models' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('checkbox', { name: /^Coding/ }).check();
    await expect(page).toHaveURL(/category=coding/);
    await sheet.getByRole('button', { name: /^Show \d+ models?/ }).click();
    await expect(sheet).toBeHidden();
    await expect(countText(page)).toContainText('4 models');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });

  test('profile has no horizontal page scroll', async ({ page }) => {
    await gotoReady(page, '/models/sample-model-11');
    await revealAll(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });
});

test('reduced motion: directory and profile render fully', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await gotoReady(page, '/models');
  await expect(cards(page)).toHaveCount(9);
  await gotoReady(page, '/models/sample-model-11');
  await expect(page.getByRole('heading', { level: 2, name: 'Related models' })).toBeVisible();
  await ctx.close();
});

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  const themes = ['dark', 'light'] as const;
  const routes = [
    '/models',
    '/models?sort=benchmark&benchmark=sample-benchmark-1&category=llm',
    '/models/sample-model-2',
    '/models/sample-model-11',
    '/models/sample-model-14',
  ];
  for (const route of routes) {
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

  test('axe with the search suggestions open and the tray visible', async ({ page }) => {
    await gotoReady(page, '/models');
    await page
      .getByRole('button', { name: /^Add to comparison/ })
      .first()
      .click();
    await search(page).pressSequentially('sample', { delay: 20 });
    await expect(page.getByRole('listbox')).toBeVisible();
    // Scan only once everything has settled. Typing triggers a debounced URL update; while that
    // navigation is pending the results are intentionally dimmed (aria-busy), and mid-fade frames
    // blend colours into false contrast failures.
    await expect(page).toHaveURL(/q=sample/);
    await expect(page.locator('#results')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#results')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('listbox')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('complementary', { name: 'Comparison tray' })).toHaveCSS(
      'opacity',
      '1',
    );
    await page.waitForTimeout(300); // let the spring settle after opacity reaches 1
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const summary = results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => `${n.target.join(' ')} [${n.any[0]?.message ?? ''}]`)
          .slice(0, 4)
          .join(' | ')}`,
    );
    expect(summary, summary.join(' || ')).toEqual([]);
  });

  test('axe on mobile: directory with sheet open and profile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, '/models');
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await animationsSettled(page); // the sheet is still sliding in when it first counts as visible
    const a = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      a.violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
      ),
    ).toEqual([]);
    await gotoReady(page, '/models/sample-model-11');
    await revealAll(page);
    const b = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      b.violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
      ),
    ).toEqual([]);
  });
});

test.describe('screenshots', () => {
  const widths = [390, 768, 1440] as const;
  const themes = ['dark', 'light'] as const;
  for (const theme of themes) {
    for (const width of widths) {
      test(`directory + profile ${theme} ${width}`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });

        await gotoReady(page, '/models');
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SHOTS}/p2-models-${theme}-${width}.png`, fullPage: true });

        await gotoReady(page, '/models/sample-model-11');
        await revealAll(page);
        await page.getByRole('button', { name: 'Chart' }).click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: `${SHOTS}/p2-profile-${theme}-${width}.png`,
          fullPage: true,
        });
      });
    }
  }

  test('states: suggestions, tray, mobile sheet, empty, profile with gaps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoReady(page, '/models');
    for (let i = 0; i < 3; i++)
      await page
        .getByRole('button', { name: /^Add to comparison/ })
        .first()
        .click();
    await search(page).pressSequentially('sample model 1', { delay: 20 });
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/p2-state-suggestions-tray-1440.png` });

    await gotoReady(page, '/models?q=zzzzqq');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/p2-state-empty-1440.png` });

    await gotoReady(page, '/models?sort=benchmark&benchmark=sample-benchmark-2&category=coding');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/p2-state-benchmark-sort-1440.png` });

    await gotoReady(page, '/models/sample-model-14');
    await revealAll(page);
    await page.screenshot({ path: `${SHOTS}/p2-profile-gaps-1440.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, '/models');
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/p2-state-sheet-390.png` });
  });
});
