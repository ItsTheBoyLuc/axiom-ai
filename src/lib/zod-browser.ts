import { z } from 'zod';

/**
 * In the browser, tell Zod not to probe for `new Function` support. Its JIT fast path is optional
 * (it falls back on its own), but the probe itself is reported as a violation by our CSP, which
 * forbids `unsafe-eval`. On the server the JIT stays on. Import this first in every module that
 * builds Zod schemas and can be bundled for the client.
 */
if (typeof window !== 'undefined') z.config({ jitless: true });
