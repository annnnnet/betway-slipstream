'use client';

import { ArrowRight, BadgeCheck, ExternalLink, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import type { Verification } from '@slipstream/shared';
import { formatOdds } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The evidence behind a generated code.
 *
 * This is shown rather than summarised on purpose. "Verified ✓" from the same
 * service that produced the code is worth nothing; what makes the claim
 * checkable is that we loaded the code back off Betway, and that the reader
 * can follow the same link and see the same slip. So the panel states what was
 * compared, shows the fingerprints, and links straight to Betway's own page.
 */
export function VerificationPanel({ verification }: { verification: Verification }) {
  const { matches, missing, extra, oddsDrift } = verification;

  return (
    <section
      className={cn(
        'surface overflow-hidden',
        matches ? 'border-primary/30' : 'border-failed/40',
      )}
    >
      <header
        className={cn(
          'flex flex-wrap items-center gap-3 border-b px-4 py-3.5',
          matches ? 'bg-primary/10' : 'bg-failed/10',
        )}
      >
        {matches ? (
          <BadgeCheck className="size-5 shrink-0 text-verified" />
        ) : (
          <ShieldAlert className="size-5 shrink-0 text-failed" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            {matches ? 'Verified against Betway' : 'Verification failed'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {matches
              ? `We loaded ${verification.code} back from Betway and it carries exactly the ${verification.resolved.length} selection${verification.resolved.length === 1 ? '' : 's'} we asked for.`
              : 'The slip Betway returns for this code is not the bet we submitted.'}
          </p>
        </div>
        <a
          href={verification.betwayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Check it yourself
          <ExternalLink className="size-3.5" />
        </a>
      </header>

      <div className="space-y-4 px-4 py-4">
        <Fingerprints verification={verification} />

        {missing.length > 0 ? (
          <Problem
            title={`${missing.length} selection${missing.length === 1 ? '' : 's'} missing from the code`}
            ids={missing}
          />
        ) : null}

        {extra.length > 0 ? (
          <Problem
            title={`${extra.length} selection${extra.length === 1 ? '' : 's'} on the code we never asked for`}
            ids={extra}
          />
        ) : null}

        {oddsDrift.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium">Prices moved while we worked</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The legs are identical, so this is still the same bet — Betway simply
              re-priced these markets between the two calls.
            </p>
            <ul className="mt-2 space-y-1.5">
              {oddsDrift.map((drift) => {
                const up = drift.actual > drift.expected;
                return (
                  <li key={drift.outcomeId} className="flex items-center gap-2 text-sm">
                    {up ? (
                      <TrendingUp className="size-4 shrink-0 text-verified" />
                    ) : (
                      <TrendingDown className="size-4 shrink-0 text-failed" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{drift.outcomeName}</span>
                    <span className="tabular flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      {formatOdds(drift.expected)}
                      <ArrowRight className="size-3" />
                      <span className="font-medium text-odds">{formatOdds(drift.actual)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The two fingerprints, shown side by side.
 *
 * A booking code cannot be compared to another booking code — Betway's encoder
 * is order-sensitive, so the same bet legitimately has more than one code. The
 * fingerprint is the sorted set of outcome ids, which is what actually has to
 * match, so it is the thing worth putting on screen.
 */
function Fingerprints({ verification }: { verification: Verification }) {
  const same = verification.expectedFingerprint === verification.actualFingerprint;

  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">Bet fingerprint</h4>
        <span className={cn('text-xs font-medium', same ? 'text-verified' : 'text-failed')}>
          {same ? 'identical' : 'different'}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The sorted set of outcome ids — order-independent, so it identifies the bet
        rather than the code.
      </p>
      <dl className="mt-2 space-y-1.5 text-xs">
        <Row term="asked for" value={verification.expectedFingerprint} />
        <Row term="Betway returned" value={verification.actualFingerprint} muted={same} />
      </dl>
    </div>
  );
}

function Row({ term, value, muted }: { term: string; value: string; muted?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{term}</dt>
      <dd
        className={cn(
          'min-w-0 flex-1 truncate font-mono',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
        title={value}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

function Problem({ title, ids }: { title: string; ids: string[] }) {
  return (
    <div className="rounded-lg border border-failed/30 bg-failed/5 p-3">
      <h4 className="text-sm font-medium text-failed">{title}</h4>
      <ul className="mt-1.5 space-y-0.5 font-mono text-xs text-muted-foreground">
        {ids.map((id) => (
          <li key={id} className="truncate">
            {id}
          </li>
        ))}
      </ul>
    </div>
  );
}
