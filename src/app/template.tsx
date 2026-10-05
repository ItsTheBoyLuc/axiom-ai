'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { duration, ease } from '@/lib/motion';

/**
 * True once the first page has hydrated. Module state, so it is `false` on the server (always) and
 * during hydration in the browser, and `true` for every later client-side navigation.
 */
let hydrated = false;

/** Route transition (docs/MOTION.md): short and subtle so content is never held back. */
const ROUTE_RISE = 6;

/**
 * Page transition: re-mounts per navigation, opacity plus a small rise.
 *
 * The FIRST page is deliberately not animated: the server-rendered HTML must be visible as sent.
 * With `initial={{ opacity: 0 }}` the whole page stayed invisible until JavaScript had loaded and
 * hydrated (about four seconds on a slow phone), which made Largest Contentful Paint equal to
 * "time to hydrate". Later navigations are client-rendered, so they can fade in safely.
 *
 * Reduced motion is handled by MotionProvider (the rise is skipped, the fade stays); this component
 * must not branch on it, or the server and first client render differ and hydration fails. The
 * `hydrated` flag is read during render but only flips after mount, so both renders agree.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hydrated = true;
  }, []);

  return (
    <motion.div
      initial={hydrated ? { opacity: 0, y: ROUTE_RISE } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.fast, ease: ease.out }}
    >
      {children}
    </motion.div>
  );
}
