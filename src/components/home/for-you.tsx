import Link from 'next/link';
import { Container } from '@/components/ui/section';
import { formatDate } from '@/lib/format';
import { listRecentlyViewed, listSavedModels } from '../../../server/account/service';
import { getPrisma } from '../../../server/db/client';
import { getRepositories } from '../../../server/repositories';

/**
 * "For you": shown on the home page to signed-in people who have not turned it off. Their saved
 * models, what they looked at last, and the newest releases from the providers they follow.
 * Anonymous visitors never see it and nothing else on the page depends on it.
 */
export async function ForYou({
  userId,
  providers,
}: {
  userId: string;
  /** Preferred provider slugs. */
  providers: string[];
}) {
  const db = getPrisma();
  const repos = getRepositories();
  const followed = providers.slice(0, 5);
  const [saved, recent, releaseLists] = await Promise.all([
    listSavedModels(db, userId),
    listRecentlyViewed(db, userId, 4),
    Promise.all(followed.map((p) => repos.releases.list({ provider: p, page: 1, pageSize: 2 }))),
  ]);
  const releases = releaseLists
    .flatMap((l) => l.items)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const empty = saved.length === 0 && recent.length === 0 && releases.length === 0;

  return (
    <section aria-labelledby="for-you" className="border-line border-y">
      <Container className="py-10">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="for-you" className="t-h2">
            For you
          </h2>
          <Link href="/settings" className="text-fg-2 hover:text-fg text-sm hover:underline">
            Change what you see
          </Link>
        </div>

        {empty ? (
          <p className="text-fg-2 max-w-2xl text-sm">
            Make this page yours: save a model from its page, or{' '}
            <Link href="/settings" className="text-accent underline underline-offset-2">
              choose the providers you follow
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="min-w-0">
              <h3 className="t-eyebrow mb-3">Saved models</h3>
              {saved.length === 0 ? (
                <p className="text-fg-2 text-sm">Nothing saved yet.</p>
              ) : (
                <ul className="space-y-2">
                  {saved.slice(0, 4).map((m) => (
                    <li key={m.slug}>
                      <Link
                        href={`/models/${m.slug}`}
                        className="hover:text-accent text-fg block truncate text-sm font-medium"
                      >
                        {m.name}
                        <span className="text-fg-2 font-normal"> · {m.providerName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {saved.length > 4 && (
                <Link
                  href="/account"
                  className="text-accent mt-3 inline-block text-sm hover:underline"
                >
                  All {saved.length} saved
                </Link>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="t-eyebrow mb-3">Pick up where you left off</h3>
              {recent.length === 0 ? (
                <p className="text-fg-2 text-sm">Models you open show up here.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((m) => (
                    <li key={m.slug}>
                      <Link
                        href={`/models/${m.slug}`}
                        className="hover:text-accent text-fg block truncate text-sm font-medium"
                      >
                        {m.name}
                        <span className="text-fg-2 font-normal"> · {m.providerName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="t-eyebrow mb-3">From providers you follow</h3>
              {followed.length === 0 ? (
                <p className="text-fg-2 text-sm">
                  <Link href="/settings" className="text-accent underline underline-offset-2">
                    Choose providers
                  </Link>{' '}
                  to see their newest releases here.
                </p>
              ) : releases.length === 0 ? (
                <p className="text-fg-2 text-sm">No recent releases from them.</p>
              ) : (
                <ul className="space-y-3">
                  {releases.map((r) => (
                    <li key={r.id}>
                      <p className="text-muted font-mono text-xs">
                        <time dateTime={r.date}>{formatDate(r.date)}</time> · {r.provider.name}
                      </p>
                      <p className="text-fg text-sm">{r.title}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
