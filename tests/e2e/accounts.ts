import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Test accounts for the e2e database. prepare-db.ts creates them with random passwords and
 * writes the credentials to a git-ignored file; global-setup signs both in once and stores the
 * sessions, so no spec spends the sign-in rate limit.
 */
export const E2E_CREDENTIALS_FILE = resolve(process.cwd(), '.e2e-credentials.local');
export const E2E_AUTH_DIR = resolve(process.cwd(), '.e2e-auth');
export const ADMIN_STATE = resolve(E2E_AUTH_DIR, 'admin.json');
export const USER_STATE = resolve(E2E_AUTH_DIR, 'user.json');

export type Account = { email: string; password: string };

export function readAccounts(): { admin: Account; user: Account } {
  return JSON.parse(readFileSync(E2E_CREDENTIALS_FILE, 'utf8')) as {
    admin: Account;
    user: Account;
  };
}

export const ensureAuthDir = () => mkdirSync(E2E_AUTH_DIR, { recursive: true });
