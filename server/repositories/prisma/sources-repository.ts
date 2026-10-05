import { VERIFICATION_STATUSES, type VerificationStatus } from '../../../src/lib/verification';
import type { Db } from '../../db/client';
import type { SourceHost, SourcesRepository, SourcesSummary } from '../catalog';

type Row = { host: string; status: VerificationStatus; n: number };

/**
 * Aggregates provenance across every factual table (the "sourced-record mixin", docs/PROMPT.md
 * section 9) in one statement: records per source host and per verification status. Demo
 * fixtures are excluded, so the public page never counts placeholder rows as sources.
 */
export function createPrismaSourcesRepository(db: Db): SourcesRepository {
  return {
    async summary(): Promise<SourcesSummary> {
      const rows = await db.$queryRaw<Row[]>`
        WITH s AS (
          SELECT "sourceUrl", "verificationStatus"::text AS status FROM "Provider" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "Model" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "ModelCapability" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "Pricing" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "Benchmark" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "BenchmarkResult" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "Release" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "NewsArticle" WHERE NOT "isDemo"
          UNION ALL SELECT "sourceUrl", "verificationStatus"::text FROM "Publication" WHERE NOT "isDemo"
        )
        SELECT COALESCE(lower(split_part(regexp_replace("sourceUrl", '^https?://(www\.)?', ''), '/', 1)), '') AS host,
               status, count(*)::int AS n
        FROM s GROUP BY 1, 2`;

      const byStatus = Object.fromEntries(VERIFICATION_STATUSES.map((s) => [s, 0])) as Record<
        VerificationStatus,
        number
      >;
      const hosts = new Map<string, SourceHost>();
      let withoutSource = 0;
      let totalRecords = 0;
      for (const { host, status, n } of rows) {
        totalRecords += n;
        byStatus[status] += n;
        if (!host) {
          withoutSource += n;
          continue;
        }
        const h = hosts.get(host) ?? { host, records: 0, byStatus: {} };
        h.records += n;
        h.byStatus[status] = (h.byStatus[status] ?? 0) + n;
        hosts.set(host, h);
      }
      return {
        totalRecords,
        withoutSource,
        byStatus,
        hosts: [...hosts.values()].sort(
          (a, b) => b.records - a.records || a.host.localeCompare(b.host),
        ),
      };
    },
  };
}
