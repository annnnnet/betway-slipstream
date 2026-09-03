'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, LogIn, LogOut, Ticket } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Decode' },
  { href: '/build', label: 'Build' },
  { href: '/history', label: 'History' },
];

export function TopBar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  async function signOut() {
    await supabase.auth.signOut();
    // History is keyed by the caller's identity, so leaving it cached would
    // show the next visitor on this browser the previous account's codes.
    qc.clear();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
      {/* Everything here is sized down at 390px. Laid out generously it
          overflows a phone by ~80px, and a header that scrolls sideways
          drags the whole page with it. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-6 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Ticket className="size-4" />
          </span>
          {/* The mark alone identifies the app once you are inside it. */}
          <span className="hidden sm:inline">Slipstream</span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          {LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 transition-colors sm:px-3',
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Rendering nothing until the session resolves avoids a "Sign in"
              button flashing for someone who is already signed in. */}
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-muted-foreground md:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <ButtonLink href="/login" variant="ghost" size="sm" aria-label="Sign in">
              <LogIn className="size-4" />
              <span className="hidden sm:inline">Sign in</span>
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}

/** Small shared header used above sections that list slips. */
export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        <Layers className="size-3.5" />
        {title}
      </h2>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
