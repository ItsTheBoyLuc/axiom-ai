/** Single source for navigation so navbar, footer and palette stay in sync. */
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
