import type { OpenApiDoc } from './openapi';

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

type Param = {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema: { type?: string; enum?: unknown[] };
};
type Op = {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters: Param[];
  responses: Record<string, { description: string }>;
};

const typeText = (p: Param) =>
  p.schema.enum ? p.schema.enum.map(String).join(' | ') : (p.schema.type ?? 'string');

/**
 * Dependency-free HTML rendering of the OpenAPI document (no scripts, no external assets), so
 * /api/docs works offline and under a strict CSP. Every value is HTML-escaped.
 */
export function renderDocsHtml(doc: OpenApiDoc): string {
  const byTag = new Map<string, { method: string; path: string; op: Op }[]>();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(item as Record<string, Op>)) {
      const tag = op.tags[0] ?? 'Other';
      byTag.set(tag, [...(byTag.get(tag) ?? []), { method, path, op }]);
    }
  }

  const sections = [...byTag.entries()]
    .map(
      ([tag, ops]) => `
    <section>
      <h2>${esc(tag)}</h2>
      ${ops
        .map(
          ({ method, path, op }) => `
        <article id="${esc(op.operationId)}">
          <h3><span class="m">${esc(method.toUpperCase())}</span> <code>/api/v1${esc(path)}</code></h3>
          <p>${esc(op.summary)}</p>
          ${op.description ? `<p class="d">${esc(op.description)}</p>` : ''}
          ${
            op.parameters.length
              ? `<table><thead><tr><th>Parameter</th><th>In</th><th>Type</th><th>Required</th></tr></thead><tbody>${op.parameters
                  .map(
                    (p) =>
                      `<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.in)}</td><td>${esc(typeText(p))}</td><td>${p.required ? 'yes' : 'no'}</td></tr>`,
                  )
                  .join('')}</tbody></table>`
              : ''
          }
          <p class="r">Responses: ${Object.entries(op.responses)
            .map(
              ([code, r]) => `<span title="${esc(r.description)}"><code>${esc(code)}</code></span>`,
            )
            .join(' ')}</p>
        </article>`,
        )
        .join('')}
    </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(doc.info.title)} - reference</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#0b0d12; --muted:#4b5263; --line:#d9dce3; --acc:#2350cf; }
  @media (prefers-color-scheme: dark) { :root { --bg:#08090c; --fg:#f5f7fa; --muted:#a0a7b7; --line:#232733; --acc:#7da0ff; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui, sans-serif; }
  main { max-width: 60rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
  h1 { font-size: 2rem; letter-spacing: -0.03em; margin: 0 0 .5rem; }
  h2 { margin-top: 2.5rem; border-bottom: 1px solid var(--line); padding-bottom: .4rem; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 .25rem; }
  code { font: 0.9em ui-monospace, monospace; }
  .m { display:inline-block; min-width: 3rem; color: var(--acc); font: 600 .8rem ui-monospace, monospace; }
  .d, .r { color: var(--muted); font-size: .92rem; margin: .25rem 0; }
  a { color: var(--acc); }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; margin: .5rem 0; }
  th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; }
  article { padding-bottom: .5rem; }
</style>
</head>
<body>
<main>
  <h1>${esc(doc.info.title)}</h1>
  <p>${esc(doc.info.description)}</p>
  <p>Machine-readable: <a href="/api/docs/openapi.json">openapi.json</a> (OpenAPI ${esc(doc.openapi)}). Errors use the envelope <code>{ "error": { "code", "message", "details?" } }</code>. Successful responses carry an <code>ETag</code>; send it in <code>If-None-Match</code> to receive <code>304</code>.</p>
  ${sections}
</main>
</body>
</html>`;
}
