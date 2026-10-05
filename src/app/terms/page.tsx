import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, ContentSection } from '@/components/content/content-page';

const UPDATED = '2026-10-05';

const DESCRIPTION =
  'The terms for using AXIOM AI: information provided as is, verify before relying on it, fair use of the site and API, and accounts.';

export const metadata: Metadata = {
  title: 'Terms',
  description: DESCRIPTION,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <ContentPage
      path="/terms"
      eyebrow="Legal"
      title="Terms of use"
      lead="Plain terms for using this site and its public API."
      updated={UPDATED}
    >
      <ContentSection id="info" title="Information, not advice">
        <p>
          AXIOM AI publishes information about AI models that is collected from public sources, each
          with a link and a date. It is provided as is, for general information. It is not
          professional, legal, financial or procurement advice, and it can be incomplete or out of
          date. Prices, limits and availability change: check the linked source before you rely on a
          value or make a decision.
        </p>
      </ContentSection>

      <ContentSection id="accuracy" title="Accuracy and corrections">
        <p>
          Every effort is made to record sources faithfully, and uncertain values are labelled or
          left out (see the <Link href="/methodology">data methodology</Link>). We do not warrant
          that anything is complete or error free. If you find a mistake,{' '}
          <Link href="/contact">tell us</Link> with a source.
        </p>
      </ContentSection>

      <ContentSection id="use" title="Using the site and the API">
        <ul>
          <li>
            You may browse, link to and quote the site, and use the public read API at{' '}
            <code className="text-fg font-mono text-sm">/api/v1</code> within its rate limits
            (responses include the limits that apply to you).
          </li>
          <li>
            Do not try to disrupt the service, bypass rate limits, probe for vulnerabilities without
            permission, or access accounts or administrative functions that are not yours.
          </li>
          <li>
            When you republish data from here, keep the source attribution and the verification
            labels with it, so provider-reported figures are not presented as independent results.
          </li>
        </ul>
      </ContentSection>

      <ContentSection id="accounts" title="Accounts">
        <p>
          An account is optional and personal. Keep your password private: you are responsible for
          activity under your account. Passwords cannot be reset by email yet, so a forgotten
          password cannot be recovered. You can delete your account at any time in{' '}
          <Link href="/settings">Settings</Link>, and the access may be suspended if it is abused.
        </p>
      </ContentSection>

      <ContentSection id="marks" title="Names and independence">
        <p>
          AXIOM AI is independent and is not affiliated with, sponsored by or endorsed by the
          providers it describes. Provider, model and product names are trademarks of their
          respective owners and appear only to identify what they refer to. Linked sites are not
          under our control.
        </p>
      </ContentSection>

      <ContentSection id="liability" title="Liability">
        <p>
          To the extent the law allows, the operator of this site is not liable for loss arising
          from use of, or reliance on, the information or the service, and the service may change or
          be unavailable at any time. Nothing here limits rights you have by law that cannot be
          limited.
        </p>
        <p>
          These terms describe the software’s intended use. The organisation that runs this site is
          responsible for them and for adapting them to the rules that apply to them. See also the{' '}
          <Link href="/privacy">privacy notice</Link>.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
