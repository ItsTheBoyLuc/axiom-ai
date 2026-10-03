import { hash, verify, type Algorithm } from '@node-rs/argon2';

/**
 * Password hashing with Argon2id (docs/PROMPT.md 12), parameters from the OWASP Password Storage
 * Cheat Sheet (19 MiB, 2 passes, 1 lane). The salt is generated per hash and stored in the
 * PHC-format string, which also records the parameters so they can be raised later and old
 * hashes upgraded on sign-in (`needsRehash`).
 */
/** Algorithm.Argon2id is 2 (a const enum cannot be imported as a value under isolatedModules). */
const ARGON2ID = 2 as Algorithm;
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (password: string): Promise<string> => hash(password, OPTIONS);

/** False for a wrong password and for a malformed stored hash; never throws on bad input. */
export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** True when a stored hash was made with weaker parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const m = /^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(stored);
  if (!m) return true;
  return (
    Number(m[1]) < OPTIONS.memoryCost ||
    Number(m[2]) < OPTIONS.timeCost ||
    Number(m[3]) < OPTIONS.parallelism
  );
}

let dummy: Promise<string> | undefined;

/**
 * Verifies against a throw-away hash. Sign-in calls this when the email is unknown, so the time
 * to answer does not reveal whether an account exists.
 */
export async function spendHashTime(password: string): Promise<void> {
  dummy ??= hashPassword('not-a-real-password-used-only-for-timing');
  await verifyPassword(await dummy, password);
}
