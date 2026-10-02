import { describe, expect, it } from 'vitest';
import { DEFAULT_DATA_DIR, readSeedDir } from '../../prisma/seed/seed';
import { formatErrors, validateBundle } from '../../prisma/seed/schemas';

/**
 * Guards the REAL catalogue in prisma/seed/data/*.json (docs/PROMPT.md section 2). The same
 * schema and cross-reference rules the seed runner enforces, plus editorial checks that catch the
 * mistakes a schema cannot: future dates, impossible scores, duplicate current prices.
 */
const { raw, errors: readErrors } = readSeedDir(DEFAULT_DATA_DIR);
const validated = validateBundle(raw, { allowDemo: false });
const today = new Date().toISOString().slice(0, 10);
const nowMs = Date.now() + 60_000; // tolerate clock skew between author and CI

describe('real seed data', () => {
  it('reads and validates against the seed schemas', () => {
    expect(readErrors).toEqual([]);
    if (!validated.ok) throw new Error(`invalid seed data:\n${formatErrors(validated.errors)}`);
    expect(validated.ok).toBe(true);
  });

  const bundle = validated.ok ? validated.bundle : null;

  it('contains no demo records', () => {
    const all = bundle ? Object.values(bundle).flat() : [];
    expect(all.filter((r) => (r as { isDemo: boolean }).isDemo)).toEqual([]);
  });

  it('has no timestamps in the future', () => {
    const rows = bundle ? Object.values(bundle).flat() : [];
    for (const r of rows as { collectedAt: string; verifiedAt: string | null }[]) {
      expect(Date.parse(r.collectedAt)).toBeLessThanOrEqual(nowMs);
      if (r.verifiedAt) expect(Date.parse(r.verifiedAt)).toBeLessThanOrEqual(nowMs);
    }
  });

  it('has no release, evaluation or price-start dates in the future', () => {
    if (!bundle) return;
    for (const m of bundle.models) expect(m.releaseDate <= today, m.slug).toBe(true);
    for (const r of bundle.releases) expect(r.releaseDate <= today, r.title).toBe(true);
    for (const r of bundle['benchmark-results'])
      expect(r.evaluationDate <= today, `${r.model}/${r.benchmark}`).toBe(true);
    for (const p of bundle.pricing)
      expect(p.effectiveFrom <= today, `${p.model} ${p.pricingType}`).toBe(true);
  });

  it('keeps percentage scores within 0-100 and uses known units', () => {
    if (!bundle) return;
    for (const r of bundle['benchmark-results']) {
      expect(['%', 'Elo', 'score']).toContain(r.scoreUnit);
      if (r.scoreUnit === '%') {
        expect(r.score, `${r.model}/${r.benchmark}`).toBeGreaterThanOrEqual(0);
        expect(r.score, `${r.model}/${r.benchmark}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('has at most one current price per model, type and unit', () => {
    if (!bundle) return;
    const seen = new Set<string>();
    for (const p of bundle.pricing.filter((x) => x.isCurrent)) {
      const key = [p.model, p.pricingType, p.unit].join('|');
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it('cites an official-looking https source for every record', () => {
    if (!bundle) return;
    const rows = Object.values(bundle).flat() as { sourceUrl: string | null }[];
    for (const r of rows) {
      expect(r.sourceUrl).not.toBeNull();
      const u = new URL(r.sourceUrl!);
      expect(u.protocol).toBe('https:');
      expect(u.hostname).not.toMatch(/localhost|example\./);
    }
  });

  it('never marks a benchmark result as officially verified (scores are reported, not audited)', () => {
    if (!bundle) return;
    for (const r of bundle['benchmark-results']) {
      expect(['PROVIDER_REPORTED', 'INDEPENDENTLY_EVALUATED', 'COMMUNITY_REPORTED']).toContain(
        r.verificationStatus,
      );
      // evaluationType and status must tell the same story
      if (r.evaluationType === 'PROVIDER_REPORTED')
        expect(r.verificationStatus).toBe('PROVIDER_REPORTED');
    }
  });
});
