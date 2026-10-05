import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, ContentSection } from '@/components/content/content-page';
import { getEnv } from '@/lib/env';

// The contact address is runtime configuration, so the page is rendered per request.
export const dynamic = 'force-dynamic';

const UPDATED = '2026-10-05';

const DESCRIPTION =
  'What AXIOM AI stores about you, why, for how long, and how to delete it. Browsing needs no account and sets no tracking.';

export const metadata: Metadata = {
  title: 'Privacy',
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  const email = getEnv().CONTACT_EMAIL;

  return (
    <ContentPage
      path="/privacy"
      eyebrow="Legal"
      title="Privacy"
      lead="The short version: browsing is anonymous, there is no tracking, and an account stores only what is needed to save your things."
      updated={UPDATED}
    >
      <ContentSection id="browsing" title="If you just browse">
        <ul>
          <li>No account, no sign-in and no cookie are needed to use the site.</li>
          <li>
            There are no analytics, advertising or social-media trackers, and no third-party
            scripts, fonts or images are loaded: everything is served from this site.
          </li>
          <li>
            Some convenience settings stay in your own browser and are never sent to us: your theme,
            the models in your comparison tray, recent searches, recently viewed models and
            comparison history. Clearing site data removes them. See{' '}
            <Link href="/cookies">cookies and storage</Link>.
          </li>
          <li>
            To protect the site from abuse, request counters are kept briefly (at most an hour,
            usually minutes) keyed by network address. They are not used for anything else.
          </li>
        </ul>
      </ContentSection>

      <ContentSection id="account" title="If you create an account">
        <p>We store:</p>
        <ul>
          <li>your email address and, optionally, a name;</li>
          <li>
            your password as a salted Argon2id hash (the password itself is never stored and cannot
            be recovered);
          </li>
          <li>
            a session record for each signed-in browser: a hashed token and its expiry (seven days,
            extended while you are active);
          </li>
          <li>
            what you chose to save: models, comparisons, preferred providers, theme preference, the
            “For you” setting, and the models you recently viewed while signed in.
          </li>
        </ul>
        <p>
          This is used to run your account and nothing else. It is not sold, shared or used for
          advertising or profiling.
        </p>
      </ContentSection>

      <ContentSection id="admin" title="Administrative records">
        <p>
          Changes made by site administrators are written to an audit log (who, what, when, and the
          network address). That log is about the data on the site, not about visitors.
        </p>
      </ContentSection>

      <ContentSection id="deleting" title="Deleting your data">
        <p>
          You can delete your account at any time in <Link href="/settings">Settings</Link>. This
          removes your profile, sessions, saved items, preferences and history. Entries in the audit
          log that concern your account are scrubbed of your email and network address and kept only
          as a record that an account existed and was deleted. You can sign out of every other
          browser by changing your password.
        </p>
      </ContentSection>

      <ContentSection id="security" title="Security">
        <p>
          Passwords are hashed with Argon2id, session cookies are HttpOnly and sent only to this
          site, sign-in and sign-up are rate limited, and the site is served with a strict content
          security policy. No system is perfectly secure, but personal data is kept to the minimum
          above so there is little to lose.
        </p>
      </ContentSection>

      <ContentSection id="requests" title="Your choices and questions">
        <p>
          You can ask for access to, correction of or deletion of your personal data.{' '}
          {email ? (
            <>
              Write to <a href={`mailto:${email}`}>{email}</a>.
            </>
          ) : (
            <>
              Use the <Link href="/contact">contact page</Link>.
            </>
          )}{' '}
          Email addresses are not verified yet, and there is no password-reset email, so we cannot
          recover an account whose password was forgotten.
        </p>
        <p>
          This notice describes how the software behaves. The organisation that runs this site is
          responsible for it, and for adapting it to the rules that apply to them.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
