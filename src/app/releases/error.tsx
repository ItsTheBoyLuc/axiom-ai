'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function ReleasesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState error={error} reset={reset} title="Could not load releases" scope="releases" />
  );
}
