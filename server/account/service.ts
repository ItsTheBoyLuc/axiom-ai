import { Prisma, type PrismaClient } from '../../prisma/generated/client';
import {
  DEFAULT_PREFERENCES,
  MAX_SAVED_COMPARISONS,
  MAX_SAVED_MODELS,
  type Preferences,
} from '../../src/lib/account/schemas';
import { passwordIssueText, passwordIssues } from '../../src/lib/auth/credentials';
import { isMotionPreference } from '../../src/lib/motion-preference';
import { compareHrefForSlugs } from '../../src/lib/comparison';
import { ApiError } from '../api/http';
import { recordAudit } from '../audit';
import { hashToken } from '../auth/crypto';
import { hashPassword, verifyPassword } from '../auth/password';
import { isoDateTime } from '../db/mappers';

/**
 * The signed-in person's own data: preferences, saved models, saved comparisons, recently viewed,
 * password and account deletion. EVERY query is scoped by the caller's user id, so one person can
 * never read or change another's data, and a foreign id looks exactly like a missing one (404).
 */

export type ModelBrief = { slug: string; name: string; providerName: string };

const brief = {
  slug: true,
  name: true,
  provider: { select: { name: true } },
} as const;
type BriefRow = { slug: string; name: string; provider: { name: string } };
const toBrief = (m: BriefRow): ModelBrief => ({
  slug: m.slug,
  name: m.name,
  providerName: m.provider.name,
});

const modelBySlug = async (db: PrismaClient, slug: string) =>
  db.model.findUnique({ where: { slug }, select: { id: true, ...brief } });

// ---------------------------------------------------------------- preferences

type PrefRow = { theme: string | null; preferredProviders: string[]; settings: unknown } | null;

export function toPreferences(row: PrefRow): Preferences {
  if (!row) return { ...DEFAULT_PREFERENCES };
  const settings = (row.settings ?? {}) as { personalized?: unknown; motion?: unknown };
  const theme =
    row.theme === 'system' || row.theme === 'dark' || row.theme === 'light' ? row.theme : null;
  return {
    theme,
    preferredProviders: row.preferredProviders,
    personalized: settings.personalized !== false,
    motion: isMotionPreference(settings.motion) ? settings.motion : null,
  };
}

export async function getPreferences(db: PrismaClient, userId: string): Promise<Preferences> {
  return toPreferences(
    await db.userPreference.findUnique({
      where: { userId },
      select: { theme: true, preferredProviders: true, settings: true },
    }),
  );
}

export async function setPreferences(
  db: PrismaClient,
  userId: string,
  prefs: Preferences,
): Promise<Preferences> {
  if (prefs.preferredProviders.length) {
    const found = await db.provider.findMany({
      where: { slug: { in: prefs.preferredProviders } },
      select: { slug: true },
    });
    const known = new Set(found.map((p) => p.slug));
    const unknown = prefs.preferredProviders.filter((s) => !known.has(s));
    if (unknown.length) {
      throw new ApiError(400, 'VALIDATION', 'Unknown provider', {
        issues: [
          { path: 'preferredProviders', message: `Unknown provider: ${unknown.join(', ')}` },
        ],
      });
    }
  }
  const data = {
    theme: prefs.theme,
    preferredProviders: prefs.preferredProviders,
    settings: { personalized: prefs.personalized, motion: prefs.motion },
  };
  await db.userPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return prefs;
}

// --------------------------------------------------------------- saved models

export type SavedModel = ModelBrief & { savedAt: string };

export async function listSavedModels(db: PrismaClient, userId: string): Promise<SavedModel[]> {
  const rows = await db.savedModel.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: MAX_SAVED_MODELS,
    select: { createdAt: true, model: { select: brief } },
  });
  return rows.map((r) => ({ ...toBrief(r.model), savedAt: isoDateTime(r.createdAt) }));
}

/** Just the slugs of the saved models (for the page chrome's "is this one saved?"). */
export async function savedSlugs(db: PrismaClient, userId: string): Promise<string[]> {
  const rows = await db.savedModel.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: MAX_SAVED_MODELS,
    select: { model: { select: { slug: true } } },
  });
  return rows.map((r) => r.model.slug);
}

