import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { Container } from '@/components/ui/section';
import { safeNextPath } from '@/lib/auth/credentials';
import { getCurrentUser } from '../../../server/auth/current-user';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create an AXIOM AI account to save models and comparisons.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function SignUpPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  if (await getCurrentUser()) redirect(safeNextPath(raw, '/account'));

  return (
    <Container className="py-16 sm:py-24">
      <div className="border-line bg-card mx-auto w-full max-w-md rounded-2xl border p-6 sm:p-8">
        <h1 className="t-h2">Create an account</h1>
        <p className="text-fg-2 mt-2 text-sm">
          An account lets you save models and comparisons and keep your settings across devices.
          Everything else on AXIOM AI works without one.
        </p>
        <div className="mt-6">
          <SignUpForm next={safeNextPath(raw, '')} />
        </div>
        <p className="text-fg-2 mt-6 text-sm">
          Already have an account?{' '}
          <Link
            href={`/sign-in${raw ? `?next=${encodeURIComponent(safeNextPath(raw, ''))}` : ''}`}
            className="text-accent underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </Container>
  );
}
