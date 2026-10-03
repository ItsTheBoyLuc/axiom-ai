import { describe, expect, it } from 'vitest';
import { SEED_FILES, validateBundle, type SeedFile } from '../../prisma/seed/schemas';
import {
  ENTITY_FIELDS,
  buildPayload,
  fieldOfPath,
  initialValues,
  isoToLocalInput,
  localInputToIso,
  type FormValues,
} from '../../src/lib/admin/fields';
import { ADMIN_ENTITIES, DEFINITIONS } from '../../server/admin/definitions';

const SERVER_OWNED = new Set(['collectedAt', 'isDemo', 'createdAt', 'updatedAt']);

describe('admin field lists mirror the seed schemas', () => {
  it.each(ADMIN_ENTITIES)('%s: every schema field has exactly one editor field', (entity) => {
    const file: SeedFile = DEFINITIONS[entity].seedFile;
    const schema = SEED_FILES[file] as unknown as { shape: Record<string, unknown> };
    const schemaKeys = Object.keys(schema.shape)
      .filter((k) => !SERVER_OWNED.has(k))
      .sort();
    const names = ENTITY_FIELDS[entity]!.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length); // no duplicates
    expect([...names].sort()).toEqual(schemaKeys);
  });
});

describe('datetime conversion', () => {
  it('round-trips ISO <-> the datetime-local text (UTC)', () => {
    expect(isoToLocalInput('2026-10-03T10:15:00.000Z')).toBe('2026-10-03T10:15');
    expect(localInputToIso('2026-10-03T10:15')).toBe('2026-10-03T10:15:00.000Z');
    expect(isoToLocalInput(null)).toBe('');
    expect(localInputToIso('')).toBeNull();
  });
});

describe('buildPayload', () => {
  const fields = ENTITY_FIELDS.pricing!;
  const base = (): FormValues => ({
    ...initialValues(fields, null),
    model: 'acme-one',
    price: '1.50',
    effectiveFrom: '2026-01-01',
  });

  it('turns empty nullable text into null and parses numbers strictly', () => {
    const r = buildPayload(fields, { ...base(), price: '', effectiveTo: '', sourceUrl: '' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.price).toBeNull(); // not publicly disclosed, never 0
      expect(r.record.effectiveTo).toBeNull();
      expect(r.record.sourceUrl).toBeNull();
      expect(r.record.currency).toBe('USD');
    }
  });

  it('refuses a mistyped number instead of saving 0 or NaN', () => {
    const r = buildPayload(fields, { ...base(), price: '1,5' });
    expect(r).toEqual({ ok: false, errors: { price: 'Price must be a number.' } });
  });

  it('flags missing required fields', () => {
    const r = buildPayload(fields, { ...base(), unit: '   ', effectiveFrom: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['effectiveFrom', 'unit']);
  });

  it('requires whole numbers for integer fields', () => {
    const models = ENTITY_FIELDS.models!;
    const r = buildPayload(models, { ...initialValues(models, null), contextWindow: '1.5' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.contextWindow).toMatch(/whole number/);
  });

  it('trims lines and drops blank entries; drops empty capability rows', () => {
    const models = ENTITY_FIELDS.models!;
    const r = buildPayload(models, {
      ...initialValues(models, null),
      slug: 'a',
      provider: 'acme',
      name: 'A',
      family: 'A',
      description: 'd',
      releaseDate: '2026-01-01',
      useCases: ['  one ', '', '  '],
      capabilities: [
        { name: 'reasoning', availability: 'LIMITED', documentationUrl: ' ' },
        { name: '', availability: 'AVAILABLE', documentationUrl: '' },
      ],
    });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.record.useCases).toEqual(['one']);
    expect(r.record.capabilities).toEqual([
      { name: 'reasoning', availability: 'LIMITED', documentationUrl: null },
    ]);
  });
});

describe('initialValues <-> buildPayload', () => {
  const model = {
    slug: 'acme-one',
    provider: 'acme',
    name: 'Acme One',
    family: 'Acme',
    version: null,
    description: 'A model.',
    categories: ['llm'],
    releaseDate: '2026-01-02',
    contextWindow: 200000,
    maxOutputTokens: null,
    openWeights: true,
    availability: 'CLOUD_API',
    deployment: ['cloud-api'],
    pricingKind: 'paid',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    officialDocumentation: 'https://example.test/docs',
    knowledgeCutoff: null,
    architecture: null,
    trainingInfo: null,
    apiAvailability: null,
    purpose: null,
    useCases: ['chat'],
    notableFeatures: [],
    limitations: ['slow'],
    capabilities: [{ name: 'reasoning', availability: 'AVAILABLE', documentationUrl: null }],
    sourceUrl: 'https://example.test/docs',
    verificationStatus: 'OFFICIALLY_VERIFIED',
    verifiedAt: '2026-10-03T10:00:00.000Z',
    dataType: null,
    structuredOutput: true,
    streaming: null,
    toolCalling: false,
    functionCalling: null,
  };

  it('editing a record without touching it changes nothing', () => {
    const fields = ENTITY_FIELDS.models!;
    const r = buildPayload(fields, initialValues(fields, model));
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.record).toEqual({ ...model, verifiedAt: '2026-10-03T10:00:00.000Z' });
  });

  it('a payload from the defaults plus the required text passes the seed schema', () => {
    const fields = ENTITY_FIELDS.providers!;
    const r = buildPayload(fields, {
      ...initialValues(fields, null),
      slug: 'acme',
      name: 'Acme',
      description: 'Text.',
    });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const v = validateBundle(
      { providers: [{ ...r.record, collectedAt: '2026-10-03T10:00:00.000Z' }] },
      { allowDemo: false },
    );
    expect(v.ok).toBe(true); // UNVERIFIED needs no source: the safe default
  });
});

describe('fieldOfPath', () => {
  it('maps nested server issue paths to the owning field', () => {
    expect(fieldOfPath('capabilities.0.name')).toBe('capabilities');
    expect(fieldOfPath('sourceUrl')).toBe('sourceUrl');
    expect(fieldOfPath('')).toBe('');
  });
});
