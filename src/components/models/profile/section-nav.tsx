'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { PROFILE_SECTIONS } from './profile-section';

/** Sections count as "reached" once their top passes the sticky navs (scroll-mt-36 = 144px) plus slack. */
const OFFSET_PX = 160;

/**
 * Sticky in-page navigation. The active item is the last section whose top has scrolled past
 * the sticky navs (deterministic, unlike overlap-based observers, so clicking a link always
 * highlights that link). Scrolling to the very bottom activates the final section.
 */
export function SectionNav() {
  const [active, setActive] = useState<string>(PROFILE_SECTIONS[0].id);

  useEffect(() => {
    let frame = 0;
    const compute = () => {
      frame = 0;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: string = PROFILE_SECTIONS[0].id;
      for (const s of PROFILE_SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= OFFSET_PX) current = s.id;
      }
      if (atBottom) current = PROFILE_SECTIONS[PROFILE_SECTIONS.length - 1]!.id;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <nav
      aria-label="On this page"
      className="border-line bg-bg/85 sticky top-16 z-30 -mx-4 border-b px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <ul className="flex gap-1 overflow-x-auto py-2">
        {PROFILE_SECTIONS.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={on ? 'location' : undefined}
                className={`relative inline-flex h-9 items-center rounded-lg px-3 text-sm transition-colors ${
                  on ? 'text-fg' : 'text-fg-2 hover:text-fg'
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="section-nav-active"
                    transition={spring.snappy}
                    className="bg-elevated absolute inset-0 -z-10 rounded-lg"
                  />
                )}
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
