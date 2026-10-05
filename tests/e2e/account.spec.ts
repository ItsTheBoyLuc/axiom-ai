import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationsSettled, gotoReady, reloadReady, setTheme } from './helpers';

/**
 * Accounts and personalization end to end: anonymous parity, sign-up, saving models and
 * comparisons, recently viewed, settings (theme, providers, "For you"), password change and
 * account deletion. Each test makes its own account (random email and password), so tests are
 * independent and parallel-safe; the sign-up rate limit is cleared by prepare-db.
 */
const SHOTS = 'test-results/screenshots';
const MODEL = 'sample-model-1';
const MODEL_NAME = 'Sample Model 1';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const newAccount = () => ({
  email: `e2e-${unique()}@example.test`,
  password: `correct-horse-${unique()}-battery`,
});
const origin = () => new URL(test.info().project.use.baseURL!).origin;

/** Signs up through the API; the session cookie lands in the page's browser context. */
async function signUp(page: Page, name?: string) {
  const a = newAccount();
  const res = await page.request.post('/api/v1/auth/sign-up', {
    // A distinct client address per account: the per-address sign-up limit is a real defence
    // and must not make unrelated tests depend on each other.
    headers: {
      Origin: origin(),
      'X-Forwarded-For': `198.51.100.${Math.floor(Math.random() * 250)}`,
    },
    data: { ...a, name },
  });
  expect(res.status(), 'sign-up').toBe(201);
  return a;
}

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

const main = (page: Page) => page.locator('main');
const accountMenu = (page: Page) => page.getByRole('button', { name: 'Account menu' });

test.describe('anonymous parity', () => {
  test('the site works signed out: "Sign in" in the navbar, no failed requests, no account calls beyond the session check', async ({
    page,
  }) => {
    const failed: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await gotoReady(page, '/');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'For you' })).toHaveCount(0);
    expect(failed).toEqual([]);
  });

  test('the session endpoint answers 200 with nobody signed in', async ({ request }) => {
    const res = await request.get('/api/v1/auth/session');
    expect(res.status()).toBe(200);
    expect((await res.json()).data).toEqual({ user: null, preferences: null, savedModels: null });
    expect(res.headers()['cache-control']).toBe('no-store');
  });

  test('saving needs an account: a sign-in link on the model page, never a dead button', async ({
    page,
  }) => {
    await gotoReady(page, `/models/${MODEL}`);
    const link = main(page).getByRole('link', { name: /Sign in to save/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', new RegExp(`/sign-in\\?next=%2Fmodels%2F${MODEL}$`));
    await expect(main(page).getByRole('button', { name: /^Save/ })).toHaveCount(0);
  });

  test('on the compare page "Sign in to save" returns to the same comparison', async ({ page }) => {
    await gotoReady(page, `/compare?models=${MODEL},sample-model-2`);
    const link = main(page).getByRole('link', { name: /Sign in to save/ });
    await expect(link).toBeVisible();
    expect(decodeURIComponent((await link.getAttribute('href'))!)).toContain(
      `/compare?models=${MODEL},sample-model-2`,
    );
  });

  test('/account and /settings send anonymous visitors to sign-in and back', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings$/);
  });

  test('the /me API is closed to anonymous callers', async ({ request }) => {
    for (const url of [
      '/api/v1/me/saved-models',
      '/api/v1/me/comparisons',
      '/api/v1/me/preferences',
      '/api/v1/me/recently-viewed',
    ]) {
      expect((await request.get(url)).status(), url).toBe(401);
    }
  });
});

