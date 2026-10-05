import { handleSignUp } from '@server/auth/handlers';
import { authDeps } from '@server/auth/runtime';

// Per-request: never prerendered or cached.
export const dynamic = 'force-dynamic';

export const POST = (request: Request) => handleSignUp(request, authDeps());
