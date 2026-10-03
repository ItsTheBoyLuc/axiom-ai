'use client';

import { useId, useState } from 'react';
import { Calculator } from 'lucide-react';
import { TOKEN_UNIT, estimateCost, formatMoney } from '@/lib/pricing';
import { NOT_DISCLOSED } from '@/lib/verification';
import type { PricingEntry } from '@/types/model';

const inputCls =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 font-mono text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/** Parses a token field. Blank counts as 0; anything else must be a plain number. */
const toNumber = (v: string) => (v.trim() === '' ? 0 : Number(v.replaceAll(',', '')));

/**
 * Token cost estimator: input / output / cached-input tokens in, cost out, computed with the
 * model's CURRENT per-token prices (see lib/pricing.ts). Prices that are not disclosed are
 * called out; they are never treated as free.
 */
export function CostEstimator({
  entries,
  modelName,
}: {
  entries: PricingEntry[];
  modelName: string;
}) {
  const id = useId();
  const [input, setInput] = useState('1000000');
  const [output, setOutput] = useState('250000');
  const [cached, setCached] = useState('0');

  const result = estimateCost(entries, {
    inputTokens: toNumber(input),
    outputTokens: toNumber(output),
    cachedInputTokens: toNumber(cached),
  });

  const fields = [
    {
      key: 'in',
      label: 'Input tokens',
      help: 'Uncached prompt tokens',
      value: input,
      set: setInput,
    },
    { key: 'out', label: 'Output tokens', help: 'Generated tokens', value: output, set: setOutput },
    {
      key: 'cache',
      label: 'Cached input tokens',
      help: 'Prompt tokens served from cache',
      value: cached,
      set: setCached,
    },
  ];

  return (
    <div className="border-line bg-card rounded-2xl border p-5 sm:p-6">
      <h3 className="t-h3 flex items-center gap-2">
        <Calculator size={18} aria-hidden className="text-accent" />
        Token cost estimator
      </h3>
      <p className="text-fg-2 mt-1 text-sm">
        Estimate what a workload on {modelName} would cost at its current listed prices.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`${id}-${f.key}`} className="text-fg text-sm font-medium">
              {f.label}
            </label>
            <input
              id={`${id}-${f.key}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              aria-describedby={`${id}-${f.key}-help`}
              aria-invalid={!result.ok}
              className={`${inputCls} mt-1.5`}
            />
            <p id={`${id}-${f.key}-help`} className="text-muted mt-1 text-xs">
              {f.help}
            </p>
          </div>
        ))}
      </div>

      <div role="status" aria-live="polite" className="mt-6">
        {!result.ok ? (
          <p className="text-danger text-sm">
            {result.error === 'INVALID_TOKENS'
              ? 'Enter whole, non-negative token counts (up to 1 trillion).'
              : 'This model lists prices in more than one currency, so a single total cannot be shown.'}
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <caption className="sr-only">Cost breakdown</caption>
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th scope="col" className="py-2 font-medium">
                    Line
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Tokens
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Price / 1M
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((l) => (
                  <tr key={l.type} className="border-line/60 border-b">
                    <th scope="row" className="text-fg py-2 text-left font-normal">
                      {l.label}
                    </th>
                    <td className="text-fg-2 py-2 text-right font-mono">
                      {l.tokens.toLocaleString('en-US')}
                    </td>
                    <td className="text-fg-2 py-2 text-right font-mono">
                      {l.pricePerMillion === null ? (
                        <span className="font-sans text-xs">{NOT_DISCLOSED}</span>
                      ) : (
                        formatMoney(l.pricePerMillion, result.currency)
                      )}
                    </td>
                    <td className="text-fg py-2 text-right font-mono">
                      {l.cost === null ? (
                        <span className="text-fg-2 font-sans text-xs">Cannot estimate</span>
                      ) : (
                        formatMoney(l.cost, result.currency)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-fg-2 text-sm">Estimated total</span>
              <span className="text-fg font-mono text-2xl" data-testid="estimate-total">
                {formatMoney(result.total, result.currency)}
              </span>
            </p>
            {result.partial && (
              <p className="border-warn/40 bg-warn/5 text-fg-2 mt-3 rounded-lg border px-3 py-2 text-xs">
                Some prices are {NOT_DISCLOSED.toLowerCase()}, so those lines are left out. The
                total is a lower bound, not a full estimate.
              </p>
            )}
          </>
        )}
      </div>
      <p className="text-muted mt-4 text-xs">
        Uses current listed prices only
        {result.ok && result.unit && result.unit !== TOKEN_UNIT
          ? ` (${result.unit
              .slice(TOKEN_UNIT.length)
              .trim()
              .replace(/^\(|\)$/g, '')})`
          : ''}
        . Real bills can differ (tiers, minimums, rounding, taxes).
      </p>
    </div>
  );
}
