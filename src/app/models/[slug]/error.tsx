'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function ModelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="Could not load this model" scope="model" />;
}