/** Idempotent: saving twice is one saved model. */
export async function saveModel(db: PrismaClient, userId: string, slug: string): Promise<void> {
  const model = await modelBySlug(db, slug);
  if (!model) throw new ApiError(404, 'NOT_FOUND', 'model not found');
  const already = await db.savedModel.findUnique({
    where: { userId_modelId: { userId, modelId: model.id } },
    select: { userId: true },
  });
  if (already) return;
  if ((await db.savedModel.count({ where: { userId } })) >= MAX_SAVED_MODELS) {
    throw new ApiError(409, 'LIMIT', `You can save up to ${MAX_SAVED_MODELS} models.`);
  }
  await db.savedModel.upsert({
    where: { userId_modelId: { userId, modelId: model.id } },
    create: { userId, modelId: model.id },
    update: {},
  });
}

/** Idempotent: removing a model that is not saved (or does not exist) is not an error. */
export async function unsaveModel(db: PrismaClient, userId: string, slug: string): Promise<void> {
  await db.savedModel.deleteMany({ where: { userId, model: { slug } } });
}

// ---------------------------------------------------------- saved comparisons

export type SavedComparison = {
  id: string;
  name: string;
  models: ModelBrief[];
  createdAt: string;
  /** Where to reopen it. */
  href: string;
};

export async function listComparisons(
  db: PrismaClient,
  userId: string,
): Promise<SavedComparison[]> {
  const rows = await db.savedComparison.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: MAX_SAVED_COMPARISONS,
  });
  const slugs = [
    ...new Set(rows.flatMap((r) => (r.configuration as { models?: string[] }).models ?? [])),
  ];
  const models = await db.model.findMany({ where: { slug: { in: slugs } }, select: brief });
  const bySlug = new Map(models.map((m) => [m.slug, toBrief(m)]));
  return rows.map((r) => {
    const wanted = (r.configuration as { models?: string[] }).models ?? [];
    // A model that was removed from the catalogue since is simply left out of the list.
    const present = wanted.filter((s) => bySlug.has(s));
    return {
      id: r.id,
      name: r.name,
      models: present.map((s) => bySlug.get(s)!),
      createdAt: isoDateTime(r.createdAt),
      href: compareHrefForSlugs(present),
    };
  });
}

export async function saveComparison(
  db: PrismaClient,
  userId: string,
  input: { name: string; models: string[] },
): Promise<{ id: string }> {
  const found = await db.model.findMany({
    where: { slug: { in: input.models } },
    select: { slug: true },
  });
  const known = new Set(found.map((m) => m.slug));
  const unknown = input.models.filter((s) => !known.has(s));
  if (unknown.length) {
    throw new ApiError(400, 'VALIDATION', 'Unknown model', {
      issues: [{ path: 'models', message: `Unknown model: ${unknown.join(', ')}` }],
    });
  }
  if ((await db.savedComparison.count({ where: { userId } })) >= MAX_SAVED_COMPARISONS) {
    throw new ApiError(409, 'LIMIT', `You can save up to ${MAX_SAVED_COMPARISONS} comparisons.`);
  }
  const row = await db.savedComparison.create({
    data: { userId, name: input.name, configuration: { models: input.models } },
    select: { id: true },
  });
  return row;
}

/** Deletes one of the caller's own comparisons; anything else is a 404 (no ownership leak). */
export async function deleteComparison(
  db: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  const { count } = await db.savedComparison.deleteMany({ where: { id, userId } });
  if (count === 0) throw new ApiError(404, 'NOT_FOUND', 'comparison not found');
}

// ----------------------------------------------------------- recently viewed

export const MAX_RECENTLY_VIEWED = 30;
export type RecentModel = ModelBrief & { viewedAt: string };

export async function listRecentlyViewed(
  db: PrismaClient,
  userId: string,
  limit = 20,
): Promise<RecentModel[]> {
  const rows = await db.recentlyViewed.findMany({
    where: { userId },
    orderBy: { viewedAt: 'desc' },
    take: Math.min(limit, MAX_RECENTLY_VIEWED),
    select: { viewedAt: true, model: { select: brief } },
  });
  return rows.map((r) => ({ ...toBrief(r.model), viewedAt: isoDateTime(r.viewedAt) }));
}

