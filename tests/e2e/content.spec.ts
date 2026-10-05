import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsSettled, gotoReady, setTheme } from './helpers';

const PAGES = [
  { path: '/about', h1: 'About AXIOM AI' },
  { path: '/methodology', h1: 'Data methodology' },
  { path: '/sources', h1: 'Sources' },
  { path: '/contact', h1: 'Contact' },
  { path: '/privacy', h1: 'Privacy' },
  { path: '/terms', h1: 'Terms of use' },
  { path: '/cookies', h1: 'Cookies and browser storage' },
];

test.describe('platform and legal pages are real pages', () => {
  for (const { path, h1 } of PAGES) {
    test(`${path}: one h1, a title, a description and a canonical`, async ({ page }) => {
      await gotoReady(page, path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('main')).not.toContainText('Not built yet');
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`${path}$`),
      );
      expect(await page.title()).toContain('AXIOM AI');
    });
  }

  test('every footer link goes to a real page', async ({ page }) => {
    await gotoReady(page, '/');
    const hrefs = await page
      .locator('footer a[href^="/"]')
      .evaluateAll((as) => [
        ...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!)),
      ]);
    expect(hrefs.length).toBeGreaterThanOrEqual(13);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBe(200);
      expect(await res.text(), href).not.toContain('Not built yet');
    }
  });

  test('sources: with only demo fixtures loaded there is nothing to list, and it says so', async ({
    page,
  }) => {
    // The e2e database holds demo fixtures, which are never counted as sources. The real-data
    // table (hosts, counts, status split) is covered by tests/integration/sources.test.ts.
    await gotoReady(page, '/sources');
    await expect(page.getByText('No sourced records are loaded yet.')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('methodology: shows all six verification statuses with counts', async ({ page }) => {
    await gotoReady(page, '/methodology');
    for (const label of [
      'Officially verified',
      'Independently evaluated',
      'Provider reported',
      'Community reported',
      'Unverified',
      'Not publicly disclosed',
    ]) {
      await expect(
        page.locator('section[aria-labelledby="statuses"]').getByText(label, { exact: true }),
      ).toBeVisible();
    }
    await expect(page.locator('section[aria-labelledby="statuses"]')).toContainText('records now');
  });

  test('contact: shows the configured address as a mailto link', async ({ page }) => {
    await gotoReady(page, '/contact');
    await expect(page.getByRole('link', { name: 'contact@axiom.test' }).first()).toHaveAttribute(
      'href',
      'mailto:contact@axiom.test',
    );
  });

  test('cookies: lists the session cookie and the local storage keys', async ({ page }) => {
    await gotoReady(page, '/cookies');
    const table = page.getByRole('table');
    for (const name of ['axiom_session', 'axiom-theme', 'axiom-compare', 'axiom-recent-searches']) {
      await expect(table).toContainText(name);
    }
  });

  test('mobile: no horizontal overflow, tables scroll inside their own box', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const { path } of PAGES) {
      await gotoReady(page, path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('robots.txt, sitemap.xml and indexing', () => {
  test('robots.txt allows the site, blocks private areas and points at the sitemap', async ({
    request,
  }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('User-Agent: *');
    for (const p of ['/admin', '/account', '/settings', '/api/v1/']) {
      expect(text).toContain(`Disallow: ${p}`);
    }
    expect(text).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
  });

  test('sitemap.xml lists fixed pages, every model and every provider, and nothing private', async ({
    request,
  }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
    for (const p of ['/', '/models', '/about', '/methodology', '/privacy'])
      expect(locs).toContain(p);
    expect(locs.filter((p) => p.startsWith('/models/')).length).toBeGreaterThan(5);
    expect(locs.filter((p) => p.startsWith('/providers/')).length).toBeGreaterThan(3);
    expect(locs.some((p) => /^\/(admin|account|settings|sign-in|api)/.test(p))).toBe(false);
    expect(xml).not.toContain('<lastmod>');
  });

  test('the plain directory is indexable; a filtered or paged one is not and points at the canonical', async ({
    page,
  }) => {
    await gotoReady(page, '/models');
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await gotoReady(page, '/models?category=coding');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/models$/);
  });
});

test.describe('accessibility of the content pages', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`no axe violations (${theme})`, async ({ page }) => {
      await setTheme(page, theme);
      for (const { path } of PAGES) {
        await gotoReady(page, path);
        await animationsSettled(page);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
          ),
          path,
        ).toEqual([]);
      }
    });
  }
});
