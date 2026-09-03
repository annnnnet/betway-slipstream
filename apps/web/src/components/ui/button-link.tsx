import Link from 'next/link';
import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from './button';
import { cn } from '@/lib/utils';

type Variants = VariantProps<typeof buttonVariants>;

/**
 * A link that looks like a button.
 *
 * Base UI's Button takes a `render` prop rather than shadcn's `asChild`, and
 * threading a Next `Link` through it fights the types for no benefit. Applying
 * the variants directly to the anchor is smaller, keeps `next/link`
 * prefetching intact, and — the part that actually matters — leaves a
 * navigation rendered as a real `<a>` rather than a button that moves the
 * page, so middle-click and "open in new tab" keep working.
 */
export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & Variants) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** The same, for outbound links that must not be client-side navigations. */
export function ButtonAnchor({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'a'> & Variants) {
  return <a className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
