import { EvaluationBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import { buildCapabilityMatrix } from '@/lib/models/capability-matrix';
import type { ModelDetail } from '@/types/model';
import { ProfileSection } from './profile-section';

/**
 * Capabilities matrix: each cell shows verified benchmark evidence for that capability or
 * "No verified data". Nothing is inferred, averaged or scored on the platform's own.
 */
export function CapabilitiesMatrix({ model }: { model: ModelDetail }) {
  const rows = buildCapabilityMatrix(model.benchmarks);
  return (
    <ProfileSection
      id="capabilities"
      title="Capabilities matrix"
      demo={model.isDemo}
      lead="Each row lists published benchmark results for that capability. There is no combined score, and different benchmarks are never merged."
    >
      <div
        tabIndex={0}
        role="region"
        aria-label="Capabilities matrix"
        className="border-line bg-card overflow-x-auto rounded-2xl border"
      >
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Benchmark evidence per capability for {model.name}</caption>
          <thead>
            <tr className="border-line border-b">
              <th
                scope="col"
                className="text-muted px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              >
                Capability
              </th>
              <th
                scope="col"
                className="text-muted px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              >
                Verified benchmark evidence
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-line/60 border-b align-top last:border-0">
                <th scope="row" className="text-fg w-48 px-4 py-3 text-left font-normal">
                  {r.label}
                </th>
                <td className="px-4 py-3">
                  {r.evidence.length === 0 ? (
                    <span className="text-fg-2">No verified data</span>
                  ) : (
                    <ul className="space-y-2">
                      {r.evidence.map((e, i) => (
                        <li
                          key={`${e.benchmarkSlug}-${e.evaluationDate}-${i}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1"
                        >
                          <span className="text-fg">
                            {e.benchmarkName}
                            {e.benchmarkVersion && (
                              <span className="text-muted"> ({e.benchmarkVersion})</span>
                            )}
                          </span>
                          <span className="text-fg font-mono">
                            {e.score}
                            {e.scoreUnit}
                          </span>
                          <EvaluationBadge type={e.evaluationType} />
                          <span className="text-muted font-mono text-xs">
                            {formatDate(e.evaluationDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProfileSection>
  );
}
