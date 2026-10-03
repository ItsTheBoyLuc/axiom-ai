import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE } from './accounts';
import { gotoReady } from './helpers';

/**
 * Admin writes through the real UI: create, server-side validation, edit, public pages reflecting
 * the change (cache invalidation), delete, audit trail. Runs in its own Playwright project AFTER
 * the main one (see playwright.config.ts) and removes what it creates, so the count-based public
 * specs never see a transient record.
 */
test.use({ storageState: ADMIN_STATE });
test.describe.configure({ mode: 'serial' });

const SLUG = `e2e-lab-${Date.now().toString(36)}`;
const NAME = `E2E Lab ${SLUG.slice(-4)}`;

async function fillProvider(page: Page, over: Record<string, string> = {}) {
  await page.getByLabel('Slug').fill(over.slug ?? SLUG);
  await page.getByLabel(/^Name\*?$/).fill(over.name ?? NAME);
  await page.getByLabel('Description').fill('A provider created by the end-to-end test.');
}

test('server-side validation: a verified record without a source is refused and nothing is saved', async ({
  page,
}) => {
  await gotoReady(page, '/admin/providers/new');
  await fillProvider(page);
  await page.getByLabel('Verification status').selectOption('OFFICIALLY_VERIFIED');
  await page.getByRole('button', { name: 'Create provider' }).click();

  const alert = page.locator('main').getByRole('alert').first();
  await expect(alert).toContainText('The provider was not saved.');
  await expect(alert).toContainText('sourceUrl is required');
  await expect(page.getByLabel('Source URL')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/admin\/providers\/new$/);

  const list = await page.request.get(`/api/v1/admin/records/providers?q=${SLUG}`);
  expect((await list.json()).data.total).toBe(0);
});

test('creates a provider with a source, shows it publicly, and audits the creation', async ({
  page,
}) => {
  await gotoReady(page, '/admin/providers/new');
  await fillProvider(page);
  await page.getByLabel('Verification status').selectOption('OFFICIALLY_VERIFIED');
  await page.getByLabel('Source URL').fill('https://example.test/about');
  await page.getByLabel('Verified at').fill('2026-10-03T10:00');
  await page.getByRole('button', { name: 'Create provider' }).click();

  await expect(page).toHaveURL(/\/admin\/providers\/[A-Za-z0-9_-]+\?created=1$/);
  await expect(page.getByRole('status').filter({ hasText: 'Created.' })).toBeVisible();
  await expect(page.getByLabel('Slug')).toHaveValue(SLUG);
  await expect(page.getByLabel('Slug')).toHaveAttribute('readonly', '');

  // It is real data now: the public profile renders it, as officially verified.
  await gotoReady(page, `/providers/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
  await expect(page.getByText('Officially verified').first()).toBeVisible();

  await gotoReady(page, '/admin/audit?entity=providers&action=create');
  await expect(page.getByText('provider.create').first()).toBeVisible();
});

test('a duplicate slug is a conflict, not an overwrite', async ({ page }) => {
  await gotoReady(page, '/admin/providers/new');
  await fillProvider(page, { name: 'Impostor' });
  await page.getByRole('button', { name: 'Create provider' }).click();
  await expect(page.locator('main').getByRole('alert').first()).toContainText('already exists');
  const res = await page.request.get(`/api/v1/admin/records/providers?q=${SLUG}`);
  const rows = (await res.json()).data.rows as { title: string }[];
  expect(rows.map((r) => r.title)).toEqual([NAME]);
});

test('editing updates the public page at once (cache invalidated) and audits before/after', async ({
  page,
}) => {
  await gotoReady(page, `/admin/providers?q=${SLUG}`);
  await page.getByRole('link', { name: new RegExp(NAME) }).click();
  await expect(page.getByLabel('Slug')).toHaveValue(SLUG);

  // Warm the public cache first, so the test proves invalidation rather than a cold read.
  await page.request.get(`/api/v1/providers/${SLUG}`);

  await page.getByLabel(/^Name\*?$/).fill(`${NAME} Renamed`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  const api = await page.request.get(`/api/v1/providers/${SLUG}`);
  expect((await api.json()).data.name).toBe(`${NAME} Renamed`);
  await gotoReady(page, `/providers/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1, name: `${NAME} Renamed` })).toBeVisible();

  await gotoReady(page, '/admin/audit?entity=providers&action=update');
  await page.getByText('Show values').first().click();
  await expect(page.locator('pre').filter({ hasText: NAME }).first()).toBeVisible();
});

test('the identity (slug) cannot be changed through the API either', async ({ page }) => {
  const list = await page.request.get(`/api/v1/admin/records/providers?q=${SLUG}`);
  const id = (await list.json()).data.rows[0].id as string;
  const rec = (await (await page.request.get(`/api/v1/admin/records/providers/${id}`)).json()).data
    .record;
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const res = await page.request.put(`/api/v1/admin/records/providers/${id}`, {
    headers: { Origin: origin },
    data: { ...rec, slug: `${SLUG}-moved` },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error.message).toContain('identity');
});

test('deleting asks for confirmation, removes the record, and audits the deletion', async ({
  page,
}) => {
  await gotoReady(page, `/admin/providers?q=${SLUG}`);
  await page.getByRole('link', { name: new RegExp(NAME) }).click();
  await page.getByRole('button', { name: 'Delete provider' }).click();
  await page.getByRole('button', { name: /Yes, delete provider/ }).click();

  await expect(page).toHaveURL(/\/admin\/providers\?deleted=1$/);
  await expect(page.getByRole('status').filter({ hasText: 'was deleted' })).toBeVisible();
  expect((await page.request.get(`/api/v1/providers/${SLUG}`)).status()).toBe(404);
  expect((await page.goto(`/providers/${SLUG}`))?.status()).toBe(404);

  await gotoReady(page, '/admin/audit?entity=providers&action=delete');
  await expect(page.getByText('provider.delete').first()).toBeVisible();
});

test('a provider that still has models cannot be deleted, and says why', async ({ page }) => {
  // Whatever the fixtures are called: take the provider of the first model.
  const models = await (await page.request.get('/api/v1/admin/records/models')).json();
  const modelId = models.data.rows[0].id as string;
  const model = (await (await page.request.get(`/api/v1/admin/records/models/${modelId}`)).json())
    .data.record;
  await gotoReady(page, '/admin/providers');
  await page.getByRole('searchbox', { name: /search providers/i }).fill(String(model.provider));
  await page.getByRole('searchbox', { name: /search providers/i }).press('Enter');
  await page.locator('main ul a[href^="/admin/providers/"]').first().click();
  await page.getByRole('button', { name: 'Delete provider' }).click();
  await page.getByRole('button', { name: /Yes, delete provider/ }).click();
  await expect(page.locator('main').getByRole('alert').first()).toContainText(
    /still has \d+ models?/,
  );
  await expect(page.getByLabel('Slug')).toBeVisible(); // still on the edit page, nothing deleted
});
