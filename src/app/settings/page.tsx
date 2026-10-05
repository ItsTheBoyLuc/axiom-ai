import type { Metadata } from 'next';
import Link from 'next/link';
import {
  DeleteAccountForm,
  PasswordForm,
  PreferencesForm,
} from '@/components/account/settings-forms';
import { Container } from '@/components/ui/section';
import { getPreferences } from '../../../server/account/service';
import { requireUserPage } from '../../../server/auth/current-user';
import { getPrisma } from '../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings', robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await requireUserPage('/settings');
  const db = getPrisma();
  const [prefs, providers] = await Promise.all([
    getPreferences(db, user.id),
    db.provider.findMany({ select: { slug: true, name: true }, orderBy: { sortName: 'asc' } }),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10">
        <Link href="/account" className="text-fg-2 hover:text-fg text-sm hover:underline">
          ← Saved and recent
        </Link>
        <h1 className="t-h2 mt-2">Settings</h1>
        <p className="text-fg-2 mt-2 text-sm">
          Signed in as <span className="text-fg font-mono">{user.email}</span>.
        </p>
      </header>

      <div className="max-w-3xl space-y-14">
        <section aria-labelledby="prefs">
          <h2 id="prefs" className="t-h3 mb-4">
            Preferences
          </h2>
          <PreferencesForm initial={prefs} providers={providers} />
        </section>

        <section aria-labelledby="password">
          <h2 id="password" className="t-h3 mb-4">
            Password
          </h2>
          <PasswordForm />
        </section>

        <section aria-labelledby="danger" className="border-danger/30 rounded-xl border p-5">
          <h2 id="danger" className="t-h3 mb-4">
            Delete account
          </h2>
          <DeleteAccountForm />
        </section>
      </div>
    </Container>
  );
}
