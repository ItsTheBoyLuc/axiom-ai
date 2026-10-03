/** Single source for navigation so navbar, footer, palette and stub pages stay in sync. */
export type NavItem = { label: string; href: string };

export const primaryNav: NavItem[] = [
  { label: 'Models', href: '/models' },
  { label: 'Providers', href: '/providers' },
  { label: 'Compare', href: '/compare' },
  { label: 'Benchmarks', href: '/benchmarks' },
  { label: 'Releases', href: '/releases' },
  { label: 'News', href: '/news' },
];

export const footerColumns: { title: string; links: NavItem[] }[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Models', href: '/models' },
      { label: 'Providers', href: '/providers' },
      { label: 'Benchmarks', href: '/benchmarks' },
      { label: 'Comparisons', href: '/compare' },
      { label: 'Releases', href: '/releases' },
      { label: 'News', href: '/news' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Data methodology', href: '/methodology' },
      { label: 'Sources', href: '/sources' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
];

/**
 * Routes whose real page is not built yet. They render an honest "not built yet" page
 * (see app/[slug]/page.tsx) instead of a 404. Remove a slug when its phase ships.
 */
export const pendingRoutes: Record<string, { title: string; phase: string }> = {
  news: { title: 'News', phase: 'Phase 7' },
  about: { title: 'About', phase: 'Phase 10' },
  methodology: { title: 'Data methodology', phase: 'Phase 10' },
  sources: { title: 'Sources', phase: 'Phase 10' },
  contact: { title: 'Contact', phase: 'Phase 10' },
  privacy: { title: 'Privacy', phase: 'Phase 10' },
  terms: { title: 'Terms', phase: 'Phase 10' },
  cookies: { title: 'Cookies', phase: 'Phase 10' },
};
