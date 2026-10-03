import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/components/ui/section';

/** Shown while the releases load. */
export default function ReleasesLoading() {
  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <div aria-busy="true" aria-label="Loading releases">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-6 h-12 w-80" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <Skeleton className="mt-8 h-44 w-full" />
        <div className="mt-8 space-y-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    </Container>
  );
}
