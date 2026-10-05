import { z } from 'zod';
import {
  changePasswordSchema,
  comparisonBody,
  deleteAccountSchema,
  preferencesSchema,
  slugBody,
} from '../../src/lib/account/schemas';
import { readJson } from '../api/body';
import { ApiError } from '../api/http';
import { clearSessionCookie, readCookie } from '../auth/cookie';
import { guardedRoute, type GuardCtx, type GuardDeps, type GuardResult } from '../auth/guard';
import type { RateRule } from '../auth/rate-limit';
import {
  PASSWORD_CHANGE_RULE,
  changePassword,
  deleteComparison,
  deleteOwnAccount,
  getPreferences,
  listComparisons,
  listRecentlyViewed,
  listSavedModels,
  recordView,
  saveComparison,
  saveModel,
  setPreferences,
  unsaveModel,
} from './service';

/**
 * Handlers for /api/v1/me/*: the signed-in person's own data. Every one runs inside
 * `meRoute` (session, same-origin on writes, per-user rate limit) and only ever touches rows
 * owned by `ctx.user`.
 */

export type MeCtx = GuardCtx<GuardDeps>;

export function meRoute(
  run: (ctx: MeCtx) => Promise<GuardResult>,
  deps: () => GuardDeps,
  opts: { rule?: RateRule } = {},
) {
  return guardedRoute<GuardDeps>('USER', run, deps, { ...opts, bucket: 'me' });
}

const slugParam = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const idParam = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const param = <S extends z.ZodType>(schema: S, ctx: MeCtx, name: string): z.output<S> => {
  const parsed = schema.safeParse(ctx.params[name]);
  if (!parsed.success) throw new ApiError(404, 'NOT_FOUND', 'Not found');
  return parsed.data;
};

// ---------------------------------------------------------------- preferences
export async function getPreferencesRoute(ctx: MeCtx): Promise<GuardResult> {
  return { data: await getPreferences(ctx.deps.db, ctx.user.id) };
}
export async function putPreferencesRoute(ctx: MeCtx): Promise<GuardResult> {
  const prefs = await readJson(ctx.request, preferencesSchema);
  return { data: await setPreferences(ctx.deps.db, ctx.user.id, prefs) };
}

// --------------------------------------------------------------- saved models
export async function listSavedModelsRoute(ctx: MeCtx): Promise<GuardResult> {
  return { data: await listSavedModels(ctx.deps.db, ctx.user.id) };
}
export async function saveModelRoute(ctx: MeCtx): Promise<GuardResult> {
  const { slug } = await readJson(ctx.request, slugBody);
  await saveModel(ctx.deps.db, ctx.user.id, slug);
  return { status: 201, data: { slug, saved: true } };
}
export async function unsaveModelRoute(ctx: MeCtx): Promise<GuardResult> {
  const slug = param(slugParam, ctx, 'slug');
  await unsaveModel(ctx.deps.db, ctx.user.id, slug);
  return { data: { slug, saved: false } };
}

// ---------------------------------------------------------- saved comparisons
export async function listComparisonsRoute(ctx: MeCtx): Promise<GuardResult> {
  return { data: await listComparisons(ctx.deps.db, ctx.user.id) };
}
export async function saveComparisonRoute(ctx: MeCtx): Promise<GuardResult> {
  const body = await readJson(ctx.request, comparisonBody);
  return { status: 201, data: await saveComparison(ctx.deps.db, ctx.user.id, body) };
}
export async function deleteComparisonRoute(ctx: MeCtx): Promise<GuardResult> {
  await deleteComparison(ctx.deps.db, ctx.user.id, param(idParam, ctx, 'id'));
  return { data: { ok: true } };
}

// ------------------------------------------------------------ recently viewed
export async function listRecentlyViewedRoute(ctx: MeCtx): Promise<GuardResult> {
  return { data: await listRecentlyViewed(ctx.deps.db, ctx.user.id) };
}
export async function recordViewRoute(ctx: MeCtx): Promise<GuardResult> {
  const { slug } = await readJson(ctx.request, slugBody);
  await recordView(ctx.deps.db, ctx.user.id, slug);
  return { data: { ok: true } };
}

// --------------------------------------------------- password and the account
async function limited(ctx: MeCtx, key: string) {
  const verdict = await ctx.deps.limiter.hit(`${key}:${ctx.user.id}`, PASSWORD_CHANGE_RULE);
  if (!verdict.allowed) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.', undefined, {
      'Retry-After': String(verdict.retryAfterSeconds),
    });
  }
}

export async function changePasswordRoute(ctx: MeCtx): Promise<GuardResult> {
  await limited(ctx, 'pwchange');
  const body = await readJson(ctx.request, changePasswordSchema);
  const token = readCookie(ctx.request.headers.get('cookie'), ctx.deps.cookie.name);
  await changePassword(ctx.deps.db, ctx.user, body, token, ctx.ip);
  return { data: { ok: true } };
}

export async function deleteAccountRoute(ctx: MeCtx): Promise<GuardResult> {
  await limited(ctx, 'acctdel');
  const { password } = await readJson(ctx.request, deleteAccountSchema);
  await deleteOwnAccount(ctx.deps.db, ctx.user, password, ctx.ip);
  return new Response(JSON.stringify({ data: { ok: true } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearSessionCookie(ctx.deps.cookie),
    },
  });
}
