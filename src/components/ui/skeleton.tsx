/** Loading placeholder. Decorative: hidden from assistive tech, parent should set aria-busy. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-lg ${className}`} />;
}
