'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function NewsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="Could not load news" scope="news" />;
}
