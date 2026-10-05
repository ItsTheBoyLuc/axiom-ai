import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, ContentSection } from '@/components/content/content-page';
import { getEnv } from '@/lib/env';

// The address is runtime configuration (CONTACT_EMAIL), so the page is rendered per request.
export const dynamic = 'force-dynamic';

const DESCRIPTION =
  'How to reach the people behind AXIOM AI: corrections, data questions and privacy requests.';

export const metadata: Metadata = {
  title: 'Contact',
  description: DESCRIPTION,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  const email = getEnv().CONTACT_EMAIL;
  const github = process.env.NEXT_PUBLIC_SOCIAL_GITHUB;

  return (
    <ContentPage
      path="/contact"
      eyebrow="Platform"
      title="Contact"
      lead="For corrections, data questions, and requests about your account or personal data."
    >
      <ContentSection id="reach" title="How to reach us">
        {email ? (
          <p>
            Write to <a href={`mailto:${email}`}>{email}</a>. A real person reads it.
          </p>
        ) : (
          <p>
            No public contact address is configured for this deployment. If you run this site, set{' '}
            <code className="text-fg font-mono text-sm">CONTACT_EMAIL</code> and this page will show
            it.
          </p>
        )}
        {github && (
          <p>
            Data problems can also be reported publicly on{' '}
            <a href={github} target="_blank" rel="noopener noreferrer">
              GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </p>
        )}
      </ContentSection>

      <ContentSection id="corrections" title="Reporting a data problem">
        <p>The fastest way to get something fixed is to include:</p>
        <ul>
          <li>the page and the record (for example the model and the price or benchmark),</li>
          <li>what it shows now and what you think is correct,</li>
          <li>
            a link to the primary source (the provider’s own page, model card or the evaluating
            organisation’s page).
          </li>
        </ul>
        <p>
          Changes are made only against a source and are recorded in an audit log. See the{' '}
          <Link href="/methodology">data methodology</Link>.
        </p>
      </ContentSection>

      <ContentSection id="privacy-requests" title="Privacy requests">
        <p>
          You can delete your account and everything saved with it yourself from{' '}
          <Link href="/settings">Settings</Link>. For anything else, contact us at the address above
          and say which account it concerns. See the <Link href="/privacy">privacy notice</Link>.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
