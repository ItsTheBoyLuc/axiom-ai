import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, revealAll, setTheme, reloadReady } from './helpers';

const SHOTS = 'test-results/screenshots';
const TIMELINE = '/releases';
const LIST = '/releases?view=list';
// Demo fixtures: 20 releases (all unconfirmed, no announcement links) from 7 providers.
const entries = (page: Page) => page.locator('[data-release-entry]');
const listRows = (page: Page) =>
  page.getByRole('region', { name: 'Releases table' }).locator('tbody tr');

test.describe('releases timeline', () => {
  test('shows every release in time order under month headings, with its status', async ({
    page,
  }) => {
    await gotoReady(page, TIMELINE);
    await expect(
      page.getByRole('heading', { level: 1, name: 'What shipped, and when' }),
    ).toBeVisible();
    await expect(page.getByRole('status').first()).toContainText('20 releases');
    await expect(entries(page)).toHaveCount(20);
    const months = await page.getByRole('heading', { level: 2 }).allInnerTexts();
    expect(months.filter((m) => /20\d\d$/.test(m)).length).toBeGreaterThan(3);
    // Newest first: the first entry is the latest date.
    const dates = await entries(page)
      .locator('time')
      .evaluateAll((els) => els.map((e) => e.getAttribute('datetime')!));
    expect([...dates].sort().reverse()).toEqual(dates);
    // The fixtures are unverified, so nothing is presented as confirmed.
    await expect(page.getByText('Unconfirmed').first()).toBeVisible();
    await expect(page.getByText('Officially verified')).toHaveCount(0);
    await expect(page.getByText('No announcement link on record.').first()).toBeVisible();
  });

  test('each entry names the provider and model with working profile links', async ({ page }) => {
    await gotoReady(page, TIMELINE);
    const first = entries(page).first();
    await expect(first.getByRole('link', { name: /Demo Provider/ })).toHaveAttribute(
      'href',
      /^\/providers\/demo-provider-/,
    );
    await first.getByRole('link', { name: /Demo Provider/ }).click();
    await expect(page).toHaveURL(/\/providers\/demo-provider-/);
  });

  test('the list view is a table with one row per release and a way back', async ({ page }) => {
    await gotoReady(page, TIMELINE);
    await page.getByRole('link', { name: 'List' }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(listRows(page)).toHaveCount(20);
    await page.getByRole('link', { name: 'Timeline' }).click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(entries(page)).toHaveCount(20);
  });
});

test.describe('release filters', () => {
  test('search narrows the releases and lives in the URL', async ({ page }) => {
    await gotoReady(page, TIMELINE);
    await page.getByLabel('Search releases').fill('pricing');
    await expect(page).toHaveURL(/q=pricing/);
    const n = await entries(page).count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(20);
    await reloadReady(page);
    await expect(page.getByLabel('Search releases')).toHaveValue('pricing');
    await expect(entries(page)).toHaveCount(n);
  });

  test('provider and kind filters combine, and the view is kept', async ({ page }) => {
    await gotoReady(page, LIST);
    await page.getByLabel('Provider', { exact: true }).selectOption('demo-provider-a');
    await expect(page).toHaveURL(/provider=demo-provider-a/);
    await expect(page).toHaveURL(/view=list/);
    await expect(listRows(page)).toHaveCount(5);
    await page.getByLabel('Kind').selectOption('major');
    await expect(page).toHaveURL(/category=major/);
    const rows = await listRows(page).count();
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThan(5);
    await expect(
      page.getByRole('region', { name: 'Releases table' }).getByText('Major release').first(),
    ).toBeVisible();
  });

  test('a date range limits the releases (inclusive)', async ({ page }) => {
    await gotoReady(page, TIMELINE);
    await page.getByLabel('From', { exact: true }).fill('2026-06-01');
    await expect(page).toHaveURL(/from=2026-06-01/);
    const after = await entries(page).count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(20);
    const dates = await entries(page)
      .locator('time')
      .evaluateAll((els) => els.map((e) => e.getAttribute('datetime')!));
    expect(dates.every((d) => d >= '2026-06-01')).toBe(true);
  });

  test('no match says so, and "Clear all filters" brings everything back', async ({ page }) => {
    await gotoReady(page, '/releases?q=zzzz-no-such-release');
    await expect(page.getByText('No releases match these filters.')).toBeVisible();
    await page.getByRole('link', { name: 'Clear all filters' }).first().click();
    await expect(entries(page)).toHaveCount(20);
  });

  test('hostile or malformed parameters never break the page', async ({ page }) => {
    await gotoReady(page, '/releases?provider=../x&category=%3Cb%3E&from=nope&view=grid&page=-9');
    await expect(
      page.getByRole('heading', { level: 1, name: 'What shipped, and when' }),
    ).toBeVisible();
    await expect(entries(page)).toHaveCount(20);
  });
});

test.describe('scroll effects (GSAP)', () => {
  test('the timeline line draws and entries come into focus as the page scrolls', async ({
    page,
  }) => {
    await gotoReady(page, TIMELINE);
    const line = page.locator('[data-timeline-progress]');
    // The scroll effects start after the page has loaded and the browser is idle (Phase 11), via a
    // dynamic import of GSAP: allow for that on a busy machine.
    await expect
      .poll(async () => line.evaluate((el) => getComputedStyle(el).transform), { timeout: 20_000 })
      .not.toBe('none');
    const scaleAt = async () =>
      line.evaluate((el) => {
        // GSAP writes matrix() at rest and matrix3d() while it moves: scaleY is index 3 or 5.
        const t = getComputedStyle(el).transform;
        const m = t.match(/matrix(3d)?\(([^)]+)\)/);
        if (!m) return 1;
        const v = m[2]!.split(',').map(Number);
        return m[1] ? v[5]! : v[3]!;
      });
    const top = await scaleAt();
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
    );
    await expect.poll(scaleAt, { timeout: 15_000 }).toBeGreaterThan(top);
    // An entry far below the fold is visible once it has been scrolled to.
    const last = entries(page).last();
    await last.scrollIntoViewIfNeeded();
    // In focus (or at least never faded: out-of-focus entries blur but keep full opacity).
    await expect
      .poll(() => last.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 15_000 })
      .toBe(1);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('nothing is animated or hidden: the whole timeline is visible at once', async ({
      page,
    }) => {
      await gotoReady(page, TIMELINE);
      await page.waitForTimeout(800);
      const hidden = await entries(page).evaluateAll(
        (els) => els.filter((el) => Number(getComputedStyle(el).opacity) < 1).length,
      );
      expect(hidden).toBe(0);
      const transform = await page
        .locator('[data-timeline-progress]')
        .evaluate((el) => getComputedStyle(el).transform);
      expect(transform).toBe('none');
    });
  });
});

test.describe('releases: mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const route of [TIMELINE, LIST]) {
    test(`${route} has no horizontal page scroll`, async ({ page }) => {
      await gotoReady(page, route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('releases: accessibility (axe, WCAG 2.2 AA)', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const [name, route] of [
      ['timeline', TIMELINE],
      ['list', LIST],
      ['no results', '/releases?q=zzzz-no-such-release'],
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

test.describe('releases screenshots', () => {
  mkdirSync(SHOTS, { recursive: true });
  for (const width of [390, 768, 1440] as const) {
    for (const [name, route] of [
      ['timeline', TIMELINE],
      ['list', LIST],
    ] as const) {
      test(`releases ${name} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await gotoReady(page, route);
        await revealAll(page);
        await animationsSettled(page);
        await page.screenshot({ path: `${SHOTS}/releases-${name}-${width}.png`, fullPage: true });
      });
    }
  }
});
