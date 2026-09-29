import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/section';

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-start justify-center py-24">
      <p className="t-eyebrow mb-4">404</p>
      <h1 className="t-h2">Page not found</h1>
      <p className="t-lead mt-4 max-w-xl">
        The page you are looking for does not exist or has moved.
      </p>
      <div className="mt-8">
        <ButtonLink href="/" arrow>
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}
