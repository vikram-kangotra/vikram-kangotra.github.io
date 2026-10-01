import Link from 'next/link';
import { SEO, Eyebrow, Arrow } from '@/components/ui';
export default function NotFound() {
  return (
    <div className="shell not-found">
      <SEO title="Page not found: Vikram Kangotra" />
      <Eyebrow>404 / A SMALL DETOUR</Eyebrow>
      <h1>
        Nothing here.
        <br />
        Plenty to explore.
      </h1>
      <p>This page may have moved, or the address may be incomplete.</p>
      <Link href="/" className="button button-primary">
        Back to home <Arrow />
      </Link>
    </div>
  );
}
