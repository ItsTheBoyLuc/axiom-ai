import { describe, expect, it } from 'vitest';
import { buildDemoRaw } from '../../prisma/seed/demo/bundle';
import { formatErrors, validateBundle, type SeedError } from '../../prisma/seed/schemas';

const NOW = '2026-09-29T00:00:00Z';

const sourcing = (over: Record<string, unknown> = {}) => ({
  sourceUrl: null,
  verificationStatus: 'UNVERIFIED',
  verifiedAt: null,
  collectedAt: NOW,
  isDemo: false,
  ...over,
});

const provider = (over: Record<string, unknown> = {}) => ({
  slug: 'acme',
  name: 'Acme',
  description: 'A provider',
  ...sourcing(),
  ...over,
});

const model = (over: Record<string, unknown> = {}) => ({
  slug: 'acme-1',
  provider: 'acme',
  name: 'Acme 1',
  family: 'Acme',
  description: 'A model',
  categories: ['llm'],
  releaseDate: '2026-01-01',
  openWeights: false,
  availability: 'CLOUD_API',
  ...sourcing(),
  ...over,
});

const check = (raw: Parameters<typeof validateBundle>[0], allowDemo = false) =>
  validateBundle(raw, { allowDemo });
const errorsOf = (raw: Parameters<typeof validateBundle>[0], allowDemo = false): SeedError[] => {
  const r = check(raw, allowDemo);
  return r.ok ? [] : r.errors;
};

describe('the section 2 source rules', () => {
  it('accepts an unsourced record only when it is UNVERIFIED or NOT_PUBLICLY_DISCLOSED', () => {
    expect(check({ providers: [provider({ verificationStatus: 'UNVERIFIED' })] }).ok).toBe(true);
    expect(
      check({ providers: [provider({ verificationStatus: 'NOT_PUBLICLY_DISCLOSED' })] }).ok,
    ).toBe(true);
  });

  it.each([
    'OFFICIALLY_VERIFIED',
    'INDEPENDENTLY_EVALUATED',
    'PROVIDER_REPORTED',
    'COMMUNITY_REPORTED',
  ])('REJECTS %s without a sourceUrl', (status) => {
    const errs = errorsOf({
      providers: [provider({ verificationStatus: status, verifiedAt: NOW })],
    });
    expect(
      errs.some((e) => e.path === 'sourceUrl' && /sourceUrl is required/.test(e.message)),
    ).toBe(true);
  });

  it('accepts sourced records of every status', () => {
    for (const status of ['PROVIDER_REPORTED', 'COMMUNITY_REPORTED']) {
      expect(
        check({
          providers: [
            provider({ verificationStatus: status, sourceUrl: 'https://acme.test/docs' }),
          ],
        }).ok,
      ).toBe(true);
    }
    expect(
      check({
        providers: [
          provider({
            verificationStatus: 'OFFICIALLY_VERIFIED',
            sourceUrl: 'https://acme.test/docs',
            verifiedAt: NOW,
          }),
        ],
      }).ok,
    ).toBe(true);
  });

  it('requires verifiedAt for the two highest-trust statuses', () => {
    const errs = errorsOf({
      providers: [
        provider({ verificationStatus: 'INDEPENDENTLY_EVALUATED', sourceUrl: 'https://acme.test' }),
      ],
    });
    expect(errs.some((e) => e.path === 'verifiedAt')).toBe(true);
  });

  it('requires collectedAt on every record', () => {
    const { collectedAt: _omit, ...rest } = provider();
    void _omit;
    expect(errorsOf({ providers: [rest] }).some((e) => e.path === 'collectedAt')).toBe(true);
  });

  it('only accepts http(s) source URLs (no javascript: or file: links)', () => {
    for (const bad of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'ftp://x.test/a',
      'not a url',
    ]) {
      expect(check({ providers: [provider({ sourceUrl: bad })] }).ok, bad).toBe(false);
    }
  });

  it('never lets demo data be marked verified', () => {
    const errs = errorsOf(
      {
        providers: [
          provider({
            isDemo: true,
            verificationStatus: 'OFFICIALLY_VERIFIED',
            sourceUrl: 'https://a.test',
            verifiedAt: NOW,
          }),
        ],
      },
      true,
    );
    expect(errs.some((e) => e.path === 'isDemo')).toBe(true);
  });

  it('applies the same rules to models, prices, results, releases, news and publications', () => {
    const verifiedNoSource = { verificationStatus: 'OFFICIALLY_VERIFIED', verifiedAt: NOW };
    const raw = {
      providers: [provider()],
      benchmarks: [
        {
          slug: 'b1',
          name: 'B',
          category: 'reasoning',
          description: 'd',
          ...sourcing(verifiedNoSource),
        },
      ],
      models: [model(verifiedNoSource)],
      pricing: [
        {
          model: 'acme-1',
          pricingType: 'INPUT',
          price: 1,
          currency: 'USD',
          unit: 'per 1M tokens',
          effectiveFrom: '2026-01-01',
          isCurrent: true,
          ...sourcing(verifiedNoSource),
        },
      ],
      'benchmark-results': [
        {
          model: 'acme-1',
          benchmark: 'b1',
          score: 1,
          scoreUnit: '%',
          evaluationDate: '2026-01-01',
          modelVersion: '1',
          evaluationType: 'INDEPENDENT',
          ...sourcing(verifiedNoSource),
        },
      ],
      releases: [
        {
          provider: 'acme',
          kind: 'MAJOR',
          releaseDate: '2026-01-01',
          title: 't',
          description: 'd',
          ...sourcing(verifiedNoSource),
        },
      ],
      news: [
        {
          title: 't',
          summary: 's',
          publisher: 'p',
          articleUrl: 'https://a.test/1',
          publicationDate: '2026-01-01',
          category: 'RESEARCH',
          ...sourcing(verifiedNoSource),
        },
      ],
      publications: [
        {
          provider: 'acme',
          title: 't',
          url: 'https://a.test/p',
          publishedAt: '2026-01-01',
          ...sourcing(verifiedNoSource),
        },
      ],
    };
    const errs = errorsOf(raw);
    const files = new Set(errs.filter((e) => e.path === 'sourceUrl').map((e) => e.file));
    expect([...files].sort()).toEqual([
      'benchmark-results',
      'benchmarks',
      'models',
      'news',
      'pricing',
      'publications',
      'releases',
    ]);
  });
});

