import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { ProviderCard } from '@/components/providers/provider-card';
import { DemoBadge } from '@/components/ui/badges';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Pager } from '@/components/ui/pager';
import { Container } from '@/components/ui/section';
import {
  PROVIDERS_PAGE_SIZE,
  filterProviders,
  orgTypeFacets,
  orgTypeText,
  pageOf,
  parseProvidersQuery,
  providersHref,
} from '@/lib/providers/query';
import { getRepositories } from '../../../server/repositories';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DESCRIPTION =
  'The organisations behind AI models: what they build, how many models they publish and their latest announcement, each with its verification status.';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseProvidersQuery(await searchParams);
  return {
    title: 'AI model providers',
    description: DESCRIPTION,
    alternates: { canonical: '/providers' },
    robots: q.q || q.type || q.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function ProvidersPage({ searchParams }: Props) {
  const query = parseProvidersQuery(await searchParams);
  const all = await getRepositories().providers.listAll();
  const filtered = filterProviders(all, query);
  const page = pageOf(filtered, query.page, PROVIDERS_PAGE_SIZE);
  const facets = orgTypeFacets(all);
  const hasDemo = all.some((p) => p.isDemo);
  const chip = (on: boolean) =>
    `inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
      on
        ? 'border-accent bg-accent/10 text-fg'
        : 'border-line text-fg-2 hover:border-line-strong hover:text-fg'
    }`;

  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Providers', href: '/providers' },
        ]}
      />
      <header className="mb-8 max-w-3xl">
        <p className="t-eyebrow mb-3 flex items-center gap-3">
          Providers {hasDemo && <DemoBadge />}
        </p>
        <h1 className="t-h2">The organisations behind the models</h1>
        <p className="t-lead mt-3">
          Who builds what, how many models each publishes and their latest announcement. Every
          record carries its verification status; headquarters are shown only when verified.
        </p>
      </header>

      {/* A plain GET form: works without JavaScript and keeps the search in the URL. */}
      <form action="/providers" method="get" role="search" className="mb-6 flex flex-wrap gap-3">
        {query.type && <input type="hidden" name="type" value={query.type.toLowerCase()} />}
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="provider-q" className="sr-only">
            Search providers
          </label>
          <Search
            size={15}
            aria-hidden
            className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            id="provider-q"
            name="q"
            type="search"
            defaultValue={query.q}
            autoComplete="off"
            placeholder="Search providers"
            className="border-line-strong bg-elevated text-fg h-11 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-accent-fg inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium hover:brightness-110"
        >
          Search
        </button>
      </form>

      <nav aria-label="Organisation type" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={providersHref({ q: query.q })}
              aria-current={query.type === null ? 'true' : undefined}
              className={chip(query.type === null)}
            >
              All types <span className="text-muted font-mono text-xs">{all.length}</span>
            </Link>
          </li>
          {facets.map((f) => (
            <li key={f.type}>
              <Link
                href={providersHref({ q: query.q, type: f.type })}
                aria-current={query.type === f.type ? 'true' : undefined}
                className={chip(query.type === f.type)}
              >
                {orgTypeText(f.type)}{' '}
                <span className="text-muted font-mono text-xs">{f.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-muted mb-5 text-sm" role="status">
        {filtered.length} {filtered.length === 1 ? 'provider' : 'providers'}
      </p>
      {filtered.length === 0 ? (
        <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-10 text-center text-sm">
          No providers match.{' '}
          {(query.q || query.type) && (
            <Link href="/providers" className="text-accent underline">
              Clear the search
            </Link>
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((p) => (
            <ProviderCard key={p.slug} p={p} />
          ))}
        </ul>
      )}
      <Pager
        page={page.page}
        pageCount={page.pageCount}
        hrefFor={(n) => providersHref({ ...query, page: n })}
      />
    </Container>
  );
}
