import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './accounts';
import { gotoReady } from './helpers';

/** The browser reports every CSP violation as an event; collect them instead of hoping to see a log. */
async function watchViolations(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} blocked ${e.blockedURI || 'inline'} at ${e.sourceFile || e.documentURI}`,
      );
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? ['(no collector)']);
}

const ROUTES = [
  '/',
  '/models',
  '/models/sample-model-1',
  '/compare?models=sample-model-1,sample-model-2',
  '/benchmarks',
  '/providers',
  '/releases',
  '/news',
  '/search?q=sample',
  '/sign-in',
  '/sign-up',
];

test.describe('security headers', () => {
  test('pages carry a nonce-based CSP, a fresh nonce per request, and the static headers', async ({
    request,
  }) => {
    const a = await request.get('/models');
    const b = await request.get('/models');
    const csp = a.headers()['content-security-policy']!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
    const nonce = (h: string) => /'nonce-([^']+)'/.exec(h)![1];
    expect(nonce(csp)).not.toBe(nonce(b.headers()['content-security-policy']!));
    // The nonce on the response is the one the page's own scripts carry.
    expect(await a.text()).toContain(`nonce="${nonce(csp)}"`);
    const h = a.headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['x-powered-by']).toBeUndefined();
    // Plain HTTP in the tests: HSTS must not be sent here.
    expect(h['strict-transport-security']).toBeUndefined();
  });

  test('HSTS is sent when the request came in over HTTPS (behind a TLS proxy)', async ({
    request,
  }) => {
    const res = await request.get('/models', { headers: { 'x-forwarded-proto': 'https' } });
    expect(res.headers()['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
    expect(res.headers()['content-security-policy']).toContain('upgrade-insecure-requests');
  });

  test('API responses are locked down and never framed or scripted', async ({ request }) => {
    const res = await request.get('/api/v1/stats');
    expect(res.headers()['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    const docs = await request.get('/api/docs');
    expect(docs.headers()['content-security-policy']).toContain("default-src 'none'");
  });

  test('API errors keep the envelope (the 429 budget itself is covered by integration tests)', async ({
    request,
  }) => {
    // Limiting is switched off in the e2e server: every spec shares one client address.
    const res = await request.get('/api/v1/models?bogus=1');
    expect(res.status()).toBe(400);
  });
});

test.describe('CSP: nothing the product needs is blocked', () => {
  test('no violations on any main route, with the palette and menus opened', async ({ page }) => {
    const violations = await watchViolations(page);
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) errors.push(m.text());
    });
    for (const route of ROUTES) {
      await gotoReady(page, route);
      expect(await violations(), route).toEqual([]);
    }
    await gotoReady(page, '/models');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.type('sample');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Change theme' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    expect(await violations(), 'palette and theme menu').toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the inline theme script still runs (it carries the nonce): saved theme applies before paint', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('axiom-theme', 'light'));
    await page.goto('/models');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('CSP: the admin area', () => {
  test.use({ storageState: ADMIN_STATE });

  test('no violations on the dashboard, editor, sync and users pages', async ({ page }) => {
    const violations = await watchViolations(page);
    for (const route of [
      '/admin',
      '/admin/models',
      '/admin/models/new',
      '/admin/sync',
      '/admin/users',
      '/admin/audit',
    ]) {
      await gotoReady(page, route);
      expect(await violations(), route).toEqual([]);
    }
  });
});

test.describe('no server secrets in the client bundles', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(js|css|map)$/.test(f) ? [p] : [];
    });
  }

  test('connection strings, password hashing and server-only modules never reach the browser', () => {
    const files = walk('.next/static');
    expect(files.length).toBeGreaterThan(5);
    const forbidden = [
      /postgres(ql)?:\/\//i,
      /redis:\/\//i,
      /passwordHash/,
      /@node-rs\/argon2/,
      /DATABASE_URL/,
      /REDIS_URL/,
      /POSTGRES_PASSWORD/,
      /APP_DB_PASSWORD/,
    ];
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const re of forbidden) if (re.test(text)) hits.push(`${f}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});
