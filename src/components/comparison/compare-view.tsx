'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Download, Link2, Plus, X } from 'lucide-react';
import { DemoBadge } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { buildCompareTable } from '@/lib/compare/table';
import { MAX_COMPARE, compareHrefForSlugs, type ModelRef } from '@/lib/comparison';
import type { ModelDetail } from '@/types/model';
import { CompareCharts } from './compare-charts';
import { CompareTable } from './compare-table';
import { useComparison } from './comparison-store';
import { useCompareHistory } from './history-store';
import { ModelPicker, type ProviderOption } from './model-picker';

const toRef = (m: ModelDetail): ModelRef => ({
  slug: m.slug,
  name: m.name,
  providerName: m.providerName,
});

/**
 * The /compare page body. The URL (`?models=a,b,c`) is the single source of truth: adding or
 * removing a model replaces the URL and the server re-renders with the new set, so every state
 * is shareable and the back button behaves. The tray selection and the comparison history
 * follow the URL.
 */
export function CompareView({
  models,
  unknown,
  ignored,
  providers,
}: {
  models: ModelDetail[];
  /** Requested slugs that do not exist. */
  unknown: string[];
  /** Malformed or surplus slugs that were dropped from the URL. */
  ignored: string[];
  providers: ProviderOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [highlight, setHighlight] = useState(false);
  const [sharedOnly, setSharedOnly] = useState(false);
  // Open while there is little to compare; collapsed once there is a table to read.
  const [pickerOpen, setPickerOpen] = useState(models.length < 2);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const tray = useComparison();
  const history = useCompareHistory();
  const { list: traySelection } = tray;
  const slugs = useMemo(() => models.map((m) => m.slug), [models]);
  const groups = useMemo(() => buildCompareTable(models), [models]);
  const demo = models.some((m) => m.isDemo);

  // The tray (shown on other pages) mirrors what is compared here.
  const { replace: replaceTray } = tray;
  useEffect(() => replaceTray(models.map(toRef)), [models, replaceTray]);

  // Remember sets of two or more for "Recent comparisons".
  const { record } = history;
  useEffect(() => {
    if (models.length >= 2) {
      record({
        slugs: models.map((m) => m.slug),
        names: models.map((m) => m.name),
        at: Date.now(),
      });
    }
  }, [models, record]);

  const go = (next: string[]) =>
    startTransition(() => router.replace(compareHrefForSlugs(next), { scroll: false }));

  const add = (ref: ModelRef) => {
    if (slugs.includes(ref.slug) || slugs.length >= MAX_COMPARE) return;
    go([...slugs, ref.slug]);
  };
  const remove = (slug: string) => go(slugs.filter((s) => s !== slug));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${compareHrefForSlugs(slugs)}`);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied('idle'), 2500);
  };

  const csvHref = `/api/v1/compare/export.csv?models=${slugs.map(encodeURIComponent).join(',')}`;

  return (
    <div aria-busy={pending}>
      <header className="mb-8 max-w-3xl">
        <p className="t-eyebrow mb-3 flex items-center gap-3">Compare {demo && <DemoBadge />}</p>
        <h1 className="t-h2">Compare models</h1>
        <p className="t-lead mt-3">
          Up to {MAX_COMPARE} models side by side. Benchmarks stay separate, with their own
          evaluation type, date and source: there is no combined score.
        </p>
      </header>

      {unknown.length > 0 && (
        <p
          role="alert"
          className="border-warn/40 bg-warn/5 text-fg-2 mb-6 rounded-xl border px-4 py-3 text-sm"
        >
          <strong className="text-fg">Not found:</strong> {unknown.join(', ')}. These are not in the
          catalogue, so they are left out.{' '}
          <button type="button" className="text-accent underline" onClick={() => go(slugs)}>
            Remove from the link
          </button>
        </p>
      )}
      {ignored.length > 0 && (
        <p className="border-line text-fg-2 mb-6 rounded-xl border px-4 py-3 text-sm" role="status">
          Ignored in the link (invalid or more than {MAX_COMPARE} models): {ignored.join(', ')}.
        </p>
      )}

      <section aria-label="Selected models" className="mb-6">
        {models.length === 0 ? (
          <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-8 text-center text-sm">
            No models selected yet. Add at least two below to compare them.
            {traySelection.length > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  className="text-accent underline"
                  onClick={() => go(traySelection.map((m) => m.slug))}
                >
                  Use the {traySelection.length} from your comparison tray
                </button>
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <ul className="flex flex-wrap gap-2">
              {models.map((m) => (
                <li
                  key={m.slug}
                  className="border-line-strong bg-card text-fg flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm"
                >
                  <span>{m.name}</span>
                  <button
                    type="button"
                    onClick={() => remove(m.slug)}
                    aria-label={`Remove ${m.name} from the comparison`}
                    className="text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-6 items-center justify-center rounded-full"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {(
                [
                  ['Highlight differences', highlight, setHighlight],
                  ['Shared benchmarks only', sharedOnly, setSharedOnly],
                ] as const
              ).map(([label, on, set]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(!on)}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium ${
                    on
                      ? 'border-accent bg-accent/10 text-fg'
                      : 'border-line-strong bg-elevated text-fg hover:border-fg-2/50'
                  }`}
                >
                  {on && <Check size={15} aria-hidden />}
                  {label}
                </button>
              ))}
              <Button variant="secondary" onClick={copyLink}>
                <Link2 size={15} aria-hidden />
                {copied === 'ok'
                  ? 'Link copied'
                  : copied === 'failed'
                    ? 'Copy failed'
                    : 'Copy link'}
              </Button>
              <a
                href={csvHref}
                download
                className="border-line-strong bg-elevated text-fg hover:border-fg-2/50 inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium"
              >
                <Download size={15} aria-hidden />
                Export CSV
              </a>
            </div>
          </div>
        )}
        <p className="sr-only" role="status">
          {copied === 'ok' ? 'Comparison link copied to the clipboard.' : ''}
          {copied === 'failed' ? 'Could not copy the link. Copy it from the address bar.' : ''}
        </p>
      </section>

      <button
        type="button"
        aria-expanded={pickerOpen}
        aria-controls="compare-picker"
        onClick={() => setPickerOpen((v) => !v)}
        className="border-line-strong bg-elevated text-fg hover:border-fg-2/50 mb-3 inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
      >
        <Plus size={15} aria-hidden />
        {pickerOpen ? 'Hide model picker' : slugs.length ? 'Add or change models' : 'Add models'}
        <ChevronDown
          size={15}
          aria-hidden
          className={pickerOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>
      <div id="compare-picker" hidden={!pickerOpen}>
        <ModelPicker selected={slugs} providers={providers} onAdd={add} />
      </div>

      {models.length === 1 && (
        <p className="text-fg-2 mt-6 text-sm">
          Add a second model to compare. The table below shows the one you selected.
        </p>
      )}

      {models.length > 0 && (
        <div className="mt-8">
          <CompareTable
            groups={groups}
            models={models}
            highlight={highlight}
            sharedOnly={sharedOnly}
          />
          {models.length >= 2 && <CompareCharts models={models} />}
        </div>
      )}
    </div>
  );
}
