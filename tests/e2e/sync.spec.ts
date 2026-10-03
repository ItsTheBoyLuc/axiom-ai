import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE } from './accounts';
import { gotoReady } from './helpers';

/**
 * Read-only checks of the data sync admin (dashboard, run detail, imports, source form) against
 * the fixtures prepare-db.ts stages. Decisions (approve / reject / toggle) live in
 * admin-write.spec.ts.
 */
test.use({ storageState: ADMIN_STATE });

const origin = () => new URL(test.info().project.use.baseURL!).origin;

async function importIdBy(page: Page, title: string) {
  const res = await page.request.get('/api/v1/admin/sync/imports?status=PENDING');
  const rows = (await res.json()).data.rows as { id: string; title: string }[];
  return rows.find((r) => r.title === title)!.id;
}

test('dashboard: worker status, pending count, source with schedule, last run and counters', async ({
  page,
}) => {
  await gotoReady(page, '/admin/sync');
  await expect(page.getByRole('heading', { level: 1, name: 'Data sync' })).toBeVisible();
  // The heartbeat state depends on whether a worker is running: either answer is valid.
  await expect(page.getByText(/^(Online|Offline)$/)).toBeVisible();
  const source = page.getByRole('listitem').filter({ hasText: 'E2E news feed' }).first();
  await expect(source).toContainText('every 6h');
  await expect(source).toContainText('Enabled');
  await expect(source).toContainText('Partial');
  await expect(source).toContainText('1 partial');
  await expect(source.getByRole('button', { name: /Run now/ })).toBeEnabled();
  await expect(source.getByRole('link', { name: /Edit/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Imports waiting for review/ })).toContainText('3');
});

test('the seeded run shows its validation issue and links to the staged imports', async ({
  page,
}) => {
  await gotoReady(page, '/admin/sync');
  await page
    .getByRole('link', { name: /2026-10-03 08:00 UTC/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sync run' })).toBeVisible();
  await expect(page.getByText('Validation issues (1)')).toBeVisible();
  await expect(page.getByText(/articleUrl: Invalid input/)).toBeVisible();
  await page.getByText('Show the record').click();
  await expect(page.locator('pre')).toContainText('Post without a link');
  await page.getByRole('link', { name: /Review the 3 imports/ }).click();
  await expect(page).toHaveURL(/\/admin\/sync\/imports\?run=/);
  await expect(page.getByRole('link', { name: /E2E approve candidate/ })).toBeVisible();
});

test('imports list: waiting tab by default, trust shown on every row', async ({ page }) => {
  await gotoReady(page, '/admin/sync/imports');
  const tabs = page.getByRole('navigation', { name: 'Import status' });
  await expect(tabs.getByRole('link', { name: 'Waiting for review' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const list = page.locator('main ul').last();
  await expect(list.getByRole('link')).toHaveCount(3);
  await expect(list.getByText('Lowers trust')).toHaveCount(1);
  await expect(list.getByText('No trust change')).toHaveCount(2);
});

test('a new import shows the record, with an enabled approve button and no override box', async ({
  page,
}) => {
  const id = await importIdBy(page, 'E2E approve candidate');
  await gotoReady(page, `/admin/sync/imports/${id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'E2E approve candidate' }),
  ).toBeVisible();
  await expect(page.getByText('New record')).toBeVisible();
  await expect(page.getByText('https://example.test/e2e/approve').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve and publish' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
  await expect(page.getByLabel(/Override the trust guard/)).toHaveCount(0);
});

test('an import that lowers trust shows what changes and needs the override box ticked', async ({
  page,
}) => {
  const id = await importIdBy(page, 'E2E trusted story (reposted)');
  await gotoReady(page, `/admin/sync/imports/${id}`);
  await expect(page.getByText('Lowers trust').first()).toBeVisible();
  const table = page.getByRole('table', { name: /Fields that differ/ });
  await expect(
    table.getByRole('row', { name: /verificationStatus.*OFFICIALLY_VERIFIED.*COMMUNITY_REPORTED/ }),
  ).toBeVisible();
  const approve = page.getByRole('button', { name: 'Approve and override' });
  await expect(approve).toBeDisabled();
  await page.getByLabel(/Override the trust guard/).check();
  await expect(approve).toBeEnabled();
  // Looking is free: leave without deciding.
});

test('decision endpoints enforce ids, strict bodies and same-origin', async ({ request, page }) => {
  const id = await importIdBy(page, 'E2E trusted story (reposted)');
  const headers = { Origin: origin() };
  expect(
    (
      await request.post('/api/v1/admin/sync/imports/ghost/approve', { headers, data: {} })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post(`/api/v1/admin/sync/imports/${id}/approve`, {
        headers,
        data: { override: true, extra: 1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(`/api/v1/admin/sync/imports/${id}/approve`, {
        headers: { Origin: 'https://evil.example' },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.post('/api/v1/admin/sync/sources/ghost/run', { headers, data: {} })).status(),
  ).toBe(404);
});

test("the source form validates the JSON and shows the server's field-level answers", async ({
  page,
}) => {
  await gotoReady(page, '/admin/sync/sources/new');
  await page.getByLabel('Name').fill('E2E invalid');
  await page.getByLabel('Configuration (JSON)').fill('{ not json');
  await page.getByRole('button', { name: 'Create source' }).click();
  await expect(page.locator('main').getByRole('alert').first()).toContainText('not valid JSON');

  await page.getByRole('textbox', { name: 'Schedule' }).fill('every 5m');
  await page.getByLabel('Configuration (JSON)').fill('{"feedUrl":"nope","publisher":""}');
  await page.getByRole('button', { name: 'Create source' }).click();
  const alert = page.locator('main').getByRole('alert').first();
  await expect(alert).toContainText('schedule');
  await expect(alert).toContainText('config.feedUrl');
  await expect(alert).toContainText('config.publisher');
  await expect(page).toHaveURL(/\/sources\/new$/);

  await page.getByRole('button', { name: 'Insert the example for this type' }).click();
  await expect(page.getByLabel('Configuration (JSON)')).toHaveValue(
    /example\.com\/blog\/feed\.xml/,
  );
  await page.getByLabel('Source type').selectOption('github-releases');
  await page.getByRole('button', { name: 'Insert the example for this type' }).click();
  await expect(page.getByLabel('Configuration (JSON)')).toHaveValue(/"repo": "owner\/repository"/);
});

test('editing shows the stored, normalised configuration', async ({ page }) => {
  await gotoReady(page, '/admin/sync');
  await page.getByRole('link', { name: /^Edit/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edit sync source' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('E2E news feed');
  await expect(page.getByRole('textbox', { name: 'Schedule' })).toHaveValue('every 6h');
  await expect(page.getByLabel('Configuration (JSON)')).toHaveValue(/"publisher": "E2E Lab"/);
  await expect(page.getByRole('button', { name: 'Delete source' })).toBeVisible();
});
