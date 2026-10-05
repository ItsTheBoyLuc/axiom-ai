/**
 * Regenerates the public-API section of docs/API.md from the OpenAPI document.
 * `npm run docs:api`. A unit test (tests/unit/api-doc.test.ts) fails when it is stale.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildOpenApi } from '../server/api/openapi';
import { renderApiMarkdown } from '../server/api/markdown-docs';

const FILE = 'docs/API.md';
export const BEGIN = '<!-- BEGIN GENERATED: public read API (npm run docs:api) -->';
export const END = '<!-- END GENERATED -->';

const current = readFileSync(FILE, 'utf8');
const start = current.indexOf(BEGIN);
const end = current.indexOf(END);
if (start === -1 || end === -1) throw new Error(`${FILE} is missing the generated-section markers`);
const next = `${current.slice(0, start + BEGIN.length)}\n\n${renderApiMarkdown(buildOpenApi())}\n${current.slice(end)}`;
writeFileSync(FILE, next, 'utf8');
console.log(`${FILE} updated`);
