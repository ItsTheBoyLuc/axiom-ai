import { z } from 'zod';

/**
 * Credential rules shared by sign-in, the admin CLI and (Phase 9) sign-up. Pure and React-free.
 * Passwords follow current NIST guidance: length over composition rules, no maximum so low that
 * passphrases are refused, and no silent truncation (the hash input is the whole password).
 */

export const MIN_PASSWORD_LENGTH = 12;
/** Upper bound only to stop a request from making the server hash megabytes. */
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;

/** Lower-cased and trimmed: "Ada@Example.com " and "ada@example.com" are one account. */
export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

const email = z
  .string()
  .max(MAX_EMAIL_LENGTH)
  .transform(normalizeEmail)
  .pipe(z.email('Enter a valid email address'));

/** Sign-in input. The password is never trimmed or normalised; only its length is bounded. */
export const signInSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Enter your password').max(MAX_PASSWORD_LENGTH),
  /** Where to go after signing in; validated by safeNextPath, never trusted. */
  next: z.string().max(500).optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

/** A few very common choices that are long enough to pass a length check. */
const COMMON = new Set([
  'password1234',
  'password12345',
  '123456789012',
  'qwertyuiop12',
  'iloveyou1234',
  'letmein12345',
  'administrator',
  'welcome12345',
]);

export type PasswordIssue = 'too-short' | 'too-long' | 'common' | 'repetitive' | 'contains-email';

/** Returns what is wrong with a new password, or [] when it is acceptable. */
export function passwordIssues(password: string, emailAddress?: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) issues.push('too-short');
  if (password.length > MAX_PASSWORD_LENGTH) issues.push('too-long');
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) issues.push('common');
  if (new Set(password).size <= 3) issues.push('repetitive');
  const local = emailAddress ? normalizeEmail(emailAddress).split('@')[0]! : '';
  if (local.length >= 4 && lower.includes(local)) issues.push('contains-email');
  return issues;
}

export const passwordIssueText: Record<PasswordIssue, string> = {
  'too-short': `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  'too-long': `Use at most ${MAX_PASSWORD_LENGTH} characters.`,
  common: 'That password is too common.',
  repetitive: 'That password repeats too few characters.',
  'contains-email': 'The password must not contain your email name.',
};

/**
 * Only same-site relative paths are allowed after sign-in, so the form cannot be used as an open
 * redirect. Anything else (absolute URLs, protocol-relative `//host`, backslash tricks, control
 * characters) falls back to the fallback path.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  try {
    // Also refuse what the path decodes to: %0d%0a (CRLF) or %5c (backslash) must not slip through.
    if (/[\u0000-\u001f\u007f\\]/.test(decodeURIComponent(raw))) return fallback;
  } catch {
    return fallback; // malformed percent-encoding
  }
  try {
    const u = new URL(raw, 'http://local.invalid');
    if (u.origin !== 'http://local.invalid') return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
