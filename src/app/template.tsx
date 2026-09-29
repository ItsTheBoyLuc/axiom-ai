'use client';

import { motion, useReducedMotion } from 'motion/react';
import { distance, duration, ease } from '@/lib/motion';

/** Page transition: re-mounts per navigation. Opacity + small rise; opacity only if reduced motion. */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : distance.sm }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? duration.fast : duration.base, ease: ease.out }}
    >
      {children}
    </motion.div>
  );
}