/** Records a view (newest first, bounded). An unknown slug is ignored: a view is never an error. */
export async function recordView(
  db: PrismaClient,
  userId: string,
  slug: string,
  max = MAX_RECENTLY_VIEWED,
): Promise<void> {
  const model = await db.model.findUnique({ where: { slug }, select: { id: true } });
  if (!model) return;
  await db.recentlyViewed.upsert({
    where: { userId_modelId: { userId, modelId: model.id } },
    create: { userId, modelId: model.id },
    update: { viewedAt: new Date() },
  });
  const old = await db.recentlyViewed.findMany({
    where: { userId },
    orderBy: { viewedAt: 'desc' },
    skip: max,
    select: { modelId: true },
  });
  if (old.length) {
    await db.recentlyViewed.deleteMany({
      where: { userId, modelId: { in: old.map((o) => o.modelId) } },
    });
  }
}

// ------------------------------------------------------- password and account

export const PASSWORD_CHANGE_RULE = { limit: 5, windowSeconds: 15 * 60 };

/**
 * Changes the password after checking the current one. Every OTHER session is revoked (a stolen
 * session cannot outlive a password change); the one making the request stays signed in.
 */
export async function changePassword(
  db: PrismaClient,
  user: { id: string; email: string },
  input: { currentPassword: string; newPassword: string },
  currentToken: string | undefined,
  ip: string | null,
): Promise<void> {
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row?.passwordHash || !(await verifyPassword(row.passwordHash, input.currentPassword))) {
    throw new ApiError(400, 'INVALID_CREDENTIALS', 'The current password is incorrect.');
  }
  const issues = passwordIssues(input.newPassword, user.email);
  if (issues.length) {
    throw new ApiError(400, 'WEAK_PASSWORD', 'That password is not acceptable.', {
      issues: issues.map((i) => ({ path: 'newPassword', message: passwordIssueText[i] })),
    });
  }
  if (input.newPassword === input.currentPassword) {
    throw new ApiError(400, 'WEAK_PASSWORD', 'Choose a password you have not used just now.', {
      issues: [
        { path: 'newPassword', message: 'The new password must differ from the current one.' },
      ],
    });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.deleteMany({
      where: {
        userId: user.id,
        ...(currentToken ? { NOT: { sessionToken: hashToken(currentToken) } } : {}),
      },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'user.password-change',
      entityType: 'users',
      entityId: user.id,
      ip,
    });
  });
}

/**
 * Deletes the caller's account after re-checking the password. Sessions, saved items,
 * preferences and history go with it (ON DELETE CASCADE). Audit rows stay as a record that
 * something happened, but are scrubbed of personal data first: the email in earlier entries about
 * this account and every stored IP address of this person are removed, and the deletion itself is
 * logged without an email or an address. The last administrator cannot delete themselves (that
 * would lock the admin out).
 */
export async function deleteOwnAccount(
  db: PrismaClient,
  user: { id: string; email: string; role: string },
  password: string,
): Promise<void> {
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row?.passwordHash || !(await verifyPassword(row.passwordHash, password))) {
    throw new ApiError(400, 'INVALID_CREDENTIALS', 'The password is incorrect.');
  }
  await db.$transaction(async (tx) => {
    if (user.role === 'ADMIN' && (await tx.user.count({ where: { role: 'ADMIN' } })) <= 1) {
      throw new ApiError(409, 'CONFLICT', 'The last administrator cannot delete their account.');
    }
    await tx.auditLog.updateMany({
      where: { entityType: 'users', entityId: user.id },
      data: { before: Prisma.DbNull, after: Prisma.DbNull, ip: null },
    });
    await tx.auditLog.updateMany({ where: { actorId: user.id }, data: { ip: null } });
    await tx.user.delete({ where: { id: user.id } });
    await recordAudit(tx, {
      actorId: null,
      action: 'user.delete-self',
      entityType: 'users',
      entityId: user.id,
      before: { role: user.role },
      ip: null,
    });
  });
}
