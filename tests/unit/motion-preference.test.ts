import { describe, expect, it } from 'vitest';
import {
  MOTION_PREFERENCES,
  isMotionPreference,
  motionInitScript,
  resolveMotion,
} from '@/lib/motion-preference';
import { themeInitScript } from '@/lib/theme-script';

describe('motion preference', () => {
  it('"system" follows the OS setting; "full" and "reduced" override it', () => {
    expect(resolveMotion('system', false)).toBe('full');
    expect(resolveMotion('system', true)).toBe('reduced');
    expect(resolveMotion('full', true)).toBe('full'); // opt in despite the OS asking for less
    expect(resolveMotion('reduced', false)).toBe('reduced'); // opt out even when the OS allows it
  });

  it('accepts only the three known values', () => {
    for (const v of MOTION_PREFERENCES) expect(isMotionPreference(v)).toBe(true);
    for (const v of ['', 'none', 'FULL', null, undefined, 1])
      expect(isMotionPreference(v)).toBe(false);
  });

  it('the inline script is valid JavaScript that sets data-motion, and agrees with resolveMotion', () => {
    const run = (stored: string | null, osReduces: boolean) => {
      const attrs: Record<string, string> = {};
      const fakeWindow = { matchMedia: () => ({ matches: osReduces }) };
      const fakeDocument = {
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      };
      const fakeStorage = { getItem: () => stored };
      new Function('window', 'document', 'localStorage', motionInitScript)(
        fakeWindow,
        fakeDocument,
        fakeStorage,
      );
      return attrs['data-motion'];
    };
    for (const stored of [null, 'system', 'full', 'reduced', 'garbage'] as const) {
      for (const os of [false, true]) {
        const pref = isMotionPreference(stored) ? stored : 'system';
        expect(run(stored, os), `${stored} / os reduces ${os}`).toBe(resolveMotion(pref, os));
      }
    }
  });

  it('the theme and motion scripts can be concatenated into one inline script', () => {
    // They are joined in app/layout.tsx; a missing semicolon or a client reference would break both.
    expect(() => new Function(themeInitScript + motionInitScript)).not.toThrow();
    expect(typeof themeInitScript).toBe('string');
  });
});
