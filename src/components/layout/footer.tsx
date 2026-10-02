import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Container } from '@/components/ui/section';
import { footerColumns } from '@/lib/routes';
import { getLastDataUpdate } from '../../../server/services/site';

/** Social links come from env and are hidden when unset. */
const socials = [
  { label: 'GitHub', href: process.env.NEXT_PUBLIC_SOCIAL_GITHUB },
  { label: 'X', href: process.env.NEXT_PUBLIC_SOCIAL_X },
].filter((s): s is { label: string; href: string } => Boolean(s.href));

export async function Footer() {
  const lastDataUpdate = await getLastDataUpdate();
  const updated = lastDataUpdate
    ? new Date(lastDataUpdate).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }) + ' UTC'
    : 'No data loaded yet';

  return (
    <footer className="border-line bg-bg-2 border-t" style={{ background: 'var(--bg-secondary)' }}>
      <Container className="py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo variant="full" size={28} />
            <p className="text-fg-2 mt-4 max-w-xs text-sm">The Intelligence Standard.</p>
            {socials.length > 0 && (
              <ul className="mt-5 flex gap-4 text-sm">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="text-fg-2 hover:text-fg"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {footerColumns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="t-eyebrow mb-4">{col.title}</h2>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-fg-2 hover:text-fg inline-block text-sm transition-[color,transform] duration-200 hover:translate-x-0.5"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-line text-muted mt-12 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} AXIOM AI. All rights reserved.</p>
          <p>
            Last data update: <span className="font-mono">{updated}</span>
          </p>
        </div>
      </Container>
    </footer>
  );
}
