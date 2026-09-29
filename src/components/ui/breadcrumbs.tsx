import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { breadcrumbJsonLd, jsonLd } from '@/lib/json-ld';

export type Crumb = { name: string; href: string };

/** Breadcrumb trail for nested pages, with matching BreadcrumbList JSON-LD. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="text-fg-2 flex flex-wrap items-center gap-1.5 text-sm">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={c.href} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-fg">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="hover:text-fg rounded hover:underline">
                    {c.name}
                  </Link>
                )}
                {!last && <ChevronRight size={14} aria-hidden className="text-muted" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd(items, origin)) }}
      />
    </>
  );
}
