import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/components/ui/section';

/** Shown while the stories load. */
export default function NewsLoading() {
  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <div aria-busy="true" aria-label="Loading news">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-6 h-12 w-96 max-w-full" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <Skeleton className="mt-8 h-10 w-56" />
        <Skeleton className="mt-6 h-28 w-full" />
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      </div>
    </Container>
  );
}
