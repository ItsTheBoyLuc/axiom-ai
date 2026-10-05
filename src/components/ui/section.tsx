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
  state,
  pin = true,
  eyebrow,
  title,
  lead,
  action,
  children,
  demo,
}: {
  id: string;
  /** Name of the section's background formation (the cinematic engine, see components/cinematic). */
  state?: string;
  /** Pin the header for a few hundred pixels while its text builds (desktop, full motion). */
  pin?: boolean;
  eyebrow: string;
  title: string;
  lead?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  demo?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="py-16 sm:py-24"
      data-cine-state={state ?? id}
      data-cine-pin={pin ? '' : undefined}
    >
      <Container>
        {/* All text is in the server HTML and visible; the cinematic engine builds it on scroll. */}
        <div data-cine-head className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p data-cine-eyebrow className="t-eyebrow mb-3 flex items-center gap-3">
              {eyebrow}
              {demo}
            </p>
            <h2 id={`${id}-title`} data-cine-title className="t-h2">
              {title}
            </h2>
            {lead && (
              <p data-cine-lead className="t-lead mt-4">
                {lead}
              </p>
            )}
          </div>
          {action && <div data-cine-action>{action}</div>}
        </div>
        {children}
      </Container>
    </section>
  );
}
