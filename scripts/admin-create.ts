import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeEmail } from '../src/lib/auth/credentials';
import { createOrRotateAdmin } from '../server/auth/admin-user';
import { randomPassword } from '../server/auth/crypto';
import { createPrisma } from '../server/db/client';

/**
 * `npm run admin:create -- --email you@example.com [--rotate]`
 *
 * Creates the first administrator (or promotes an account, or with --rotate replaces an admin's
 * password and signs them out everywhere). The password is generated here, written ONLY to the
 * git-ignored file `.admin-credentials.local` and never printed, logged or committed. There is
 * no default password anywhere in this project.
 */
const CREDENTIALS_FILE = resolve(process.cwd(), '.admin-credentials.local');

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--'))
    return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  return eq?.slice(flag.length + 1);
}

/** Refuses to write a secret into a file git would pick up. */
function assertGitIgnored() {
  const ignore = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';
  if (!ignore.split(/\r?\n/).some((l) => l.trim() === '.admin-credentials.local')) {
    throw new Error('.admin-credentials.local is not listed in .gitignore; refusing to write it.');
  }
}

async function main() {
  const email = normalizeEmail(arg('email') ?? process.env.ADMIN_EMAIL ?? '');
  if (!email || !email.includes('@')) {
    throw new Error('Usage: npm run admin:create -- --email you@example.com [--rotate]');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  assertGitIgnored();

  const password = randomPassword();
  const db = createPrisma(url);
  try {
    const result = await createOrRotateAdmin(db, {
      email,
      password,
      rotate: process.argv.includes('--rotate'),
    });
    if (result.action === 'exists') {
      console.log(
        `[admin] ${email} is already an administrator. Use --rotate to set a new password.`,
      );
      return;
    }
    writeFileSync(
      CREDENTIALS_FILE,
      `email: ${email}\npassword: ${password}\ncreated: ${new Date().toISOString()}\n` +
        `# Local only (git-ignored). Sign in, then delete this file or move it to a password manager.\n`,
      { mode: 0o600 },
    );
    console.log(`[admin] ${result.action} administrator ${email}.`);
    console.log(`[admin] The generated password was written to ${CREDENTIALS_FILE} (not printed).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[admin] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
