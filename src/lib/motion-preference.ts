/**
 * The motion setting (docs/DECISIONS.md, Phase 11). One preference, three values:
 *
 * - `system`  (default): follow the operating system's "reduce motion" setting;
 * - `full`: the full cinematic experience, even if the OS asks for reduced motion;
 * - `reduced`: no pinning, parallax, smooth-scroll or scroll-linked effects, only short fades.
 *
 * The effective mode is written to `<html data-motion="full|reduced">` by an inline script before
 * first paint (so CSS and every component agree without a flash) and kept in sync by
 * `MotionPreferenceProvider`. Pure functions here; no DOM access outside the script string.
 */
export const MOTION_PREFERENCES = ['system', 'full', 'reduced'] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];
export type MotionMode = 'full' | 'reduced';

export const MOTION_STORAGE_KEY = 'axiom-motion';

export const motionLabel: Record<MotionPreference, string> = {
  system: 'System default',
  full: 'Full motion',
  reduced: 'Reduced',
};

export const motionHelp: Record<MotionPreference, string> = {
  system: 'Follows your device’s reduce-motion setting.',
  full: 'Scroll animation, parallax and the moving background, even if your device asks for less.',
  reduced: 'No scroll effects, parallax or smooth scrolling. Content only fades in briefly.',
};

export function isMotionPreference(v: unknown): v is MotionPreference {
  return typeof v === 'string' && (MOTION_PREFERENCES as readonly string[]).includes(v);
}

/** The mode a preference resolves to, given whether the OS asks for reduced motion. */
export function resolveMotion(pref: MotionPreference, osReduces: boolean): MotionMode {
  if (pref === 'full') return 'full';
  if (pref === 'reduced') return 'reduced';
  return osReduces ? 'reduced' : 'full';
}

/** Runs before first paint (see app/layout.tsx). Keep in sync with resolveMotion above. */
export const motionInitScript = `(function(){try{var p=localStorage.getItem('${MOTION_STORAGE_KEY}');var os=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var m=p==='full'?'full':p==='reduced'?'reduced':(os?'reduced':'full');document.documentElement.setAttribute('data-motion',m);}catch(e){document.documentElement.setAttribute('data-motion','full');}})();`;
