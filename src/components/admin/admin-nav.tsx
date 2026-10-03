'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string };

/** Admin section navigation. A horizontal scroll strip on phones, a vertical list from lg. */
export function AdminNav({ groups }: { groups: { title: string; items: NavItem[] }[] }) {
  const pathname = usePathname();
  const current = (href: string) =>
    href === '/admin'
      ? pathname === '/admin'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Admin">
      <div className="flex gap-6 overflow-x-auto pb-2 lg:block lg:space-y-6 lg:overflow-visible lg:pb-0">
        {groups.map((g) => (
          <div key={g.title} className="shrink-0">
            <p className="t-eyebrow mb-1.5 hidden lg:block">{g.title}</p>
            <ul className="flex gap-1 lg:flex-col">
              {g.items.map((item) => {
                const on = current(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={on ? 'page' : undefined}
                      className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm whitespace-nowrap transition-colors lg:flex ${on ? 'bg-accent/10 text-fg' : 'text-fg-2 hover:text-fg hover:bg-elevated'}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
