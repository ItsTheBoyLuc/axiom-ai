import type { OpenApiDoc } from './openapi';

type Param = {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema: { type?: string; enum?: unknown[] };
};
type Op = {
  summary: string;
  description?: string;
  tags: string[];
  parameters: Param[];
  responses: Record<string, { description: string }>;
};

const cell = (s: string) => s.replaceAll('|', '\|').replaceAll('\n', ' ');
const typeText = (p: Param) =>
  p.schema.enum ? p.schema.enum.map(String).join(' \| ') : (p.schema.type ?? 'string');

/**
 * Markdown rendering of the public read API, from the same OpenAPI document that serves
 * /api/docs. docs/API.md embeds it between markers and a unit test fails when the file is stale,
 * so the written reference cannot drift from the handlers (`npm run docs:api` regenerates it).
 */
export function renderApiMarkdown(doc: OpenApiDoc): string {
  const byTag = new Map<string, { method: string; path: string; op: Op }[]>();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(item as Record<string, Op>)) {
      const tag = op.tags[0] ?? 'Other';
      byTag.set(tag, [...(byTag.get(tag) ?? []), { method, path, op }]);
    }
  }
  const out: string[] = [];
  for (const [tag, ops] of byTag) {
    out.push(`### ${tag}`, '');
    for (const { method, path, op } of ops) {
      out.push(`#### \`${method.toUpperCase()} /api/v1${path}\``, '', op.summary + '.', '');
      if (op.description) out.push(op.description, '');
      if (op.parameters.length) {
        out.push(
          '| Parameter | In | Type | Required | Description |',
          '| --- | --- | --- | --- | --- |',
        );
        for (const p of op.parameters) {
          out.push(
            `| \`${p.name}\` | ${p.in} | ${cell(typeText(p))} | ${p.required ? 'yes' : 'no'} | ${cell(p.description ?? '')} |`,
          );
        }
        out.push('');
      }
      out.push(
        'Responses: ' +
          Object.entries(op.responses)
            .map(([code, r]) => `\`${code}\` ${r.description}`)
            .join('; ') +
          '.',
        '',
      );
    }
  }
  return out.join('\n').trimEnd() + '\n';
}
