import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, ContentSection } from '@/components/content/content-page';
import { STORAGE_ITEMS } from '@/lib/legal/storage-items';

const UPDATED = '2026-10-05';

const DESCRIPTION =
  'The cookies and browser storage AXIOM AI uses, what each is for and how long it lasts. None is used for tracking or advertising.';

export const metadata: Metadata = {
  title: 'Cookies',
  description: DESCRIPTION,
  alternates: { canonical: '/cookies' },
};

export default function CookiesPage() {
  return (
    <ContentPage
      path="/cookies"
      eyebrow="Legal"
      title="Cookies and browser storage"
      lead="One cookie, only if you sign in. A few settings in your own browser. Nothing for tracking or advertising."
      updated={UPDATED}
    >
      <ContentSection id="summary" title="In short">
        <p>
          Every item below is strictly necessary for a feature you use or ask for (staying signed
          in, remembering your theme, keeping your comparison). There are no analytics, advertising
          or third-party cookies, so there is no consent banner to dismiss. Items kept in local
          storage never leave your browser.
        </p>
      </ContentSection>

      <ContentSection id="list" title="What is stored">
        <div className="border-line overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Cookies and local storage entries</caption>
            <thead className="bg-card text-muted font-mono text-xs uppercase">
              <tr>
                {['Name', 'Type', 'Purpose', 'Lasts', 'Set'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-line divide-y align-top">
              {STORAGE_ITEMS.map((i) => (
                <tr key={i.name}>
                  <th scope="row" className="text-fg px-4 py-3 font-mono text-xs font-normal">
                    {i.name}
                  </th>
                  <td className="text-fg-2 px-4 py-3">{i.kind}</td>
                  <td className="text-fg-2 px-4 py-3">{i.purpose}</td>
                  <td className="text-fg-2 px-4 py-3">{i.lasts}</td>
                  <td className="text-fg-2 px-4 py-3">{i.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentSection>

      <ContentSection id="control" title="Your control">
        <p>
          Sign out to remove the session cookie, or clear this site’s data in your browser to remove
          everything above. The site keeps working without any of it. For what we store on the
          server if you have an account, see the <Link href="/privacy">privacy notice</Link>.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
