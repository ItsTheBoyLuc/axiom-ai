import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/components/ui/section';

/** Shown while the benchmark index or a benchmark's results load. */
export default function BenchmarksLoading() {
  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <div aria-busy="true" aria-label="Loading benchmarks">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-6 h-12 w-72" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    </Container>
  );
}
