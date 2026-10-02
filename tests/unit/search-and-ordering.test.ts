import { describe, expect, it } from 'vitest';
import { demoModelDetails } from '../../prisma/seed/demo/models';
import { buildSearchDocumentText, searchScore } from '../../server/repositories/model-query';
import { fromDbEnum, fromDbEnums, monogramOf, toDbEnum, toDbEnums } from '../../server/db/mappers';
import { pickLatest } from '../../src/lib/models/benchmarks';
import {
  sortCapabilities,
  sortHistory,
  sortPricing,
  sortResults,
} from '../../src/lib/models/ordering';
import { compareKeys, normalizeText, searchTokens, sortKey } from '../../src/lib/text';
import { toListItem } from '../support/in-memory-model-repository';

describe('search document semantics (SQL substring search must equal the in-memory search)', () => {
  const items = demoModelDetails.map(toListItem);
  const queries = [
    'sample',
    'Sample Model 1',
    'model 12',
    'video',
    'audio generation',
    'embedding',
    'coding llm',
    'demo provider g',
    'zzz',
    'text generation',
    'tool calling',
    'placeholder record',
    'g',
    'a b',
    'reasoning coding',
    'SAMPLE FAMILY',
    'image-generation',
    '1',
    '%',
    '_',
    "'",
    '"',
    '\\',
    'ü',
    '  padded   query ',
  ];

  it('a query matches the blob exactly when the in-memory score says so', () => {
    for (const item of items) {
      const doc = buildSearchDocumentText(item);
      for (const q of queries) {
        const tokens = searchTokens(q);
        const blobMatch = tokens.every((t) => doc.includes(t));
        expect(blobMatch, `${item.slug} / "${q}"`).toBe(searchScore(item, q) > 0);
      }
    }
  });

  it('is lowercase, accent-free and one line per field (tokens cannot span fields)', () => {
    const doc = buildSearchDocumentText({
      name: 'Café MODEL',
      family: 'Fam',
      providerName: 'P',
      description: 'D',
      capabilities: ['text-generation'],
      categories: ['llm'],
    });
    expect(doc).toBe('cafe model\nfam\np\ntext generation\nllm\nd');
    expect(doc.split('\n')).toHaveLength(6);
  });

  it('normalises text and tokens', () => {
    expect(normalizeText('École  Supérieure')).toBe('ecole  superieure');
    expect(searchTokens('  A  B\tc ')).toEqual(['a', 'b', 'c']);
    expect(searchTokens('   ')).toEqual([]);
  });

  it('sort keys compare by code point, matching COLLATE "C"', () => {
    expect(['banana', 'Zed', 'apple'].sort((a, b) => compareKeys(a, b))).toEqual([
      'Zed',
      'apple',
      'banana',
    ]);
    // ...but sortKey lowercases first, so "Zed" lands where a reader expects:
    expect(['banana', 'Zed', 'apple'].sort((a, b) => compareKeys(sortKey(a), sortKey(b)))).toEqual([
      'apple',
      'banana',
      'Zed',
    ]);
  });
});

describe('canonical ordering', () => {
  it('orders capabilities by the taxonomy, not insertion order', () => {
    expect(sortCapabilities(['reasoning', 'text-generation', 'tool-calling'])).toEqual([
      'text-generation',
      'tool-calling',
      'reasoning',
    ]);
  });

  it('orders results by benchmark name, then newest, then most trusted evaluation', () => {
    const r = (
      n: string,
      d: string,
      t: 'INDEPENDENT' | 'PROVIDER_REPORTED' | 'COMMUNITY',
      v = '1',
    ) => ({
      benchmarkSlug: n,
      benchmarkName: n,
      category: 'x',
      benchmarkVersion: null,
      score: 1,
      scoreUnit: '%',
      evaluationDate: d,
      modelVersion: v,
      methodologyNotes: null,
      evaluationType: t,
      sourceUrl: null,
      isDemo: true,
    });
    const sorted = sortResults([
      r('B', '2026-01-01', 'INDEPENDENT'),
      r('A', '2026-01-01', 'COMMUNITY'),
      r('A', '2026-03-01', 'PROVIDER_REPORTED'),
      r('A', '2026-03-01', 'INDEPENDENT'),
    ]);
    expect(
      sorted.map((x) => `${x.benchmarkName}${x.evaluationDate}${x.evaluationType[0]}`),
    ).toEqual(['A2026-03-01I', 'A2026-03-01P', 'A2026-01-01C', 'B2026-01-01I']);
  });

  it('orders prices current-first, by type, newest first; history newest first', () => {
    const p = (type: 'INPUT' | 'OUTPUT', isCurrent: boolean, from: string) => ({
      type,
      price: 1,
      currency: 'USD',
      unit: 'u',
      effectiveFrom: from,
      effectiveTo: null,
      isCurrent,
      sourceUrl: null,
      verifiedAt: null,
      isDemo: true,
    });
    expect(
      sortPricing([
        p('OUTPUT', false, '2025-01-01'),
        p('OUTPUT', true, '2026-01-01'),
        p('INPUT', true, '2026-01-01'),
      ]).map((x) => `${x.type}${x.isCurrent}`),
    ).toEqual(['INPUTtrue', 'OUTPUTtrue', 'OUTPUTfalse']);
    const h = (date: string, kind: 'MAJOR' | 'MINOR', title = 't') => ({
      date,
      kind,
      title,
      description: '',
      sourceUrl: null,
    });
    expect(
      sortHistory([
        h('2026-01-01', 'MINOR'),
        h('2026-02-01', 'MAJOR'),
        h('2026-01-01', 'MAJOR'),
      ]).map((x) => x.date + x.kind),
    ).toEqual(['2026-02-01MAJOR', '2026-01-01MAJOR', '2026-01-01MINOR']);
  });

  it('picks the latest result: newest date, then most trusted type, then first', () => {
    const r = (d: string, t: 'INDEPENDENT' | 'PROVIDER_REPORTED' | 'COMMUNITY', tag: string) => ({
      evaluationDate: d,
      evaluationType: t,
      tag,
    });
    expect(
      pickLatest([r('2026-01-01', 'INDEPENDENT', 'old'), r('2026-02-01', 'COMMUNITY', 'new')])?.tag,
    ).toBe('new');
    expect(
      pickLatest([r('2026-02-01', 'PROVIDER_REPORTED', 'p'), r('2026-02-01', 'INDEPENDENT', 'i')])
        ?.tag,
    ).toBe('i');
    expect(
      pickLatest([
        r('2026-02-01', 'INDEPENDENT', 'first'),
        r('2026-02-01', 'INDEPENDENT', 'second'),
      ])?.tag,
    ).toBe('first');
    expect(pickLatest([])).toBeNull();
  });
});

describe('database enum mapping', () => {
  it('round-trips kebab-case and UPPER_SNAKE_CASE', () => {
    expect(toDbEnum('image-generation')).toBe('IMAGE_GENERATION');
    expect(fromDbEnum('FREE_TIER')).toBe('free-tier');
    expect(toDbEnums(['llm', 'open-weights'])).toEqual(['LLM', 'OPEN_WEIGHTS']);
    expect(fromDbEnums(['CLOUD_API', 'LOCAL'])).toEqual(['cloud-api', 'local']);
  });

  it('derives a provider monogram from the name when none is stored', () => {
    expect(monogramOf('OpenExample', null)).toBe('O');
    expect(monogramOf('  élan', null)).toBe('É');
    expect(monogramOf('123 Labs', null)).toBe('1');
    expect(monogramOf('---', null)).toBe('?');
    expect(monogramOf('Acme', 'Z')).toBe('Z');
  });
});
