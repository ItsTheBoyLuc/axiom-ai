import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token helpers for sessions. Server-only (node:crypto). */

/** 256 bits from the OS CSPRNG, URL-safe. The only copy of this value is in the user's cookie. */
export const newSessionToken = (): string => randomBytes(32).toString('base64url');

/**
 * What the database stores: the SHA-256 of the token, never the token. A leaked database (or
 * backup) therefore cannot be replayed as sessions. SHA-256 is right here because the input is
 * 256 random bits, so there is nothing to brute-force or rainbow-table (unlike passwords).
 */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Constant-time string comparison (equal length not required). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a comparison so timing does not reveal the length mismatch early.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** A random password for the admin CLI: 24 chars from an unambiguous alphabet (~140 bits). */
export function randomPassword(length = 24): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(length * 2);
  let out = '';
  for (const b of bytes) {
    // Rejection sampling: no modulo bias.
    if (b < 256 - (256 % alphabet.length)) out += alphabet[b % alphabet.length];
    if (out.length === length) break;
  }
  return out.length === length ? out : randomPassword(length);
}