test.describe('sign-up', () => {
  test('creates an account through the form, signs in, shows the account menu, and signing out returns to anonymous', async ({
    page,
  }) => {
    const a = newAccount();
    await gotoReady(page, '/sign-up');
    await page.getByLabel(/^Name/).fill('Ada Tester');
    await page.getByLabel('Email').fill(a.email);
    await page.getByLabel('Password', { exact: true }).fill(a.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Saved and recent' })).toBeVisible();
    await expect(accountMenu(page)).toBeVisible();
    const cookie = (await page.context().cookies()).find((c) => c.name === 'axiom_session');
    expect(cookie?.httpOnly).toBe(true);

    await accountMenu(page).click();
    await expect(page.getByRole('menu').getByText(a.email)).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Admin/ })).toHaveCount(0); // never an admin
    await page.getByRole('menuitem', { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
    await page.goto('/account');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('shows the rules as you type, and the server rejects what the client let through', async ({
    page,
  }) => {
    await gotoReady(page, '/sign-up');
    await page.getByLabel('Email').fill('someone@example.test');
    const pw = page.getByLabel('Password', { exact: true });
    await pw.fill('short');
    await pw.blur();
    await expect(main(page).getByRole('alert')).toContainText('at least 12 characters');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/sign-up$/);

    await pw.fill('password1234'); // 12 characters, but common
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(main(page).getByRole('alert').first()).toContainText('too common');
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test('an email that already has an account is refused, pointing at sign-in', async ({ page }) => {
    const a = await signUp(page);
    await page.context().clearCookies();
    await gotoReady(page, '/sign-up');
    await page.getByLabel('Email').fill(a.email.toUpperCase());
    await page.getByLabel('Password', { exact: true }).fill('another-long-passphrase-1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(main(page).getByRole('alert').first()).toContainText('already exists');
  });

  test('the show-password toggle works and is announced', async ({ page }) => {
    await gotoReady(page, '/sign-up');
    const pw = page.getByLabel('Password', { exact: true });
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('cannot become an administrator by any request', async ({ request }) => {
    const res = await request.post('/api/v1/auth/sign-up', {
      headers: { Origin: origin() },
      data: { ...newAccount(), role: 'ADMIN' },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('saved models and recently viewed', () => {
  test('save, persist across reload, list on /account, remove', async ({ page }) => {
    await signUp(page);
    await gotoReady(page, `/models/${MODEL}`);
    const save = main(page).getByRole('button', { name: new RegExp(`^Save ${MODEL_NAME}`) });
    await expect(save).toHaveAttribute('aria-pressed', 'false');
    // Wait for the request to finish: reloading while it is in flight would cancel it.
    const posted = page.waitForResponse(
      (r) => r.url().includes('/api/v1/me/saved-models') && r.request().method() === 'POST',
    );
    await save.click();
    await posted;
    const saved = main(page).getByRole('button', { name: new RegExp(`^Saved ${MODEL_NAME}`) });
    await expect(saved).toHaveAttribute('aria-pressed', 'true');

    await reloadReady(page);
    await expect(
      main(page).getByRole('button', { name: new RegExp(`^Saved ${MODEL_NAME}`) }),
    ).toBeVisible();

    await gotoReady(page, '/account');
    await expect(page.getByRole('heading', { name: 'Saved models (1)' })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(MODEL_NAME) }).first()).toBeVisible();
    await page.getByRole('button', { name: `Remove ${MODEL_NAME} from saved models` }).click();
    await expect(page.getByText(/You have not saved any models yet/)).toBeVisible();

    await gotoReady(page, `/models/${MODEL}`);
    await expect(
      main(page).getByRole('button', { name: new RegExp(`^Save ${MODEL_NAME}`) }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('the model you open appears under recently viewed', async ({ page }) => {
    await signUp(page);
    await gotoReady(page, `/models/${MODEL}`);
    // The view is recorded after the session loads; wait for the request, then look.
    await page.waitForResponse(
      (r) => r.url().includes('/api/v1/me/recently-viewed') && r.request().method() === 'POST',
    );
    await gotoReady(page, '/account');
    const recent = page
      .getByRole('region', { name: 'Recently viewed' })
      .or(page.locator('section[aria-labelledby="recent"]'));
    await expect(recent.getByRole('link', { name: new RegExp(MODEL_NAME) })).toBeVisible();
  });

  test('saved models are private to the account', async ({ page, browser }) => {
    await signUp(page);
    await gotoReady(page, `/models/${MODEL}`);
    await main(page)
      .getByRole('button', { name: new RegExp(`^Save ${MODEL_NAME}`) })
      .click();
    await expect(
      main(page).getByRole('button', { name: new RegExp(`^Saved ${MODEL_NAME}`) }),
    ).toBeVisible();

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const otherPage = await other.newPage();
    await signUp(otherPage);
    const list = await otherPage.request.get('/api/v1/me/saved-models');
    expect((await list.json()).data).toEqual([]);
    await other.close();
  });
});

test.describe('saved comparisons', () => {
  test('save from the compare page, reopen from /account, delete', async ({ page }) => {
    await signUp(page);
    await gotoReady(page, `/compare?models=${MODEL},sample-model-2`);
    await main(page).getByRole('button', { name: 'Save comparison' }).click();
    const name = page.getByLabel('Name of the comparison');
    await expect(name).toHaveValue(/Sample Model 1 vs Sample Model 2/);
    await name.fill('My first pair');
    await main(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      main(page).getByRole('status').filter({ hasText: 'Comparison saved.' }),
    ).toBeVisible();

    await gotoReady(page, '/account');
    await expect(page.getByRole('heading', { name: 'Saved comparisons (1)' })).toBeVisible();
    await page.getByRole('link', { name: 'Open comparison My first pair' }).click();
    await expect(page).toHaveURL(new RegExp(`/compare\\?models=${MODEL},sample-model-2$`));
    await expect(
      main(page)
        .getByRole('list', { name: /Selected models|/ })
        .first(),
    ).toBeVisible();

    await gotoReady(page, '/account');
    const region = page.locator('section[aria-labelledby="saved-comparisons"]');
    await region.getByRole('button', { name: 'Delete' }).click();
    await region.getByRole('button', { name: /Yes, delete/ }).click();
    await expect(region.getByText(/No saved comparisons yet/)).toBeVisible();
  });

  test('with fewer than two models there is nothing to save', async ({ page }) => {
    await signUp(page);
    await gotoReady(page, `/compare?models=${MODEL}`);
    await expect(main(page).getByRole('button', { name: 'Save comparison' })).toHaveCount(0);
  });
});

test.describe('settings and personalization', () => {
  test('theme is saved to the account and applied again after signing in elsewhere', async ({
    page,
    browser,
  }) => {
    const a = await signUp(page);
    await gotoReady(page, '/settings');
    await page.getByRole('radio', { name: /^Light/ }).check();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(
      main(page).getByRole('status').filter({ hasText: 'Settings saved.' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // A fresh browser context (another device) has no local theme: signing in adopts the account's.
    const device = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      colorScheme: 'dark',
    });
    const p2 = await device.newPage();
    await gotoReady(p2, '/sign-in');
    await p2.getByLabel('Email').fill(a.email);
    await p2.getByLabel('Password').fill(a.password);
    await p2.getByRole('button', { name: 'Sign in' }).click();
    await expect(p2).toHaveURL(/\/$/);
    await expect(p2.locator('html')).toHaveAttribute('data-theme', 'light');
    await device.close();
  });

  test('changing the theme from the navbar is remembered on the account', async ({ page }) => {
    await signUp(page);
    await gotoReady(page, '/');
    await page.getByRole('button', { name: 'Change theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Light' }).click();
    await expect
      .poll(
        async () => (await (await page.request.get('/api/v1/me/preferences')).json()).data.theme,
      )
      .toBe('light');
  });

  test('"For you" appears for signed-in people, follows their providers, and can be switched off', async ({
    page,
  }) => {
    await signUp(page);
    await gotoReady(page, '/');
    const forYou = page.getByRole('heading', { level: 2, name: 'For you' });
    await expect(forYou).toBeVisible();
    await expect(page.getByText(/Make this page yours/)).toBeVisible();

    // Save a model and follow its provider: both show up.
    const providers = await (await page.request.get('/api/v1/providers')).json();
    const firstProvider = providers.data[0] as { slug: string; name: string };
    await page.request.post('/api/v1/me/saved-models', {
      headers: { Origin: origin() },
      data: { slug: MODEL },
    });
    await gotoReady(page, '/settings');
    await page.getByRole('checkbox', { name: firstProvider.name, exact: true }).check();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(
      main(page).getByRole('status').filter({ hasText: 'Settings saved.' }),
    ).toBeVisible();

    await gotoReady(page, '/');
    const section = page.locator('section[aria-labelledby="for-you"]');
    await expect(section.getByRole('link', { name: new RegExp(MODEL_NAME) })).toBeVisible();
    await expect(section.getByText('From providers you follow')).toBeVisible();

    await gotoReady(page, '/settings');
    await page.getByLabel(/Show the .For you. section/).uncheck();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(
      main(page).getByRole('status').filter({ hasText: 'Settings saved.' }),
    ).toBeVisible();
    await gotoReady(page, '/');
    await expect(page.getByRole('heading', { name: 'For you' })).toHaveCount(0);
  });

  test('preferences reject unknown providers (API) and keep what was saved', async ({ page }) => {
    await signUp(page);
    const bad = await page.request.put('/api/v1/me/preferences', {
      headers: { Origin: origin() },
      data: { theme: null, preferredProviders: ['no-such-provider'], personalized: true },
    });
    expect(bad.status()).toBe(400);
  });

  test('change password: wrong current is refused, the new one works, the old one stops', async ({
    page,
    browser,
  }) => {
    const a = await signUp(page);
    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const op = await other.newPage();
    await op.request.post('/api/v1/auth/sign-in', { headers: { Origin: origin() }, data: a }); // a second device

    await gotoReady(page, '/settings');
    const section = page.locator('section[aria-labelledby="password"]');
    await section.getByLabel('Current password').fill('definitely-not-it-1');
    await section.getByLabel('New password').fill('a-brand-new-passphrase-9');
    await section.getByRole('button', { name: 'Change password' }).click();
    await expect(section.getByRole('alert')).toContainText('current password is incorrect');

    await section.getByLabel('Current password').fill(a.password);
    await section.getByRole('button', { name: 'Change password' }).click();
    await expect(section.getByRole('status')).toContainText('Password changed');

    // The other device was signed out; this one stays in.
    expect((await op.request.get('/api/v1/auth/me')).status()).toBe(401);
    expect((await page.request.get('/api/v1/auth/me')).status()).toBe(200);
    await other.close();

    await page.context().clearCookies();
    const old = await page.request.post('/api/v1/auth/sign-in', {
      headers: { Origin: origin() },
      data: a,
    });
    expect(old.status()).toBe(401);
    const fresh = await page.request.post('/api/v1/auth/sign-in', {
      headers: { Origin: origin() },
      data: { email: a.email, password: 'a-brand-new-passphrase-9' },
    });
    expect(fresh.status()).toBe(200);
  });

  test('delete account: needs the password, removes everything, signs out', async ({ page }) => {
    const a = await signUp(page);
    await page.request.post('/api/v1/me/saved-models', {
      headers: { Origin: origin() },
      data: { slug: MODEL },
    });
    await gotoReady(page, '/settings');
    const section = page.locator('section[aria-labelledby="danger"]');
    await expect(section.getByRole('button', { name: 'Delete my account' })).toHaveCount(0); // needs the password first
    await section.getByLabel('Your password').fill('wrong-password-123');
    await section.getByRole('button', { name: 'Delete my account' }).click();
    await section.getByRole('button', { name: /Yes, delete my account/ }).click();
    await expect(section.getByRole('alert')).toContainText('password is incorrect');

    await section.getByLabel('Your password').fill(a.password);
    await section.getByRole('button', { name: 'Delete my account' }).click();
    await section.getByRole('button', { name: /Yes, delete my account/ }).click();
    await expect(page).toHaveURL(/\/\?account=deleted$/);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();

    const res = await page.request.post('/api/v1/auth/sign-in', {
      headers: { Origin: origin() },
      data: a,
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('quality', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`sign-up has no axe violations (${theme})`, async ({ page }) => {
      await setTheme(page, theme);
      await gotoReady(page, '/sign-up');
      await expectNoViolations(page);
    });

    test(`account (empty and populated), settings and the account menu have no axe violations (${theme})`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await signUp(page, 'Ada Tester');
      await gotoReady(page, '/account');
      await expectNoViolations(page);

      await page.request.post('/api/v1/me/saved-models', {
        headers: { Origin: origin() },
        data: { slug: MODEL },
      });
      await page.request.post('/api/v1/me/comparisons', {
        headers: { Origin: origin() },
        data: { name: 'Pair', models: [MODEL, 'sample-model-2'] },
      });
      await gotoReady(page, '/account');
      await expectNoViolations(page);

      await gotoReady(page, '/settings');
      await expectNoViolations(page);

      await gotoReady(page, `/models/${MODEL}`);
      await accountMenu(page).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expectNoViolations(page);
      await page.keyboard.press('Escape');

      await gotoReady(page, '/');
      await expect(page.getByRole('heading', { level: 2, name: 'For you' })).toBeVisible();
      await expectNoViolations(page);
    });
  }

  test('mobile: no horizontal overflow, the drawer offers the account links, screenshots', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    mkdirSync(SHOTS, { recursive: true });
    await gotoReady(page, '/sign-up');
    await page.screenshot({ path: `${SHOTS}/sign-up-390.png`, fullPage: true });

    await signUp(page, 'Ada Tester');
    await page.request.post('/api/v1/me/saved-models', {
      headers: { Origin: origin() },
      data: { slug: MODEL },
    });
    for (const [name, url] of [
      ['account', '/account'],
      ['settings', '/settings'],
      ['home', '/'],
    ] as const) {
      await gotoReady(page, url);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${name} at 390px`).toBeLessThanOrEqual(0);
      await animationsSettled(page);
      await page.screenshot({ path: `${SHOTS}/${name}-signed-in-390.png`, fullPage: true });
    }

    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('link', { name: 'Saved and recent' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Open menu' })).toBeVisible();
  });
});
