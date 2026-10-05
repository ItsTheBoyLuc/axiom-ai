import { listComparisonsRoute, meRoute, saveComparisonRoute } from '@server/account/routes';
import { meDeps } from '@server/account/runtime';

// Per-request, per-user: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const GET = meRoute(listComparisonsRoute, meDeps);
export const POST = meRoute(saveComparisonRoute, meDeps);
