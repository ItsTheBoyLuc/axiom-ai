'use client';

import { useId } from 'react';
import { useSession } from '@/components/account/session-provider';
import {
  MOTION_PREFERENCES,
  isMotionPreference,
  motionLabel,
  type MotionPreference,
} from '@/lib/motion-preference';
import { useMotionPreference } from './motion-preference-provider';

/**
 * Footer control for the motion setting (also in Settings). Works without an account; signed in,
 * the choice is saved to the account too (best effort, never blocks).
 */
export function MotionSetting() {
  const id = useId();
  const { preference, mode, setPreference } = useMotionPreference();
  const session = useSession();

  function onChange(value: string) {
    if (!isMotionPreference(value)) return;
    setPreference(value as MotionPreference);
    if (session.status === 'user') void session.updatePreferences({ motion: value });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-muted">
        Motion
      </label>
      <select
        id={id}
        value={preference}
        onChange={(e) => onChange(e.target.value)}
        className="border-line bg-elevated text-fg-2 hover:border-line-strong focus-visible:outline-accent h-8 rounded-md border px-2 text-xs"
        aria-describedby={`${id}-now`}
      >
        {MOTION_PREFERENCES.map((m) => (
          <option key={m} value={m}>
            {motionLabel[m]}
          </option>
        ))}
      </select>
      <span id={`${id}-now`} className="sr-only">
        Currently {mode === 'full' ? 'full motion' : 'reduced motion'}.
      </span>
    </div>
  );
}
