import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, ContentSection } from '@/components/content/content-page';
import { VerificationBadge } from '@/components/ui/badges';
import { VERIFICATION_STATUSES, type VerificationStatus } from '@/lib/verification';
import { getRepositories } from '../../../server/repositories';

// Counts come from the database, which is not available at build time.
export const dynamic = 'force-dynamic';

const DESCRIPTION =
  'How AXIOM AI collects, verifies and presents model data: verification statuses, source rules, benchmark and pricing handling, and how gaps are shown.';

export const metadata: Metadata = {
  title: 'Data methodology',
  description: DESCRIPTION,
  alternates: { canonical: '/methodology' },
};

const MEANING: Record<VerificationStatus, string> = {
  OFFICIALLY_VERIFIED:
    'Read directly from an official page of the provider (documentation, pricing page, model card, announcement) and checked again on the date shown.',
  INDEPENDENTLY_EVALUATED:
    'A result produced by a party that is not the provider, such as an independent benchmark organisation or leaderboard, with the evaluation described.',
  PROVIDER_REPORTED:
    'A figure the provider published about its own model (for example a score in a model card). Real and sourced, but self-reported and not independently reproduced.',
  COMMUNITY_REPORTED:
    'Reported by a community source (for example a public repository or forum). Useful, but not reviewed by the provider or an independent evaluator.',
  UNVERIFIED:
    'Recorded but not confirmed against a primary source. Shown with an explicit label, and replaced as soon as a better source exists.',
  NOT_PUBLICLY_DISCLOSED:
    'The provider has not published this value, so none is shown. The record exists to say so, and nothing is estimated in its place.',
};

export default async function MethodologyPage() {
  const sources = await getRepositories().sources.summary();

  return (
    <ContentPage
      path="/methodology"
      eyebrow="Platform"
      title="Data methodology"
      lead="What counts as a fact here, how it gets in, and how the page tells you how far to trust it."
    >
      <ContentSection id="rules" title="The rules">
        <ul>
          <li>
            <strong>Sourced or absent.</strong> A value is stored only if it was read from a
            specific page. That page’s address, the date it was checked and a verification status
            are stored with it.
          </li>
          <li>
            <strong>No guessing.</strong> If a value cannot be verified it is left empty and shown
            as “Not publicly disclosed”. Values are never estimated, interpolated or converted.
          </li>
          <li>
            <strong>Current lineups come from current pages.</strong> Model names, versions, dates,
            prices and specifications are taken from the provider’s own documentation at the time of
            collection, never from memory.
          </li>
          <li>
            <strong>Descriptions are written in our own words</strong>, short, and link back to the
            source rather than copying it.
          </li>
        </ul>
      </ContentSection>

      <ContentSection id="statuses" title="Verification statuses">
        <p>Every record carries exactly one status. They are ordered from most to least trusted.</p>
        <ul className="!list-none !pl-0">
          {VERIFICATION_STATUSES.map((status) => (
            <li key={status} className="!pl-0">
              <div className="flex flex-wrap items-center gap-3">
                <VerificationBadge status={status} />
                <span className="text-muted font-mono text-xs">
                  {sources.byStatus[status].toLocaleString('en-GB')} records now
                </span>
              </div>
              <p className="mt-1.5">{MEANING[status]}</p>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection id="benchmarks" title="Benchmarks">
        <ul>
          <li>
            Each result shows the benchmark and its version, the methodology, the evaluation date,
            the exact model version, the source, and whether it was evaluated independently or
            reported by the provider.
          </li>
          <li>
            Different versions or scoring protocols of a benchmark are separate entries, so
            incompatible scores are never placed on one axis.
          </li>
          <li>
            There is <strong>no overall score and no global ranking</strong>. Sorting by a single
            benchmark is allowed and labelled as exactly that.
          </li>
          <li>
            Only scores that can be read in an official model card or announcement, or on an
            independent leaderboard, are recorded. Scores are never converted between scales.
          </li>
        </ul>
      </ContentSection>

      <ContentSection id="pricing" title="Pricing">
        <p>
          Prices are stored with their currency, the unit (for example per million tokens), the date
          from which they apply and whether they are current. Older prices are kept and labelled as
          history rather than overwritten. A price is shown only if the provider publishes one for
          that unit; where tiers or conditions exist they are shown as separate lines.
        </p>
      </ContentSection>

      <ContentSection id="news" title="News and research">
        <p>
          Items are real articles and papers, listed with their publisher, date and link. Official
          announcements and independent coverage are visually distinct. A summary written by a
          machine is labelled “AI summary”. When a source only shows an “updated” date, the page
          says updated, not published.
        </p>
      </ContentSection>

      <ContentSection id="updates" title="How data changes">
        <ul>
          <li>
            Automated collection (feeds and public APIs, honouring robots.txt and rate limits) never
            publishes anything directly. It proposes records that a person reviews.
          </li>
          <li>
            An import can never lower the trust level of data that is already verified unless an
            administrator explicitly approves that on purpose, and every such decision is written to
            an audit log.
          </li>
          <li>
            Placeholder data, where it is used for development, is flagged “Demo data” and is never
            mixed with verified records.
          </li>
        </ul>
      </ContentSection>

      <ContentSection id="limits" title="Limits worth knowing">
        <ul>
          <li>
            Coverage is deliberately narrower than “everything that exists”: a provider or model
            appears once its facts can be sourced.
          </li>
          <li>
            Benchmark coverage is thin by nature. Most published scores are provider reported, and
            few models share a benchmark, so comparison tables contain many “No verified data”
            cells. That is the state of public evidence, not a bug.
          </li>
          <li>
            Pages show data as of the last collection date on each record. Always follow the source
            link before relying on a price or a limit.
          </li>
        </ul>
        <p>
          See <Link href="/sources">where the data comes from</Link>, or report a problem on the{' '}
          <Link href="/contact">contact page</Link>.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
