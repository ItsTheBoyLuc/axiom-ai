import { describe, expect, it } from 'vitest';
import { demoModels, demoNews, demoProviders, demoReleases } from '@/lib/demo-data';
import { formatTokens } from '@/lib/format';
import { buildGraph } from '@/components/hero/graph';
import { getStats } from '../../server/services/stats';

describe('demo data safety', () => {
  it('flags every placeholder record as demo', () => {
    const all = [...demoProviders, ...demoModels, ...demoReleases, ...demoNews];
    expect(all.every((r) => r.isDemo === true)).toBe(true);
  });

  it('never marks demo models as verified', () => {
    expect(demoModels.every((m) => m.verificationStatus === 'UNVERIFIED')).toBe(true);
  });

  it('references only existing providers', () => {
    const slugs = new Set(demoProviders.map((p) => p.slug));
    for (const m of demoModels) expect(slugs.has(m.providerSlug)).toBe(true);
    for (const n of demoNews) expect(slugs.has(n.providerSlug)).toBe(true);
  });

  it('stats are flagged as demo while data is placeholder', () => {
    expect(getStats().isDemo).toBe(true);
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
  it('is deterministic and internally consistent', () => {
    const a = buildGraph();
    const b = buildGraph();
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
  });
});
