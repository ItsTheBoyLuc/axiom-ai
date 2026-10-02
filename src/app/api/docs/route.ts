import { renderDocsHtml } from '@server/api/docs-html';
import { buildOpenApi } from '@server/api/openapi';

/** GET /api/docs - human-readable API reference generated from the same schemas as the API. */
export function GET() {
  return new Response(renderDocsHtml(buildOpenApi()), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
