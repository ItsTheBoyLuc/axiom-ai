import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, ContentSection } from '@/components/content/content-page';
import { verificationLabel } from '@/lib/verification';
import { getRepositories } from '../../../server/repositories';

// The list comes from the database, which is not available at build time.
export const dynamic = 'force-dynamic';

const DESCRIPTION =
  'Every website AXIOM AI reads its facts from, with the number of records each one supports and how those records are verified.';

export const metadata: Metadata = {
  title: 'Sources',
  description: DESCRIPTION,
  alternates: { canonical: '/sources' },
};

const nf = new Intl.NumberFormat('en-GB');

export default async function SourcesPage() {
  const s = await getRepositories().sources.summary();

  return (
    <ContentPage
      path="/sources"
      eyebrow="Platform"
      title="Sources"
      lead="Every record on this site points to the page it was read from. This is the list of those websites, generated from the database, so it cannot drift from the data."
    >
      <ContentSection id="summary" title="At a glance">
        <p>
          <strong>{nf.format(s.totalRecords)}</strong> factual records are backed by{' '}
          <strong>{nf.format(s.hosts.length)}</strong> websites.{' '}
          {s.withoutSource > 0
            ? `${nf.format(s.withoutSource)} records have no source link because the value is not publicly disclosed or is explicitly marked unverified.`
            : 'Every record has a source link.'}{' '}
          How each status is assigned is explained in the{' '}
          <Link href="/methodology#statuses">data methodology</Link>.
        </p>
      </ContentSection>

      <ContentSection id="websites" title="Websites">
        {s.hosts.length === 0 ? (
          <p>No sourced records are loaded yet.</p>
        ) : (
          <div className="border-line overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">
                Source websites, the number of records each supports, and their verification
                statuses
              </caption>
              <thead className="bg-card text-muted font-mono text-xs uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Website
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">
                    Records
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Verification
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {s.hosts.map((h) => (
                  <tr key={h.host}>
                    <th scope="row" className="px-4 py-3 font-normal break-all">
                      <a
                        href={`https://${h.host}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        {h.host}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </th>
                    <td className="text-fg px-4 py-3 text-right font-mono">
                      {nf.format(h.records)}
                    </td>
                    <td className="text-fg-2 px-4 py-3">
                      {Object.entries(h.byStatus)
                        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                        .map(
                          ([status, n]) =>
                            `${verificationLabel[status as keyof typeof verificationLabel]} ${nf.format(n ?? 0)}`,
                        )
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ContentSection>

      <ContentSection id="reading" title="Reading a source on a record">
        <p>
          Each model, price, benchmark result, release and article shows its source link and the
          date it was last checked. If a link no longer works or a page has changed, the stored
          value is a snapshot of what was true on that date, so please{' '}
          <Link href="/contact">tell us</Link> and it will be re-checked.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
