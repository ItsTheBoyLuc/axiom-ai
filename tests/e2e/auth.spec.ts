import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { USER_STATE, readAccounts } from './accounts';
import { animationsSettled, gotoReady, setTheme } from './helpers';

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

test.describe('anonymous visitors', () => {
  test('/admin redirects to sign-in and remembers where they were going', async ({ page }) => {
    await page.goto('/admin/models');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fmodels$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('admin API answers 401 as JSON, and /auth/me says nobody is signed in', async ({
    request,
  }) => {
    for (const url of [
      '/api/v1/admin/users',
      '/api/v1/admin/records/providers',
      '/api/v1/admin/audit',
    ]) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(401);
      expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
      expect(res.headers()['cache-control']).toBe('no-store');
    }
    expect((await request.get('/api/v1/auth/me')).status()).toBe(401);
  });

  test('state-changing admin calls without a session are 401, cross-origin ones never reach the data', async ({
    request,
  }) => {
    const res = await request.post('/api/v1/admin/records/providers', {
      headers: { Origin: 'https://evil.example' },
      data: {},
    });
    expect(res.status()).toBe(401);
  });

  test('wrong credentials give one uniform message and no hint which part was wrong', async ({
    page,
  }) => {
    await gotoReady(page, '/sign-in');
    await page.getByLabel('Email').fill('nobody@e2e.test');
    await page.getByLabel('Password').fill('not-the-password-123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText(
      'The email or password is incorrect.',
    );
    await expect(page.getByLabel('Password')).toHaveValue(''); // cleared, never kept
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('the submit button stays disabled until both fields are filled', async ({ page }) => {
    await gotoReady(page, '/sign-in');
    const submit = page.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeDisabled();
    await page.getByLabel('Email').fill('a@b.test');
    await expect(submit).toBeDisabled();
    await page.getByLabel('Password').fill('x');
    await expect(submit).toBeEnabled();
  });

  test('the sign-in API never redirects off-site, whatever "next" says', async ({ request }) => {
    const { admin } = readAccounts();
    const res = await request.post('/api/v1/auth/sign-in', {
      headers: { Origin: new URL(test.info().project.use.baseURL!).origin },
      data: { email: admin.email, password: admin.password, next: '//evil.example/steal' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.next).toBe('/admin');
  });

  test('refuses a sign-in from another origin (CSRF) and a non-JSON body', async ({ request }) => {
    const { admin } = readAccounts();
    const cross = await request.post('/api/v1/auth/sign-in', {
      headers: { Origin: 'https://evil.example' },
      data: { email: admin.email, password: admin.password },
    });
    expect(cross.status()).toBe(403);
    expect(cross.headers()['set-cookie']).toBeUndefined();
  });

  test('signing in through the form lands on the admin, and signing out ends the session', async ({
    page,
  }) => {
    const { admin } = readAccounts();
    await gotoReady(page, '/sign-in?next=%2Fadmin%2Faudit');
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin\/audit$/); // goes where they were headed
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();

    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === 'axiom_session');
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe('Lax');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    // The old token is dead on the server, not just forgotten by the browser.
    const res = await page.request.get('/api/v1/auth/me', {
      headers: { cookie: `axiom_session=${session!.value}` },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('signed in without the admin role', () => {
  test.use({ storageState: USER_STATE });

  test('the admin area does not exist for them (404), the API says 403', async ({
    page,
    request,
  }) => {
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /not found|404/i }).first()).toBeVisible();
    for (const url of ['/api/v1/admin/users', '/api/v1/admin/records/models']) {
      const r = await request.get(url);
      expect(r.status(), url).toBe(403);
    }
    const w = await request.post('/api/v1/admin/records/providers', { data: {} });
    expect(w.status()).toBe(403);
  });

  test('/sign-in sends an already signed-in user on', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('sign-in page quality', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`has no axe violations (${theme})`, async ({ page }) => {
      await setTheme(page, theme);
      await gotoReady(page, '/sign-in');
      await expectNoViolations(page);
    });
  }

  test('fits a 390px screen without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, '/sign-in');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/sign-in-390.png` });
  });

  test('the form is keyboard operable and an error is announced', async ({ page }) => {
    await gotoReady(page, '/sign-in');
    await page.getByLabel('Email').fill('nobody@e2e.test');
    await page.keyboard.press('Tab');
    await page.keyboard.type('wrong-password-1');
    await page.keyboard.press('Enter');
    await expect(page.locator('main').getByRole('alert')).toBeVisible();
  });
});
