import { Reveal } from './reveal';

export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

/** Standard homepage section with eyebrow, heading and optional lead + action. */
export function Section({
  id,
  eyebrow,
  title,
  lead,
  action,
  children,
  demo,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  demo?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="py-16 sm:py-24">
      <Container>
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="t-eyebrow mb-3 flex items-center gap-3">
              {eyebrow}
              {demo}
            </p>
            <h2 id={`${id}-title`} className="t-h2">
              {title}
            </h2>
            {lead && <p className="t-lead mt-4">{lead}</p>}
          </div>
          {action}
        </Reveal>
        {children}
      </Container>
    </section>
  );
}
