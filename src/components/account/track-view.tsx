'use client';

import { useEffect } from 'react';
import { useSession } from './session-provider';

/**
 * Records that the signed-in person opened this model (their "recently viewed"). Renders nothing
 * and does nothing for anonymous visitors, whose recents stay in localStorage as before.
 * Fire-and-forget: a failed request must never affect the page.
 */
export function TrackView({ slug }: { slug: string }) {
  const { status } = useSession();
  useEffect(() => {
    if (status !== 'user') return;
    void fetch('/api/v1/me/recently-viewed', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    }).catch(() => undefined);
  }, [status, slug]);
  return null;
}
