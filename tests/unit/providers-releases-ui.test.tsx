import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewsCard } from '@/components/news/news-card';
import { Portfolio } from '@/components/providers/portfolio';
import { ProviderCard } from '@/components/providers/provider-card';
import { ReleaseTimelineChart } from '@/components/providers/release-timeline-chart';
import { ReleaseEntry } from '@/components/releases/release-entry';
import { ReleaseList } from '@/components/releases/release-list';
import { ReleaseTimeline } from '@/components/releases/release-timeline';
import { ConfirmationBadge } from '@/components/ui/badges';
import { Pager } from '@/components/ui/pager';
import type { NewsItem, ProviderSummary, ReleaseItem } from '@/types/catalog';
import { model } from './compare-fixtures';

// GSAP is skipped under reduced motion: this is also the no-animation path every visitor can fall back to.
vi.mock('motion/react', async (orig) => ({
  ...(await orig<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}));

const release = (id: string, over: Partial<ReleaseItem> = {}): ReleaseItem => ({
  id,
  kind: 'MAJOR',
  date: '2026-09-22',
  title: `Release ${id}`,
  description: `About ${id}.`,
  announcementUrl: `https://example.invalid/${id}`,
  docsUrl: `https://docs.example.invalid/${id}`,
  provider: { slug: 'openai', name: 'OpenAI' },
  model: { slug: 'gpt-6', name: 'GPT-6' },
  confirmed: true,
  verificationStatus: 'OFFICIALLY_VERIFIED',
  isDemo: false,
  ...over,
});

const provider = (over: Partial<ProviderSummary> = {}): ProviderSummary => ({
  slug: 'openai',
  name: 'OpenAI',
  monogram: 'O',
  description: 'Builds the GPT family.',
  tier: 'listed',
  officialWebsite: 'https://openai.example.invalid',
  headquarters: null,
  orgType: 'COMPANY',
  modelCount: 5,
  latestRelease: {
    title: 'GPT-6.1 released',
    date: '2026-09-29',
    announcementUrl: 'https://example.invalid/gpt61',
  },
  verificationStatus: 'OFFICIALLY_VERIFIED',
  isDemo: false,
  ...over,
});

describe('ConfirmationBadge', () => {
  it('shows the verification status for a confirmed release', () => {
    render(<ConfirmationBadge confirmed status="OFFICIALLY_VERIFIED" />);
    expect(screen.getByText('Officially verified')).toBeInTheDocument();
    expect(screen.queryByText('Unconfirmed')).toBeNull();
  });

  it('says "Unconfirmed", with the underlying status as a tooltip, for anything else', () => {
    render(<ConfirmationBadge confirmed={false} status="COMMUNITY_REPORTED" />);
    const badge = screen.getByText('Unconfirmed');
    expect(badge).toHaveAttribute('title', 'Status: Community reported');
    expect(badge.parentElement?.querySelector('svg')).not.toBeNull(); // an icon, never colour alone
  });
});

describe('ReleaseEntry', () => {
  it('shows date, kind, who shipped what, description and the external links', () => {
    render(<ReleaseEntry item={release('a')} />);
    expect(screen.getByRole('heading', { name: 'Release a' })).toBeInTheDocument();
    expect(screen.getByText('22 Sept 2026')).toBeInTheDocument();
    expect(screen.getByText('Major release')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenAI' })).toHaveAttribute(
      'href',
      '/providers/openai',
    );
    expect(screen.getByRole('link', { name: 'GPT-6' })).toHaveAttribute('href', '/models/gpt-6');
    for (const name of [/Announcement/, /Documentation/]) {
      const l = screen.getByRole('link', { name });
      expect(l).toHaveAttribute('target', '_blank');
      expect(l).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('says so when there is no link, and flags unconfirmed and demo releases', () => {
    render(
      <ReleaseEntry
        item={release('b', {
          announcementUrl: null,
          docsUrl: null,
          model: null,
          confirmed: false,
          verificationStatus: 'UNVERIFIED',
          isDemo: true,
        })}
      />,
    );
    expect(screen.getByText('No announcement link on record.')).toBeInTheDocument();
    expect(screen.getByText('Unconfirmed')).toBeInTheDocument();
    expect(screen.getByText(/demo data/i)).toBeInTheDocument();
  });
});

describe('ReleaseTimeline and ReleaseList', () => {
  const items = [
    release('a', { date: '2026-09-29' }),
    release('b', { date: '2026-09-01' }),
    release('c', { date: '2026-08-31' }),
  ];

  it('groups entries under month headings and shows every entry without any animation', () => {
    render(<ReleaseTimeline items={items} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['September 2026', 'August 2026']);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    // Entries carry the hook the scroll effect looks for, and are not hidden by default.
    for (const li of document.querySelectorAll('[data-release-entry]')) {
      expect(li).toBeVisible();
    }
  });

  it('draws the progress line as a decorative element', () => {
    const { container } = render(<ReleaseTimeline items={items} />);
    const line = container.querySelector('[data-timeline-progress]');
    expect(line).toHaveAttribute('aria-hidden', 'true');
  });

  it('lists the same releases as a table with a row per release', () => {
    render(<ReleaseList items={items} />);
    const table = screen.getByRole('region', { name: 'Releases table' });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(3);
    for (const h of ['Date', 'Release', 'Kind', 'Links', 'Status']) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
  });
});

describe('ProviderCard', () => {
  it('links the name to the profile and keeps the external links separate', () => {
    render(
      <ul>
        <ProviderCard p={provider()} />
      </ul>,
    );
    expect(screen.getByRole('link', { name: 'OpenAI' })).toHaveAttribute(
      'href',
      '/providers/openai',
    );
    const site = screen.getByRole('link', { name: /Official website/ });
    expect(site).toHaveAttribute('rel', 'noopener noreferrer');
    const latest = screen.getByRole('link', { name: /GPT-6.1 released/ });
    expect(latest).toHaveAttribute('href', 'https://example.invalid/gpt61');
    // No anchor is nested inside another.
    expect(document.querySelectorAll('a a')).toHaveLength(0);
  });

  it('shows headquarters only when it is on record', () => {
    const { rerender } = render(
      <ul>
        <ProviderCard p={provider()} />
      </ul>,
    );
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.queryByText(/Paris/)).toBeNull();
    rerender(
      <ul>
        <ProviderCard p={provider({ headquarters: 'Paris, France' })} />
      </ul>,
    );
    expect(screen.getByText(/Paris, France/)).toBeInTheDocument();
  });

  it('says "None on record" without a latest release and omits a missing website', () => {
    render(
      <ul>
        <ProviderCard p={provider({ latestRelease: null, officialWebsite: null })} />
      </ul>,
    );
    expect(screen.getByText('None on record')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Official website/ })).toBeNull();
  });
});

describe('ReleaseTimelineChart', () => {
  const items = [
    release('a', { date: '2026-08-21', kind: 'DEPRECATION' }),
    release('b', { date: '2026-09-29', confirmed: false, verificationStatus: 'UNVERIFIED' }),
  ];

  it('makes every marker a keyboard-reachable link to its entry, with a text description', () => {
    render(<ReleaseTimelineChart releases={items} />);
    const a = screen.getByRole('link', { name: /Release a, 21 Aug 2026, Deprecation, confirmed/ });
    expect(a).toHaveAttribute('href', '#release-a');
    expect(screen.getByRole('link', { name: /Release b.*unconfirmed/ })).toHaveAttribute(
      'href',
      '#release-b',
    );
    expect(screen.getByRole('group', { name: /Timeline of 2 releases/ })).toBeInTheDocument();
  });

  it('explains the encoding in a legend (shape = kind, outline = unconfirmed)', () => {
    render(<ReleaseTimelineChart releases={items} />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Major release')).toBeInTheDocument();
    expect(within(legend).getByText('Outlined = unconfirmed')).toBeInTheDocument();
  });

  it('draws nothing without releases', () => {
    const { container } = render(<ReleaseTimelineChart releases={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Portfolio', () => {
  const models = [
    model('alpha', {
      name: 'Alpha',
      categories: ['llm'],
      availability: 'Cloud API',
      openWeights: false,
    }),
    model('beta', {
      name: 'Beta',
      categories: ['llm', 'coding'],
      availability: 'Open weights',
      openWeights: true,
    }),
  ];

  it('shows all models, and narrows by text, category, availability and open weights', () => {
    render(<Portfolio models={models} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 of 2 models');
    fireEvent.change(screen.getByLabelText('Search this portfolio'), { target: { value: 'beta' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 models');
    expect(screen.getByRole('link', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alpha' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByLabelText('Open weights only'));
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 models');
    fireEvent.click(screen.getByLabelText('Open weights only'));
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'coding' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 models');
  });

  it('says so when nothing matches', () => {
    render(<Portfolio models={models} />);
    fireEvent.change(screen.getByLabelText('Search this portfolio'), { target: { value: 'zzz' } });
    expect(screen.getByText('No models match these filters.')).toBeInTheDocument();
  });
});

describe('NewsCard', () => {
  const news: NewsItem = {
    id: 'n1',
    title: 'Introducing X',
    summary: 'A summary.',
    publisher: 'OpenAI',
    url: 'https://example.invalid/x',
    publishedAt: '2026-09-29T00:00:00Z',
    category: 'MODEL_RELEASES',
    isOfficial: true,
    isAiSummary: true,
    provider: { slug: 'openai', name: 'OpenAI' },
    models: [],
    verificationStatus: 'OFFICIALLY_VERIFIED',
    isDemo: false,
  };

  it('labels official vs independent and AI-written summaries, and links to the article', () => {
    render(<NewsCard item={news} />);
    expect(screen.getByText('Official')).toBeInTheDocument();
    expect(screen.getByText('AI summary')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read at OpenAI/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('does not repeat the publisher as the provider, and can hide the provider entirely', () => {
    const { rerender } = render(
      <NewsCard item={{ ...news, publisher: 'DataCamp', isOfficial: false }} />,
    );
    expect(screen.getByText('Independent')).toBeInTheDocument();
    expect(screen.getByText(/· OpenAI/)).toBeInTheDocument();
    rerender(
      <NewsCard
        item={{ ...news, publisher: 'DataCamp', isOfficial: false }}
        showProvider={false}
      />,
    );
    expect(screen.queryByText(/· OpenAI/)).toBeNull();
  });
});

describe('Pager', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pager page={1} pageCount={1} hrefFor={() => '/x'} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links neighbours with the caller's hrefs and marks the current page", () => {
    render(<Pager page={3} pageCount={8} hrefFor={(p) => `/r?page=${p}`} />);
    expect(screen.getByRole('link', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 4' })).toHaveAttribute('href', '/r?page=4');
    expect(screen.getByRole('link', { name: /Previous/ })).toHaveAttribute('href', '/r?page=2');
    expect(screen.getByRole('link', { name: /Next/ })).toHaveAttribute('href', '/r?page=4');
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(<Pager page={1} pageCount={3} hrefFor={(p) => `/r?page=${p}`} />);
    expect(screen.queryByRole('link', { name: /Previous/ })).toBeNull();
    rerender(<Pager page={3} pageCount={3} hrefFor={(p) => `/r?page=${p}`} />);
    expect(screen.queryByRole('link', { name: /Next/ })).toBeNull();
  });
});
