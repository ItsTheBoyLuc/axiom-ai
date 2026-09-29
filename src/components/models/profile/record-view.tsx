'use client';

import { useEffect } from 'react';
import { useRecentlyViewed } from '@/components/comparison/comparison-store';

/** Records this model in the local "recently viewed" list. Renders nothing. */
export function RecordView({
  slug,
  name,
  providerName,
}: {
  slug: string;
  name: string;
  providerName: string;
}) {
  const { record } = useRecentlyViewed();
  useEffect(() => {
    record({ slug, name, providerName });
  }, [record, slug, name, providerName]);
  return null;
}
