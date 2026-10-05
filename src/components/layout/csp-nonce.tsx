'use client';

import { setNonce } from 'get-nonce';

/**
 * Hands this request's CSP nonce to libraries that inject <style> tags at runtime. Radix dialogs
 * and menus lock page scroll through react-remove-scroll, which creates a <style> element when one
 * opens; with a nonce-based style-src that element is blocked unless it carries the nonce.
 * Runs during render (before any dialog can open) and is idempotent.
 */
export function CspNonce({ nonce }: { nonce?: string }) {
  if (nonce) setNonce(nonce);
  return null;
}
