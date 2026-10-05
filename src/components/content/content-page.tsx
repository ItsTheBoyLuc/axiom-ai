import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/section';

/**
 * Shell for the long-form pages (About, Methodology, Sources, Contact and the legal pages):
 * breadcrumbs, heading and a readable column. Content goes in as children, sectioned with
 * `ContentSection` so every page has one h1 and a clean h2 outline.
 */
export function ContentPage({
  title,
  eyebrow,
  lead,
  path,
  updated,
  children,
}: {
  title: string;
  eyebrow: string;
  lead: string;
  /** Route, for the breadcrumb (e.g. "/about"). */
  path: string;
  /** ISO date shown as "Last updated" (legal pages). */
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="pt-10 pb-20 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: title, href: path },
        ]}
      />
      <header className="mb-10 max-w-3xl">
        <p className="t-eyebrow mb-3">{eyebrow}</p>
        <h1 className="t-h2">{title}</h1>
        <p className="t-lead mt-4">{lead}</p>
        {updated && (
          <p className="text-muted mt-4 font-mono text-xs">
            Last updated{' '}
            <time dateTime={updated}>
              {new Date(`${updated}T00:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </time>
          </p>
        )}
      </header>
      <div className="max-w-3xl space-y-12">{children}</div>
    </Container>
  );
}

export function ContentSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <h2 id={id} className="t-h3 mb-4">
        {title}
      </h2>
      <div className="text-fg-2 [&_a]:text-accent [&_strong]:text-fg space-y-4 leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
