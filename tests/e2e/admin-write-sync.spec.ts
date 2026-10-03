import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE } from './accounts';
import { gotoReady } from './helpers';

/**
 * Sync decisions through the real UI: approve, reject, the trust guard with its explicit override,
 * and the source lifecycle (create, disable, enable, delete). Runs in the admin-write project,
 * after the read-only specs, and removes every record it publishes.
 */
test.use({ storageState: ADMIN_STATE });
test.describe.configure({ mode: 'serial' });

const origin = () => new URL(test.info().project.use.baseURL!).origin;

async function importIdBy(page: Page, title: string, status = 'PENDING') {
  const res = await page.request.get(`/api/v1/admin/sync/imports?status=${status}`);
  const rows = (await res.json()).data.rows as { id: string; title: string }[];
  return rows.find((r) => r.title === title)!.id;
}

async function recordIdByTitle(page: Page, entity: string, q: string) {
  const res = await page.request.get(`/api/v1/admin/records/${entity}?q=${encodeURIComponent(q)}`);
  const rows = (await res.json()).data.rows as { id: string }[];
  return rows[0]?.id ?? null;
}

async function deleteRecord(page: Page, entity: string, q: string) {
  const id = await recordIdByTitle(page, entity, q);
  if (id) {
    await page.request.delete(`/api/v1/admin/records/${entity}/${id}`, {
      headers: { Origin: origin() },
    });
  }
}

test.afterAll(async ({ browser }) => {
  // Leave the public data exactly as found.
  const ctx = await browser.newContext({
    storageState: ADMIN_STATE,
    baseURL: test.info().project.use.baseURL,
  });
  const page = await ctx.newPage();
  await deleteRecord(page, 'news', 'E2E approve candidate');
  await deleteRecord(page, 'news', 'E2E trusted story');
  await ctx.close();
});

test('approving an import publishes it, marks it approved and audits the decision', async ({
  page,
}) => {
  const id = await importIdBy(page, 'E2E approve candidate');
  await gotoReady(page, `/admin/sync/imports/${id}`);
  await page.getByRole('button', { name: 'Approve and publish' }).click();

  await expect(page).toHaveURL(/\/admin\/sync\/imports\?decided=approve$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'approved and published' }),
  ).toBeVisible();

  // Published: it is real, public news now, and no longer waiting.
  const news = await (await page.request.get('/api/v1/news?q=E2E%20approve')).json();
  expect(news.data.map((n: { title: string }) => n.title)).toContain('E2E approve candidate');
  await gotoReady(page, `/admin/sync/imports/${id}`);
  await expect(page.getByRole('status')).toContainText('approved on');
  await expect(page.getByRole('button', { name: /Approve/ })).toHaveCount(0);

  await gotoReady(page, '/admin/audit?entity=imports&action=approve');
  await expect(page.getByText('import.approve').first()).toBeVisible();
});

test('rejecting an import keeps the catalogue untouched', async ({ page }) => {
  const id = await importIdBy(page, 'E2E reject candidate');
  await gotoReady(page, `/admin/sync/imports/${id}`);
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page).toHaveURL(/\/admin\/sync\/imports\?decided=reject$/);
  await expect(page.getByRole('status').filter({ hasText: 'Import rejected' })).toBeVisible();

  const news = await (await page.request.get('/api/v1/news?q=E2E%20reject')).json();
  expect(news.data).toHaveLength(0);
  await gotoReady(page, '/admin/sync/imports?status=REJECTED');
  await expect(page.getByRole('link', { name: /E2E reject candidate/ })).toBeVisible();

  // It cannot be decided twice.
  const again = await page.request.post(`/api/v1/admin/sync/imports/${id}/approve`, {
    headers: { Origin: origin() },
    data: {},
  });
  expect(again.status()).toBe(409);
});

