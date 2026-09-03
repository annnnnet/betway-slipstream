'use client';

import Link from 'next/link';
import { BadgeCheck, Repeat2, ScanLine, ShieldAlert, Ticket } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHistory, type HistoryEntry } from '@/hooks/use-slips';
import { formatOdds } from '@/lib/format';
import { ErrorState } from '@/components/states/ErrorState';
import { Spinner } from '@/components/states/Spinner';
import { ButtonLink } from '@/components/ui/button-link';

const KIND = {
  RESOLVE: { label: 'Decoded', icon: ScanLine },
  CREATE: { label: 'Created', icon: Ticket },
  CONVERT: { label: 'Converted', icon: Repeat2 },
} as const;

export function History() {
  const { user, loading } = useAuth();
  const { data, isPending, error } = useHistory(Boolean(user));

  if (loading) return <Spinner />;

  // Signing in is the *only* thing gated in this product, so the empty state
  // here explains what it buys rather than just demanding credentials.
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Ticket className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Keep your codes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Decoding, building and converting all work without an account. Sign in and every code
          you touch is kept here, with whether it verified against Betway.
        </p>
        <ButtonLink href="/login" className="mt-6">Sign in</ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Codes you have decoded, built or converted.</p>

      <div className="mt-6">
        {isPending ? <Spinner /> : null}
        {error ? <ErrorState error={error} /> : null}
        {data?.length === 0 ? (
          <div className="surface px-6 py-12 text-center text-sm text-muted-foreground">
            Nothing here yet — decode or build a slip and it will show up.
          </div>
        ) : null}

        <ul className="surface divide-y overflow-hidden">
          {data?.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Row({ entry }: { entry: HistoryEntry }) {
  const kind = KIND[entry.kind];
  const Icon = kind.icon;

  return (
    <li>
      <Link
        href={`/s/${entry.code}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-medium tracking-wider">{entry.code}</p>
          <p className="text-xs text-muted-foreground">
            {kind.label}
            {entry.sourceCode ? ` from ${entry.sourceCode}` : ''} ·{' '}
            {new Date(entry.createdAt).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="tabular text-sm font-semibold text-odds">
            {formatOdds(entry.combinedOdds)}
          </div>
          <div className="text-xs text-muted-foreground">
            {entry.selectionCount} leg{entry.selectionCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* Only ever shown for actions that actually ran a verification —
            a plain decode has nothing to verify, and a grey tick there
            would imply a check we never made. */}
        {entry.verified === null ? null : entry.verified ? (
          <BadgeCheck className="size-4 shrink-0 text-verified" aria-label="Verified" />
        ) : (
          <ShieldAlert className="size-4 shrink-0 text-failed" aria-label="Verification failed" />
        )}
      </Link>
    </li>
  );
}
