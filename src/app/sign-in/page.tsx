import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Container } from '@/components/ui/section';
import { safeNextPath } from '@/lib/auth/credentials';
import { getCurrentUser } from '../../../server/auth/current-user';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to AXIOM AI.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function SignInPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const user = await getCurrentUser();
  // Already signed in: go where they were headed (only ever a same-site path).
  if (user) redirect(safeNextPath(raw, user.role === 'ADMIN' ? '/admin' : '/'));

  return (
    <Container className="py-16 sm:py-24">
      <div className="border-line bg-card mx-auto w-full max-w-md rounded-2xl border p-6 sm:p-8">
        <h1 className="t-h2">Sign in</h1>
        <p className="text-fg-2 mt-2 text-sm">
          Browsing AXIOM AI never needs an account. Sign in is for administrators, and later for
          saving comparisons.
        </p>
        <div className="mt-6">
          <SignInForm next={safeNextPath(raw, '')} />
        </div>
      </div>
    </Container>
  );
}
