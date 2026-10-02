'use client';

import { motion } from 'motion/react';
import { distance, duration, ease } from '@/lib/motion';

/**
 * Page transition: re-mounts per navigation. Opacity + small rise. Reduced motion is handled by
 * MotionProvider (the rise is skipped, the fade stays); this component must not branch on it, or
 * the server and first client render differ and hydration fails.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance.sm }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      {children}
    </motion.div>
  );
}
