import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, revealAll, setTheme } from './helpers';

const SHOTS = 'test-results/screenshots';
const dialog = (page: Page) => page.getByRole('dialog');
const box = (page: Page) => page.getByRole('combobox', { name: 'Search' });

/** Opens the palette with the keyboard shortcut and waits for the field to take focus. */
async function openPalette(page: Page) {
  await page.keyboard.press('Control+K');
  await expect(dialog(page)).toBeVisible();
  await expect(box(page)).toBeFocused();
}

test.describe('search results page', () => {
  test('asks for a query when there is none', async ({ page }) => {
    await gotoReady(page, '/search');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Search the catalogue' }),
    ).toBeVisible();
    await expect(page.getByText('Type a model, provider, benchmark or topic above.')).toBeVisible();
  });

  test('groups results by type with the match highlighted and counts on the chips', async ({
    page,
  }) => {
    await gotoReady(page, '/search?q=sample');
    await expect(page.getByRole('heading', { level: 1, name: /Results for/ })).toContainText(
      'sample',
    );
    const chips = page.getByRole('navigation', { name: 'Result type' });
    await expect(chips.getByRole('link', { name: /^All/ })).toHaveAttribute('aria-current', 'true');
    await expect(chips.getByRole('link', { name: /Models/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Models' })).toBeVisible();
    await expect(page.locator('main mark').first()).toBeVisible();
    // A model result is a real link to its profile.
    await page
      .getByRole('link', { name: /Sample Model 1/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/models\/sample-model-1$/);
  });

  test('a type chip narrows the page to that type and keeps the query', async ({ page }) => {
    await gotoReady(page, '/search?q=sample');
    await page
      .getByRole('navigation', { name: 'Result type' })
      .getByRole('link', { name: /Models/ })
      .click();
    await expect(page).toHaveURL(/types=models/);
    await expect(page.getByRole('heading', { level: 2, name: 'Models' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'News' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'View all matching models' })).toHaveAttribute(
      'href',
      '/models?q=sample',
    );
  });

  test('says plainly when nothing matches, and offers where to go next', async ({ page }) => {
    await gotoReady(page, '/search?q=zzzz-no-such-thing');
    await expect(page.getByText(/No results for/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'models', exact: true })).toHaveAttribute(
      'href',
      '/models',
    );
  });

  test('the search form is a plain GET form that keeps the query in the URL', async ({ page }) => {
    await gotoReady(page, '/search');
    await page.getByLabel('Search query').fill('provider');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/\/search\?q=provider/);
    await expect(page.getByRole('heading', { level: 2, name: 'Providers' })).toBeVisible();
  });

  test('is never indexed, and hostile input is harmless', async ({ page }) => {
    const payload = encodeURIComponent('<img src=x onerror="window.__pwned=1">');
    await gotoReady(page, `/search?q=${payload}&types=bogus`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // The text is shown as text: no element was injected and nothing ran.
    await expect(page.locator('main img')).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();
    await expect(page.getByText(/No results for/)).toBeVisible();
  });
});

test.describe('command palette', () => {
  test('opens with Ctrl+K and from the navbar button, focuses the field and closes with Escape', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Open search' }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(box(page)).toBeFocused();
  });

  test('before typing it offers suggested models and the pages', async ({ page }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    await expect(dialog(page).getByText('Suggested models')).toBeVisible();
    await expect(dialog(page).getByRole('option', { name: 'Benchmarks' })).toBeVisible();
    await expect(dialog(page).getByRole('option', { name: /See all results/ })).toHaveCount(0);
  });

  test('typing searches every type, highlights matches, and Enter opens the first result', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    await page.keyboard.type('sample model 2');
    await expect(dialog(page).getByRole('status')).toContainText(/\d+ results?/);
    await expect(dialog(page).locator('mark').first()).toBeVisible();
    await expect(dialog(page).getByRole('option', { name: /See all results for/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/models\/sample-model-/);
    await expect(dialog(page)).toHaveCount(0);
  });

  test('arrow keys move the selection and the category chips narrow the search', async ({
    page,
  }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    await page.keyboard.type('sample');
    await expect(dialog(page).getByRole('status')).toContainText(/\d+ results?/);
    const selected = dialog(page).locator('[role="option"][aria-selected="true"]');
    const first = await selected.getAttribute('data-value');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => selected.getAttribute('data-value')).not.toBe(first);
    await dialog(page).getByRole('button', { name: 'News' }).click();
    await expect(dialog(page).getByRole('button', { name: 'News' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Only news is searched now, so the model results are gone.
    await expect(dialog(page).getByRole('option', { name: /Sample Model/ })).toHaveCount(0);
    await dialog(page).getByRole('button', { name: 'Models' }).click();
    await expect(
      dialog(page)
        .getByRole('option', { name: /Sample Model/ })
        .first(),
    ).toBeVisible();
  });

  test('"See all results" opens the results page with the query', async ({ page }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    await page.keyboard.type('sample');
    await dialog(page)
      .getByRole('option', { name: /See all results for/ })
      .click();
    await expect(page).toHaveURL(/\/search\?q=sample/);
  });

  test('a search you opened is remembered and offered next time', async ({ page }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    await page.keyboard.type('provider a');
    await dialog(page)
      .getByRole('option', { name: /See all results for/ })
      .click();
    await expect(page).toHaveURL(/\/search\?q=provider\+a/);
    await openPalette(page);
    await expect(dialog(page).getByText('Recent searches')).toBeVisible();
    await dialog(page).getByRole('option', { name: 'provider a' }).click();
    await expect(box(page)).toHaveValue('provider a');
  });

  test('says when nothing matches and still offers the full results page', async ({ page }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    await page.keyboard.type('zzzz-no-such-thing');
    await expect(dialog(page).getByRole('status')).toContainText('No results');
    await expect(dialog(page).getByRole('option', { name: /See all results for/ })).toBeVisible();
  });

  test('keeps focus inside the dialog while open', async ({ page }) => {
    await gotoReady(page, '/');
    await openPalette(page);
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    expect(inside).toBe(true);
  });
});

test.describe('search: mobile and motion', () => {
  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('/search has no horizontal page scroll', async ({ page }) => {
      await gotoReady(page, '/search?q=sample');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('the palette fits the screen and can be used by touch', async ({ page }) => {
      await gotoReady(page, '/');
      await page.getByRole('button', { name: 'Open search' }).click();
      const rect = await dialog(page).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: window.innerWidth };
      });
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(rect.width);
      await box(page).fill('sample');
      await expect(dialog(page).getByRole('status')).toContainText(/\d+ results?/);
      await dialog(page)
        .getByRole('option', { name: /Sample Model/ })
        .first()
        .tap();
      await expect(page).toHaveURL(/\/models\/sample-model-/);
    });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the palette works and hydrates without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await gotoReady(page, '/search?q=sample');
      await openPalette(page);
      await page.keyboard.type('sample');
      await expect(dialog(page).getByRole('status')).toContainText(/\d+ results?/);
      expect(errors).toEqual([]);
    });
  });
});

test.describe('search: accessibility (axe, WCAG 2.2 AA)', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const [name, route] of [
      ['results', '/search?q=sample'],
      ['empty', '/search'],
      ['no results', '/search?q=zzzz-no-such-thing'],
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

    test(`axe palette with results ${theme}`, async ({ page }) => {
      await setTheme(page, theme);
      await gotoReady(page, '/');
      await openPalette(page);
      await page.keyboard.type('sample');
      await expect(dialog(page).getByRole('status')).toContainText(/\d+ results?/);
      await animationsSettled(page);
      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
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
});

test.describe('search screenshots', () => {
  mkdirSync(SHOTS, { recursive: true });
  for (const width of [390, 768, 1440] as const) {
    test(`search ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await gotoReady(page, '/search?q=sample');
      await revealAll(page);
      await animationsSettled(page);
      await page.screenshot({ path: `${SHOTS}/search-${width}.png`, fullPage: true });
    });
    test(`palette ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await gotoReady(page, '/');
      await openPalette(page);
      await page.keyboard.type('sample');
      await expect(dialog(page).getByRole('status')).toContainText(/\d+ results?/);
      await animationsSettled(page);
      await page.screenshot({ path: `${SHOTS}/palette-${width}.png` });
    });
  }
});
