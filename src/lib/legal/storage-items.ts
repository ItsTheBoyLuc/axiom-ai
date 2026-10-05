export type StorageItem = {
  name: string;
  kind: string;
  purpose: string;
  lasts: string;
  when: string;
};

/** Everything the site writes to the browser, as listed on /cookies. A unit test fails if the code stores a key that is not listed here. */
export const STORAGE_ITEMS: StorageItem[] = [
  {
    name: 'axiom_session (https: __Host-axiom_session)',
    kind: 'Cookie, HttpOnly',
    purpose: 'Keeps you signed in. Holds a random token, not your data.',
    lasts: '7 days, extended while you are active; removed when you sign out',
    when: 'Only after you sign in or create an account',
  },
  {
    name: 'axiom-theme',
    kind: 'Local storage',
    purpose: 'Remembers system, dark or light so the page does not flash.',
    lasts: 'Until you clear site data',
    when: 'When you change the theme',
  },
  {
    name: 'axiom-motion',
    kind: 'Local storage',
    purpose: 'Remembers your motion setting (system default, full motion or reduced).',
    lasts: 'Until you clear site data',
    when: 'When you change the motion setting',
  },
  {
    name: 'axiom-compare',
    kind: 'Local storage',
    purpose: 'Keeps the models you added to the comparison tray.',
    lasts: 'Until you clear site data or remove them',
    when: 'When you add a model to compare',
  },
  {
    name: 'axiom-compare-history',
    kind: 'Local storage',
    purpose: 'Lists your recent comparisons so you can reopen them.',
    lasts: 'Until you clear site data',
    when: 'When you open a comparison',
  },
  {
    name: 'axiom-recent-searches',
    kind: 'Local storage',
    purpose: 'Suggests your recent searches in the search palette.',
    lasts: 'Until you clear site data',
    when: 'When you search',
  },
  {
    name: 'axiom-recent',
    kind: 'Local storage',
    purpose: 'Shows models you recently viewed.',
    lasts: 'Until you clear site data',
    when: 'When you open a model',
  },
];
