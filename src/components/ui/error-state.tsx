'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { Container } from './section';

/**
 * Shared error UI for route error boundaries. Logs the error (with its digest, which links to
 * the server log) and shows a safe message: no stack traces or internals reach the page.
 */
export function ErrorState({
  error,
  reset,
  title = 'Something went wrong',
  scope = 'app',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  scope?: string;
}) {
  useEffect(() => {
    console.error(`[${scope}] render error`, { digest: error.digest, message: error.message });
  }, [error, scope]);

  return (
    <Container className="py-16">
      <div
        role="alert"
        className="border-danger/40 bg-danger/5 mx-auto flex max-w-lg flex-col items-center rounded-2xl border px-8 py-12 text-center"
      >
        <AlertTriangle aria-hidden className="text-danger" size={28} />
        <h1 className="t-h3 mt-4">{title}</h1>
        <p className="text-fg-2 mt-2 text-sm">
          We could not load this page. You can try again, or head back to the start.
        </p>
        {error.digest && (
          <p className="text-muted mt-3 font-mono text-xs">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link
            href="/"
            className="border-line-strong bg-elevated text-fg hover:border-fg-2/50 inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    </Container>
  );
}