test('trust guard: a downgrade is refused without the override, and the override is audited', async ({
  page,
}) => {
  // The stored record the staged import would lower: officially verified.
  const created = await page.request.post('/api/v1/admin/records/news', {
    headers: { Origin: origin() },
    data: {
      title: 'E2E trusted story',
      summary: 'Written by an admin.',
      publisher: 'E2E Lab',
      articleUrl: 'https://example.test/e2e/trusted',
      publicationDate: '2026-09-30T14:00:00.000Z',
      category: 'COMPANIES',
      isOfficial: true,
      isAiSummary: false,
      sourceUrl: 'https://example.test/e2e/trusted',
      verificationStatus: 'OFFICIALLY_VERIFIED',
      verifiedAt: '2026-10-03T08:00:00.000Z',
    },
  });
  expect(created.status()).toBe(201);

  const id = await importIdBy(page, 'E2E trusted story (reposted)');
  // The API refuses a plain approval, says why, and changes nothing.
  const refused = await page.request.post(`/api/v1/admin/sync/imports/${id}/approve`, {
    headers: { Origin: origin() },
    data: {},
  });
  expect(refused.status()).toBe(409);
  const body = await refused.json();
  expect(body.error.code).toBe('TRUST_GUARD');
  expect(body.error.details).toEqual({ requiresOverride: true });
  const still = await (await page.request.get('/api/v1/news?q=E2E%20trusted')).json();
  expect(still.data[0].title).toBe('E2E trusted story');

  // Through the UI: the button needs the explicit tick.
  await gotoReady(page, `/admin/sync/imports/${id}`);
  await expect(page.getByText('Lowers trust').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve and override' })).toBeDisabled();
  await page.getByLabel(/Override the trust guard/).check();
  await page.getByRole('button', { name: 'Approve and override' }).click();
  await expect(page).toHaveURL(/\/admin\/sync\/imports\?decided=approve$/);

  const after = await (await page.request.get('/api/v1/news?q=E2E%20trusted')).json();
  expect(after.data[0].title).toBe('E2E trusted story (reposted)');

  await gotoReady(page, '/admin/audit?entity=imports&action=override');
  await expect(page.getByText('import.approve-override').first()).toBeVisible();
});

test('source lifecycle: create, disable (no run), enable, delete', async ({ page }) => {
  await gotoReady(page, '/admin/sync/sources/new');
  await page.getByLabel('Name').fill('E2E temporary source');
  await page.getByRole('textbox', { name: 'Schedule' }).fill('EVERY 12H'); // normalised by the server
  await page.getByRole('button', { name: 'Create source' }).click();
  await expect(page).toHaveURL(/\/admin\/sync$/);

  const row = page.getByRole('listitem').filter({ hasText: 'E2E temporary source' }).first();
  await expect(row).toContainText('every 12h');
  await expect(row).toContainText('Never');

  await row.getByRole('button', { name: /^Disable/ }).click();
  await expect(row.getByRole('status')).toContainText('Source disabled.');
  await expect(row).toContainText('Disabled');
  await expect(row.getByRole('button', { name: /Run now/ })).toBeDisabled();
  await expect(row).toContainText('Not scheduled');

  await row.getByRole('button', { name: /^Enable/ }).click();
  await expect(row.getByRole('status')).toContainText('Source enabled.');
  await expect(row.getByRole('button', { name: /Run now/ })).toBeEnabled();

  await row.getByRole('link', { name: /^Edit/ }).click();
  await expect(page.getByRole('textbox', { name: 'Schedule' })).toHaveValue('every 12h');
  await page.getByRole('button', { name: 'Delete source' }).click();
  await page.getByRole('button', { name: /Yes, delete source/ }).click();
  await expect(page).toHaveURL(/\/admin\/sync$/);
  await expect(page.getByText('E2E temporary source')).toHaveCount(0);

  await gotoReady(page, '/admin/audit?entity=sync-sources');
  for (const action of [
    'sync-source.create',
    'sync-source.disable',
    'sync-source.enable',
    'sync-source.delete',
  ]) {
    await expect(page.getByText(action).first()).toBeVisible();
  }
});
