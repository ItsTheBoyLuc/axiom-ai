import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ADMIN_STATE } from './accounts';
import { animationsSettled, gotoReady, setTheme } from './helpers';

/**
 * Read-only admin checks (dashboard, lists, editor, users, audit, RBAC details). The specs that
 * create, change and delete records live in admin-write.spec.ts, which runs after everything
 * else so a transient record can never disturb the count-based public-page specs.
 */
test.use({ storageState: ADMIN_STATE });

const SHOTS = 'test-results/screenshots';

async function expectNoViolations(page: Page) {
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
  expect(summary, 'axe violations').toEqual([]);
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('dashboard and navigation', () => {
  test('shows record counts per type and links to every list', async ({ page }) => {
    await gotoReady(page, '/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Admin' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Admin' });
    for (const label of [
      'Providers',
      'Models',
      'Benchmarks',
      'Benchmark results',
      'Pricing',
      'Releases',
      'News',
      'Publications',
      'Users',
      'Audit log',
    ]) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // 16 fixture models
    const models = page.getByRole('link', { name: /^Models\s*\d+$/ });
    await expect(models).toContainText('16');
  });

  test('is never indexed and never cached', async ({ page }) => {
    const res = await page.goto('/admin');
    expect(res?.headers()['cache-control']).toMatch(/no-store|no-cache|private/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});

test.describe('record lists', () => {
  test('lists models with their verification status, searches, and links to the editor', async ({
    page,
  }) => {
    await gotoReady(page, '/admin/models');
    await expect(page.getByRole('heading', { level: 1, name: 'Models' })).toBeVisible();
    await expect(page.getByText(/16 records/)).toBeVisible();
    // Fixtures are demo data and say so.
    await expect(page.getByText('DEMO DATA').first()).toBeVisible();

    await page.getByRole('searchbox', { name: /search models/i }).fill('sample model 1');
    await page.locator('main').getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=sample\+model\+1|q=sample%20model%201/);
    const link = page.getByRole('link', { name: /Sample Model 1\b/ }).first();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/models\/[A-Za-z0-9_-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Edit model' })).toBeVisible();
  });

  test('an unknown record type and an unknown id are 404', async ({ page }) => {
    expect((await page.goto('/admin/not-a-thing'))?.status()).toBe(404);
    expect((await page.goto('/admin/models/does-not-exist'))?.status()).toBe(404);
  });

  test('empty search says so', async ({ page }) => {
    await gotoReady(page, '/admin/providers?q=zzzzzzzz');
    await expect(page.getByText('No records match your search.')).toBeVisible();
  });
});

test.describe('editor', () => {
  test('shows every field of a model with its value, slug read-only, source fields grouped', async ({
    page,
  }) => {
    await gotoReady(page, '/admin/models');
    await page
      .getByRole('link', { name: /Sample Model 1\b/ })
      .first()
      .click();
    await expect(page.getByLabel('Slug')).toHaveValue('sample-model-1');
    await expect(page.getByLabel('Slug')).toHaveAttribute('readonly', '');
    await expect(page.getByLabel(/^Name\*?$/)).toHaveValue(/Sample Model 1/);
    await expect(page.getByRole('heading', { name: 'Source and verification' })).toBeVisible();
    await expect(page.getByLabel('Verification status')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete model' })).toBeVisible();
  });

  test('new-record form starts from safe defaults (unverified, no source needed)', async ({
    page,
  }) => {
    await gotoReady(page, '/admin/providers/new');
    await expect(page.getByLabel('Verification status')).toHaveValue('UNVERIFIED');
    await expect(page.getByLabel('Listed in the directory')).toBeChecked();
    await expect(page.getByRole('button', { name: 'Create provider' })).toBeVisible();
  });

  test('client checks catch a missing required field and a mistyped number, saving nothing', async ({
    page,
  }) => {
    await gotoReady(page, '/admin/pricing/new');
    await page.getByLabel('Price', { exact: true }).fill('1,5');
    await page.getByRole('button', { name: 'Create price' }).click();
    const alert = page.locator('main').getByRole('alert').first();
    await expect(alert).toContainText('was not saved');
    await expect(alert).toContainText('Price must be a number.');
    await expect(page.getByLabel('Price', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  });

  test('a delete asks first and Cancel keeps the record', async ({ page }) => {
    await gotoReady(page, '/admin/models');
    await page
      .getByRole('link', { name: /Sample Model 1\b/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Delete model' }).click();
    await expect(page.getByText(/Delete this model\?/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Delete model' })).toBeVisible();
    await expect(page.getByLabel('Slug')).toHaveValue('sample-model-1');
  });
});

test.describe('users and audit log', () => {
  test('users: both test accounts, own account protected, password hashes never shown', async ({
    page,
  }) => {
    await gotoReady(page, '/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
    const me = page.getByRole('listitem').filter({ hasText: 'admin@e2e.test' });
    await expect(me).toContainText('(you)');
    await expect(me.getByRole('button', { name: /Make regular user/ })).toBeDisabled();
    await expect(me.getByRole('button', { name: /Delete user/ })).toHaveCount(0);
    const other = page.getByRole('listitem').filter({ hasText: 'user@e2e.test' });
    await expect(other).toContainText('User');
    await expect(other.getByRole('button', { name: /Delete user/ })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('argon2');
  });

  test('audit log: filter controls work and the page explains secrets are never stored', async ({
    page,
  }) => {
    await gotoReady(page, '/admin/audit?entity=users&action=admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
    // prepare-db created the admin through createOrRotateAdmin, which audits it.
    await expect(page.getByText('admin.create').first()).toBeVisible();
    await expect(page.getByText(/Secrets are never stored/)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('passwordHash');
  });
});

test.describe('RBAC details with a real admin session', () => {
  test('a cross-origin write is refused even with a valid admin cookie', async ({ request }) => {
    const res = await request.post('/api/v1/admin/records/providers', {
      headers: { Origin: 'https://evil.example' },
      data: { slug: 'x' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('CROSS_ORIGIN');
  });

  test('a write without a JSON content type is 415, an unknown type is 404', async ({
    request,
  }) => {
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const bad = await request.post('/api/v1/admin/records/providers', {
      headers: { Origin: origin, 'content-type': 'text/plain' },
      data: 'x',
    });
    expect(bad.status()).toBe(415);
    const unknown = await request.get('/api/v1/admin/records/nonsense');
    expect(unknown.status()).toBe(404);
  });

  test('the record API never leaks fields the editor does not own', async ({ request }) => {
    const list = await request.get('/api/v1/admin/records/providers');
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.data.total).toBeGreaterThan(0);
    const id = body.data.rows[0].id;
    const one = await request.get(`/api/v1/admin/records/providers/${id}`);
    const rec = (await one.json()).data.record;
    expect(Object.keys(rec)).toContain('slug');
    expect(Object.keys(rec)).not.toContain('id');
  });
});

test.describe('visual and accessibility quality', () => {
  const pages: [string, string][] = [
    ['dashboard', '/admin'],
    ['list', '/admin/models'],
    ['users', '/admin/users'],
    ['audit', '/admin/audit'],
    ['new-provider', '/admin/providers/new'],
    ['new-model', '/admin/models/new'],
  ];

  for (const theme of ['dark', 'light'] as const) {
    for (const [name, url] of pages) {
      test(`${name} has no axe violations (${theme})`, async ({ page }) => {
        await setTheme(page, theme);
        await gotoReady(page, url);
        await expectNoViolations(page);
      });
    }
  }

  test('the edit form has no axe violations in both themes', async ({ page }) => {
    for (const theme of ['dark', 'light'] as const) {
      await setTheme(page, theme);
      await gotoReady(page, '/admin/models');
      await page
        .getByRole('link', { name: /Sample Model 1\b/ })
        .first()
        .click();
      await expect(page.getByLabel('Slug')).toBeVisible();
      await expectNoViolations(page);
    }
  });

  for (const width of [390, 768, 1440]) {
    test(`no horizontal overflow at ${width}px, screenshots saved`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      mkdirSync(SHOTS, { recursive: true });
      for (const [name, url] of pages) {
        await gotoReady(page, url);
        expect(await noOverflow(page), `${name} at ${width}px`).toBeLessThanOrEqual(0);
        await animationsSettled(page);
        await page.screenshot({ path: `${SHOTS}/admin-${name}-${width}.png`, fullPage: true });
      }
    });
  }
});
