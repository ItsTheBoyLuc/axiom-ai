import type { Metadata } from 'next';
import Link from 'next/link';
import { SavedComparisonsList, SavedModelsList } from '@/components/account/saved-lists';
import { Container } from '@/components/ui/section';
import {
  listComparisons,
  listRecentlyViewed,
  listSavedModels,
} from '../../../server/account/service';
import { requireUserPage } from '../../../server/auth/current-user';
import { getPrisma } from '../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Saved and recent',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await requireUserPage('/account');
  const db = getPrisma();
  const [saved, comparisons, recent] = await Promise.all([
    listSavedModels(db, user.id),
    listComparisons(db, user.id),
    listRecentlyViewed(db, user.id, 12),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h2">Saved and recent</h1>
          <p className="text-fg-2 mt-2 text-sm">
            Signed in as <span className="text-fg font-mono">{user.email}</span>.
          </p>
        </div>
        <Link
          href="/settings"
          className="border-line-strong bg-elevated text-fg hover:border-fg-2/50 inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Settings
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section aria-labelledby="saved-models" className="min-w-0">
          <h2 id="saved-models" className="t-h3 mb-3">
            Saved models ({saved.length})
          </h2>
          <SavedModelsList initial={saved} />
        </section>

        <section aria-labelledby="saved-comparisons" className="min-w-0">
          <h2 id="saved-comparisons" className="t-h3 mb-3">
            Saved comparisons ({comparisons.length})
          </h2>
          <SavedComparisonsList initial={comparisons} />
        </section>

        <section aria-labelledby="recent" className="min-w-0 lg:col-span-2">
          <h2 id="recent" className="t-h3 mb-3">
            Recently viewed
          </h2>
          {recent.length === 0 ? (
            <p className="border-line text-fg-2 rounded-xl border p-6 text-sm">
              Models you open while signed in show up here.{' '}
              <Link href="/models" className="text-accent underline underline-offset-2">
                Browse models
              </Link>
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((m) => (
                <li key={m.slug}>
                  <Link
                    href={`/models/${m.slug}`}
                    className="border-line bg-card hover:border-line-strong block rounded-xl border p-4 transition-colors"
                  >
                    <span className="text-fg block truncate text-sm font-medium">{m.name}</span>
                    <span className="text-fg-2 block truncate text-xs">{m.providerName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}
