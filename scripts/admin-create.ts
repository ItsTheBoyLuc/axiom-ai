import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { normalizeEmail } from '../src/lib/auth/credentials';
import { createOrRotateAdmin } from '../server/auth/admin-user';
import { randomPassword } from '../server/auth/crypto';
import { createPrisma } from '../server/db/client';

/**
 * `npm run admin:create -- --email you@example.com [--rotate] [--out /path/to/file]`
 *
 * Creates the first administrator (or promotes an account, or with --rotate replaces an admin's
 * password and signs them out everywhere). The password is generated here, written ONLY to the
 * git-ignored file `.admin-credentials.local` (mode 600) and never printed, logged or committed.
 * There is no default password anywhere in this project.
 *
 * In a container the working directory is not writable, so `--out` (or ADMIN_CREDENTIALS_FILE)
 * names a file on a mounted volume instead; see docs/DEPLOYMENT.md.
 */
const DEFAULT_FILE = '.admin-credentials.local';

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--'))
    return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  return eq?.slice(flag.length + 1);
}

/** Refuses to write a secret into a file inside the repository that git would pick up. */
function assertSafeLocation(file: string) {
  const rel = relative(process.cwd(), file).split('\\').join('/');
  const inside = !rel.startsWith('..') && !isAbsolute(rel);
  if (!inside) return; // outside the repository (a mounted volume): nothing for git to pick up
  const ignore = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';
  if (!ignore.split(/\r?\n/).some((l) => l.trim() === rel || l.trim() === `/${rel}`)) {
    throw new Error(`${rel} is not listed in .gitignore; refusing to write it.`);
  }
}

async function main() {
  const email = normalizeEmail(arg('email') ?? process.env.ADMIN_EMAIL ?? '');
  if (!email || !email.includes('@')) {
    throw new Error('Usage: npm run admin:create -- --email you@example.com [--rotate]');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const file = resolve(
    process.cwd(),
    arg('out') ?? process.env.ADMIN_CREDENTIALS_FILE ?? DEFAULT_FILE,
  );
  assertSafeLocation(file);
  // Prove the file is writable BEFORE touching the database: an administrator created whose
  // password could not be saved would be locked out and need a rotation.
  try {
    writeFileSync(file, '', { mode: 0o600, flag: 'a' });
  } catch (err) {
    throw new Error(
      `Cannot write ${file} (${err instanceof Error ? err.message : err}). ` +
        'In a container, mount a writable volume and pass --out (docs/DEPLOYMENT.md).',
    );
  }

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
      file,
      `email: ${email}\npassword: ${password}\ncreated: ${new Date().toISOString()}\n` +
        `# Local only (git-ignored). Sign in, then delete this file or move it to a password manager.\n`,
      { mode: 0o600 },
    );
    console.log(`[admin] ${result.action} administrator ${email}.`);
    console.log(`[admin] The generated password was written to ${file} (not printed).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[admin] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