describe('demo records in real data', () => {
  it('are rejected unless demo is explicitly allowed', () => {
    const errs = errorsOf({ providers: [provider({ isDemo: true })] });
    expect(errs).toHaveLength(1);
    expect(errs[0]!.message).toMatch(/SEED_DEMO=true/);
    expect(check({ providers: [provider({ isDemo: true })] }, true).ok).toBe(true);
  });
});

describe('values and structure', () => {
  it('rejects negative prices, bad currencies and impossible date ranges', () => {
    const base = {
      model: 'acme-1',
      pricingType: 'INPUT',
      price: 1,
      currency: 'USD',
      unit: 'per 1M tokens',
      effectiveFrom: '2026-03-01',
      isCurrent: false,
      effectiveTo: '2026-04-01',
      ...sourcing(),
    };
    const ctx = { providers: [provider()], models: [model()] };
    expect(check({ ...ctx, pricing: [base] }).ok).toBe(true);
    expect(errorsOf({ ...ctx, pricing: [{ ...base, price: -1 }] }).length).toBeGreaterThan(0);
    expect(errorsOf({ ...ctx, pricing: [{ ...base, currency: 'usd' }] }).length).toBeGreaterThan(0);
    expect(
      errorsOf({ ...ctx, pricing: [{ ...base, effectiveTo: '2026-02-01' }] }).some((e) =>
        /before effectiveFrom/.test(e.message),
      ),
    ).toBe(true);
    expect(
      errorsOf({ ...ctx, pricing: [{ ...base, isCurrent: true }] }).some((e) =>
        /cannot have ended/.test(e.message),
      ),
    ).toBe(true);
  });

  it('allows a null price (not publicly disclosed) but not a made-up zero default', () => {
    const ctx = { providers: [provider()], models: [model()] };
    const p = {
      model: 'acme-1',
      pricingType: 'OUTPUT',
      price: null,
      currency: 'USD',
      unit: 'per 1M tokens',
      effectiveFrom: '2026-01-01',
      isCurrent: true,
      ...sourcing(),
    };
    expect(check({ ...ctx, pricing: [p] }).ok).toBe(true);
    const { price: _omit, ...withoutPrice } = p;
    void _omit;
    expect(check({ ...ctx, pricing: [withoutPrice] }).ok).toBe(false); // must be explicit
  });

  it('detects duplicate keys and dangling references', () => {
    const errs = errorsOf({
      providers: [provider(), provider()],
      models: [model({ provider: 'nobody' })],
      pricing: [
        {
          model: 'ghost',
          pricingType: 'INPUT',
          price: 1,
          currency: 'USD',
          unit: 'u',
          effectiveFrom: '2026-01-01',
          isCurrent: true,
          ...sourcing(),
        },
      ],
    });
    const messages = errs.map((e) => e.message).join('\n');
    expect(messages).toMatch(/duplicate key "acme"/);
    expect(messages).toMatch(/unknown provider "nobody"/);
    expect(messages).toMatch(/unknown model "ghost"/);
  });

  it('collects every problem across files instead of stopping at the first', () => {
    const errs = errorsOf({
      providers: [provider({ slug: 'Bad Slug' })],
      models: [model({ categories: [] })],
      releases: 'not-an-array',
    });
    expect(new Set(errs.map((e) => e.file))).toEqual(new Set(['providers', 'models', 'releases']));
    expect(formatErrors(errs)).toMatch(/providers\.json\[0\] \.slug/);
  });

  it('rejects unknown enum values (categories, capabilities, availability)', () => {
    expect(
      errorsOf({ providers: [provider()], models: [model({ categories: ['telepathy'] })] }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsOf({ providers: [provider()], models: [model({ availability: 'MAGIC' })] }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsOf({
        providers: [provider()],
        models: [model({ capabilities: [{ name: 'mind-reading' }] })],
      }).length,
    ).toBeGreaterThan(0);
  });

  it('treats missing files as empty and applies defaults (unverified, not demo)', () => {
    const r = check({ providers: [{ slug: 'x', name: 'X', description: 'd', collectedAt: NOW }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bundle.providers[0]).toMatchObject({
        verificationStatus: 'UNVERIFIED',
        isDemo: false,
        sourceUrl: null,
      });
      expect(r.bundle.models).toEqual([]);
    }
  });
});

describe('the demo fixtures', () => {
  it('pass the same validation as real data (with demo allowed)', () => {
    const r = check(buildDemoRaw(), true);
    if (!r.ok) throw new Error(formatErrors(r.errors));
    expect(r.bundle.models).toHaveLength(16);
    expect(r.bundle.providers).toHaveLength(7);
    expect(r.bundle.models.every((m) => m.isDemo && m.verificationStatus === 'UNVERIFIED')).toBe(
      true,
    );
  });

  it('are rejected when demo is NOT allowed, so they can never sneak into real seeding', () => {
    const r = check(buildDemoRaw(), false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => e.path === 'isDemo')).toBe(true);
  });
});
