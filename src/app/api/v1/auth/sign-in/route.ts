import { handleSignIn } from '@server/auth/handlers';
import { authDeps } from '@server/auth/runtime';

// Per-request, per-user: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const POST = (request: Request) => handleSignIn(request, authDeps());
