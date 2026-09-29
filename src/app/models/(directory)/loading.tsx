import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/components/ui/section';

/** Route-level loading state for the directory (streams while the server renders). */
export default function Loading() {
  return (
    <Container className="py-10 sm:py-14">
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading models</span>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-10 w-64" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <Skeleton className="mt-8 h-12 w-full rounded-xl" />
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[264px_minmax(0,1fr)]">
          <Skeleton className="hidden h-[520px] rounded-2xl lg:block" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="border-line bg-card rounded-2xl border p-5">
                <div className="flex gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
