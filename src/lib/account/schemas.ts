import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, normalizeEmail } from '@/lib/auth/credentials';
import { MAX_COMPARE } from '@/lib/comparison';

/**
 * Request shapes for sign-up and the signed-in account API (/api/v1/me/*). Shared by the server
 * handlers and the forms so both sides agree. The password policy itself (length, common
 * passwords, contains-email) lives in lib/auth/credentials.ts and is applied by the server.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'not a valid slug')
  .max(120);

export const signUpSchema = z.strictObject({
  email: z.string().max(254).transform(normalizeEmail).pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Choose a password').max(MAX_PASSWORD_LENGTH),
  name: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || undefined),
  next: z.string().max(500).optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const THEMES = ['system', 'dark', 'light'] as const;
export const MAX_PREFERRED_PROVIDERS = 20;

export const preferencesSchema = z.strictObject({
  theme: z.enum(THEMES).nullable(),
  preferredProviders: z
    .array(slug)
    .max(MAX_PREFERRED_PROVIDERS)
    .refine((a) => new Set(a).size === a.length, 'duplicate provider'),
  /** Show the personalised "For you" section on the home page. */
  personalized: z.boolean(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_PREFERENCES: Preferences = {
  theme: null,
  preferredProviders: [],
  personalized: true,
};

export const slugBody = z.strictObject({ slug });

export const MAX_COMPARISON_NAME = 80;
export const MAX_SAVED_COMPARISONS = 50;
export const MAX_SAVED_MODELS = 200;

export const comparisonBody = z.strictObject({
  name: z.string().trim().min(1, 'Give the comparison a name').max(MAX_COMPARISON_NAME),
  models: z
    .array(slug)
    .min(2, 'Compare at least two models')
    .max(MAX_COMPARE, `Compare at most ${MAX_COMPARE} models`)
    .refine((a) => new Set(a).size === a.length, 'duplicate model'),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, 'Enter your current password').max(MAX_PASSWORD_LENGTH),
  newPassword: z.string().min(1, 'Choose a new password').max(MAX_PASSWORD_LENGTH),
});

export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1, 'Enter your password').max(MAX_PASSWORD_LENGTH),
});
