/**
 * PLACEHOLDER DATA for layout only (docs/PROMPT.md section 2).
 * Names are deliberately fictional and every value is invented; nothing here describes a
 * real provider, model, price, benchmark or article. Every record has isDemo = true and the
 * UI renders a DEMO DATA badge next to it. Replaced by sourced data in Phase 3.
 * (Demo MODELS live in server/repositories/demo/models.ts behind the repository layer.)
 */

export type DemoProvider = {
  slug: string;
  name: string;
  monogram: string;
  description: string;
  /** "listed" providers get their own filter entry; "other" providers are grouped under Other. */
  tier: 'listed' | 'other';
  isDemo: true;
};

export type DemoRelease = {
  id: string;
  date: string;
  providerSlug: string;
  model: string;
  description: string;
  isDemo: true;
};

export type DemoNews = {
  id: string;
  title: string;
  publisher: string;
  date: string;
  summary: string;
  providerSlug: string;
  isOfficial: boolean;
  isAiSummary: boolean;
  isDemo: true;
};

const lorem = 'Placeholder description used to test the layout. Not a real record.';

const provider = (letter: string, tier: DemoProvider['tier'] = 'listed'): DemoProvider => ({
  slug: `demo-provider-${letter.toLowerCase()}`,
  name: `Demo Provider ${letter}`,
  monogram: letter,
  description: lorem,
  tier,
  isDemo: true,
});

export const demoProviders: DemoProvider[] = [
  provider('A'),
  provider('B'),
  provider('C'),
  provider('D'),
  provider('E'),
  provider('F'),
  provider('G', 'other'),
];

export const demoReleases: DemoRelease[] = [
  {
    id: 'r1',
    date: '2026-03-01',
    providerSlug: 'demo-provider-a',
    model: 'Sample Model 1',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
  {
    id: 'r2',
    date: '2026-02-01',
    providerSlug: 'demo-provider-b',
    model: 'Sample Model 2',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
  {
    id: 'r3',
    date: '2026-01-01',
    providerSlug: 'demo-provider-c',
    model: 'Sample Model 3',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
  {
    id: 'r4',
    date: '2025-12-01',
    providerSlug: 'demo-provider-d',
    model: 'Sample Model 4',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
];

export const demoNews: DemoNews[] = [
  {
    id: 'n1',
    title: 'Sample headline: an official announcement',
    publisher: 'Demo Publisher',
    date: '2026-03-02',
    summary: 'Placeholder summary used to test the news card layout. Not a real article.',
    providerSlug: 'demo-provider-a',
    isOfficial: true,
    isAiSummary: false,
    isDemo: true,
  },
  {
    id: 'n2',
    title: 'Sample headline: independent reporting',
    publisher: 'Demo Publisher',
    date: '2026-02-20',
    summary: 'Placeholder summary used to test the news card layout. Not a real article.',
    providerSlug: 'demo-provider-b',
    isOfficial: false,
    isAiSummary: true,
    isDemo: true,
  },
  {
    id: 'n3',
    title: 'Sample headline: research note',
    publisher: 'Demo Publisher',
    date: '2026-02-10',
    summary: 'Placeholder summary used to test the news card layout. Not a real article.',
    providerSlug: 'demo-provider-c',
    isOfficial: false,
    isAiSummary: false,
    isDemo: true,
  },
];

export const providerBySlug = (slug: string) => demoProviders.find((p) => p.slug === slug);
