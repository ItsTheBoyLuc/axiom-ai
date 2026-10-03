import { request, type FullConfig } from '@playwright/test';
import { ADMIN_STATE, USER_STATE, ensureAuthDir, readAccounts } from './accounts';

/**
 * Signs the two e2e accounts in once through the real sign-in API and stores each session as a
 * Playwright storage state, so specs start signed in without repeating the (rate limited) login.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  const accounts = readAccounts();
  ensureAuthDir();

  for (const [account, file] of [
    [accounts.admin, ADMIN_STATE],
    [accounts.user, USER_STATE],
  ] as const) {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.post('/api/v1/auth/sign-in', {
      headers: { Origin: baseURL },
      data: { email: account.email, password: account.password },
    });
    if (!res.ok()) throw new Error(`e2e sign-in failed for ${account.email}: HTTP ${res.status()}`);
    await ctx.storageState({ path: file });
    await ctx.dispose();
  }
}
