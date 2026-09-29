/**
 * Serialises a JSON-LD object for a <script type="application/ld+json"> tag. `<` is escaped so
 * data containing "</script>" can never break out of the tag (XSS-safe).
 */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function breadcrumbJsonLd(items: { name: string; href: string }[], origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${origin}${it.href}`,
    })),
  };
}
