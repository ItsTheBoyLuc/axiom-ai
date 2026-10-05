/**
 * The theme's inline script and storage key. They live in a plain module (not in the client
 * component that owns the theme) because a server component cannot read a non-component export of
 * a 'use client' module: it gets an opaque reference, and concatenating it into a string yields
 * "function(){throw Error(...)" instead of the script.
 */
export const THEME_STORAGE_KEY = 'axiom-theme';

/**
 * Inline script run before first paint (see layout.tsx) so the correct theme is applied
 * with no flash. Keep in sync with resolve() below.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=p==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.setAttribute('data-theme',d);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
