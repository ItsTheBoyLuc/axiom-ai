'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/**
 * Share: opens the native share sheet on touch devices, otherwise copies the link.
 * Result is announced politely for screen readers and shown briefly.
 */
export function ShareButton({ title }: { title: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const reset = () => setTimeout(() => setStatus('idle'), 2500);

  const share = async () => {
    const url = window.location.href;
    try {
      const touch = window.matchMedia('(pointer: coarse)').matches;
      if (touch && typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user closed the share sheet
      setStatus('error');
    }
    reset();
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="border-line-strong bg-elevated text-fg hover:border-fg-2/50 inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium"
      >
        {status === 'copied' ? <Check size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
        Share
      </button>
      <span role="status" aria-live="polite" className="text-fg-2 text-sm">
        {status === 'copied' && 'Link copied'}
        {status === 'error' && 'Could not copy the link'}
      </span>
    </span>
  );
}
