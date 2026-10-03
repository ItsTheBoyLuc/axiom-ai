import { describe, expect, it } from 'vitest';
import { demoNews, demoProviders, demoReleases } from '../../prisma/seed/demo/fixtures';
import { formatTokens } from '@/lib/format';
import { buildGraph } from '@/components/hero/graph';
import { demoBenchmarks, demoModelDetails } from '../../prisma/seed/demo/models';
import { trustRank } from '@/lib/verification';

describe('demo data safety (docs/PROMPT.md section 2)', () => {
  it('flags every placeholder record as demo', () => {
    const all = [...demoProviders, ...demoModelDetails, ...demoReleases, ...demoNews];
    expect(all.every((r) => r.isDemo === true)).toBe(true);
    for (const m of demoModelDetails) {
      expect(m.benchmarks.every((b) => b.isDemo)).toBe(true);
      expect(m.pricing.every((p) => p.isDemo)).toBe(true);
    }
  });

  it('never marks demo models as verified and never invents sources', () => {
    for (const m of demoModelDetails) {
      expect(trustRank[m.verificationStatus]).toBeLessThanOrEqual(trustRank.UNVERIFIED);
      expect(m.sourceUrl).toBeNull();
      expect(m.verifiedAt).toBeNull();
    }
  });

  it('uses fictional names only', () => {
    for (const m of demoModelDetails) expect(m.name).toMatch(/^Sample Model \d+$/);
    for (const p of demoProviders) expect(p.name).toMatch(/^Demo Provider [A-Z]$/);
  });

  it('has unique slugs and valid provider references', () => {
    const slugs = demoModelDetails.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const providers = new Set(demoProviders.map((p) => p.slug));
    for (const m of demoModelDetails) expect(providers.has(m.providerSlug)).toBe(true);
    for (const n of demoNews) expect(providers.has(n.providerSlug)).toBe(true);
  });

  it('only references benchmarks that exist and keeps categories consistent', () => {
    const bySlug = new Map(demoBenchmarks.map((b) => [b.slug, b]));
    for (const m of demoModelDetails) {
      for (const r of m.benchmarks) {
        expect(bySlug.get(r.benchmarkSlug)?.category).toBe(r.category);
      }
    }
  });

  it('exercises the "not publicly disclosed" paths', () => {
    expect(demoModelDetails.some((m) => m.contextWindow === null)).toBe(true);
    expect(demoModelDetails.some((m) => m.specs.maxOutputTokens === null)).toBe(true);
    expect(demoModelDetails.some((m) => m.currentPricing === null)).toBe(true);
    expect(demoModelDetails.some((m) => m.benchmarks.length === 0)).toBe(true);
  });

  it('keeps historical prices marked as not current', () => {
    const withHistory = demoModelDetails.filter((m) => m.pricing.some((p) => !p.isCurrent));
    expect(withHistory.length).toBeGreaterThan(0);
    for (const m of withHistory) {
      for (const p of m.pricing.filter((x) => !x.isCurrent)) expect(p.effectiveTo).not.toBeNull();
    }
  });
});

describe('formatTokens', () => {
  it('formats magnitudes', () => {
    expect(formatTokens(128000)).toBe('128K');
    expect(formatTokens(1000000)).toBe('1M');
    expect(formatTokens(1500000)).toBe('1.5M');
    expect(formatTokens(512)).toBe('512');
    expect(formatTokens(null)).toBe('Not publicly disclosed');
  });
});

describe('hero graph', () => {
  const seed = {
    providers: demoProviders.map((p) => ({ slug: p.slug, name: p.name })),
    models: demoModelDetails
      .slice(0, 8)
      .map((m) => ({ slug: m.slug, name: m.name, providerSlug: m.providerSlug })),
  };

  it('is deterministic and internally consistent', () => {
    const a = buildGraph(seed);
    const b = buildGraph(seed);
    expect(a).toEqual(b);
    for (const e of a.edges) {
      expect(a.nodes[e.a]).toBeDefined();
      expect(a.nodes[e.b]).toBeDefined();
    }
    for (const n of a.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(1);
    }
    expect(a.nodes).toHaveLength(seed.providers.length + seed.models.length);
  });
});
