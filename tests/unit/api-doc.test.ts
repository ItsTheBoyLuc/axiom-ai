import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOpenApi } from '../../server/api/openapi';
import { renderApiMarkdown } from '../../server/api/markdown-docs';

describe('docs/API.md', () => {
  const file = readFileSync('docs/API.md', 'utf8');
  const BEGIN = '<!-- BEGIN GENERATED: public read API (npm run docs:api) -->';
  const END = '<!-- END GENERATED -->';
  const section = file.slice(file.indexOf(BEGIN) + BEGIN.length, file.indexOf(END)).trim();

  it('has the generated public-API section, up to date with the endpoint registry (run `npm run docs:api`)', () => {
    expect(section.length).toBeGreaterThan(500);
    // Prettier re-aligns Markdown tables, so compare without whitespace and separator dashes.
    const flat = (t: string) => t.replace(/\s+/g, '').replace(/-{3,}/g, '---');
    expect(flat(section)).toBe(flat(renderApiMarkdown(buildOpenApi())));
  });

  it('documents every public path', () => {
    for (const path of Object.keys(buildOpenApi().paths)) {
      expect(section, path).toContain(`/api/v1${path}`);
    }
  });
});
