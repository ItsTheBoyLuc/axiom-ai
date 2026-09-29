import { useId } from 'react';

/**
 * AXIOM mark: a geometric "A" built from two strokes. The crossbar is cut open in the
 * middle and an inset accent triangle sits in the counter (negative-space detail).
 * Uses currentColor for the strokes so it works on dark and light backgrounds.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-labelledby={id}
    >
      <title id={id}>AXIOM AI</title>
      {/* Left and right legs with a flat apex; stroke ends are square for a precise look */}
      <path
        d="M4 28 L14.2 5 H17.8 L28 28"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="miter"
      />
      {/* Cut crossbar: two short bars leaving a deliberate gap in the middle */}
      <path d="M8.6 21.5 H12.4" stroke="currentColor" strokeWidth="3" />
      <path d="M19.6 21.5 H23.4" stroke="currentColor" strokeWidth="3" />
      {/* Inset accent triangle in the counter */}
      <path d="M16 11.5 L18.6 17.5 H13.4 Z" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({
  variant = 'full',
  size = 28,
  className,
}: {
  variant?: 'mark' | 'full';
  size?: number;
  className?: string;
}) {
  if (variant === 'mark') return <LogoMark size={size} className={className} />;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} />
      <span
        className="text-fg font-medium tracking-[-0.04em]"
        style={{ fontSize: size * 0.62 }}
        aria-hidden
      >
        AXIOM&nbsp;AI
      </span>
    </span>
  );
}
