import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/components/ui/section';

/** Shown while the compared models load (the table and charts stream in after). */
export default function CompareLoading() {
  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <div aria-busy="true" aria-label="Loading comparison">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-6 h-12 w-72" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <Skeleton className="mt-8 h-36 w-full" />
        <Skeleton className="mt-8 h-96 w-full" />
      </div>
    </Container>
  );
}
