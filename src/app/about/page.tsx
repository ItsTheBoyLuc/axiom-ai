import type { Metadata } from 'next';
import Link from 'next/link';
import { CinematicRoot } from '@/components/cinematic/cinematic-root';
import { ContentPage, ContentSection } from '@/components/content/content-page';
import { ButtonLink } from '@/components/ui/button';
import { getCinematicSeed } from '../../../server/services/cinematic-seed';

const DESCRIPTION =
  'AXIOM AI is an independent reference for discovering, researching and comparing AI models, where every fact carries its source.';

export const metadata: Metadata = {
  title: 'About',
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
};

// The background network is seeded from the data, so the page is rendered per request.
export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const seed = await getCinematicSeed();
  return (
    <CinematicRoot level="light" seed={seed}>
      <ContentPage
        path="/about"
        eyebrow="Platform"
        title="About AXIOM AI"
        lead="A reference for the AI models people actually choose between: what they are, what they cost, how they were measured, and where each claim comes from."
      >
        <ContentSection id="what" title="What it is">
          <p>
            AXIOM AI brings model profiles, provider pages, pricing, benchmark results, release
            history and news into one place, with search and a side-by-side comparison. It is built
            for people who have to decide which model to use, and for anyone who wants to know what
            is publicly established about a model rather than what a launch post implied.
          </p>
        </ContentSection>

        <ContentSection id="principles" title="Principles">
          <ul>
            <li>
              <strong>Every fact has a source.</strong> Each record links to the page it was read
              from, with the date it was checked and how much that source can be trusted. See the{' '}
              <Link href="/methodology">data methodology</Link>.
            </li>
            <li>
              <strong>Gaps are shown as gaps.</strong> When a value is not publicly available it
              reads “Not publicly disclosed”. Nothing is estimated, interpolated or filled in from
              memory.
            </li>
            <li>
              <strong>No overall score, no global ranking.</strong> Benchmarks measure different
              things in different ways, so they are never blended into one number. You can sort and
              filter, and the page tells you what the sort means.
            </li>
            <li>
              <strong>Provider claims and independent results look different.</strong> A score a
              provider published about its own model is labelled as provider reported, and is never
              presented as an independent evaluation.
            </li>
            <li>
              <strong>Summaries are labelled.</strong> Machine-written summaries carry an “AI
              summary” badge, and official announcements are visually distinct from independent
              coverage.
            </li>
          </ul>
        </ContentSection>

        <ContentSection id="independence" title="Independence">
          <p>
            AXIOM AI is not affiliated with, sponsored by or endorsed by any model provider. Model
            and company names belong to their owners and are used only to identify the products they
            describe. There are no advertisements and no paid placements.
          </p>
        </ContentSection>

        <ContentSection id="accounts" title="Accounts are optional">
          <p>
            Everything on the site works without an account. An account only adds saving: models,
            comparisons, your preferred providers and a personalised start page. Read about what is
            stored in the <Link href="/privacy">privacy notice</Link>.
          </p>
        </ContentSection>

        <ContentSection id="corrections" title="Spotted a mistake?">
          <p>
            Corrections are welcome and are checked against the primary source before anything
            changes. Use the <Link href="/contact">contact page</Link> and include the record and
            the source that shows the correct value.
          </p>
        </ContentSection>

        <div>
          <ButtonLink href="/models" arrow>
            Explore AI models
          </ButtonLink>
        </div>
      </ContentPage>
    </CinematicRoot>
  );
}
