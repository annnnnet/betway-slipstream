'use client';

import Link from 'next/link';
import { Loader2, Ticket, Trash2, X } from 'lucide-react';
import { useBetslip } from '@/hooks/use-betslip';
import { useCreateSlip } from '@/hooks/use-slips';
import { formatOdds, formatReturns } from '@/lib/format';
import { CodeBadge } from '@/components/slip/CodeBadge';
import { VerificationPanel } from '@/components/slip/VerificationPanel';
import { ErrorState } from '@/components/states/ErrorState';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';

export function BetslipPanel() {
  const betslip = useBetslip();
  const create = useCreateSlip();

  if (create.data) {
    return (
      <div className="space-y-4">
        <section className="surface p-4">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your booking code
          </p>
          <CodeBadge slip={create.data.slip} />
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={`/s/${create.data.slip.code}`} variant="secondary">
              Open full slip
            </ButtonLink>
            <Button
              variant="ghost"
              onClick={() => {
                create.reset();
                betslip.clear();
              }}
            >
              Build another
            </Button>
          </div>
        </section>

        <VerificationPanel verification={create.data.verification} />
      </div>
    );
  }

  if (betslip.picks.length === 0) {
    return (
      <div className="surface flex flex-col items-center gap-2 px-6 py-10 text-center">
        <Ticket className="size-7 text-muted-foreground" />
        <h3 className="font-medium">Your slip is empty</h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          Pick a league, then tap any price to add it. Everything here is priced live by Betway.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="surface overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="font-medium">
            {betslip.picks.length} selection{betslip.picks.length === 1 ? '' : 's'}
          </h3>
          <button
            onClick={betslip.clear}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-failed"
          >
            <Trash2 className="size-3.5" />
            Clear
          </button>
        </header>

        <ul className="divide-y">
          {betslip.picks.map((pick) => (
            <li key={pick.outcomeId} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pick.outcomeName}</p>
                <p className="truncate text-xs text-muted-foreground">{pick.marketName}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{pick.eventName}</p>
              </div>
              <span className="tabular shrink-0 font-semibold text-odds">
                {formatOdds(pick.odds.decimal)}
              </span>
              <button
                onClick={() => betslip.remove(pick.outcomeId)}
                aria-label={`Remove ${pick.outcomeName}`}
                className="shrink-0 text-muted-foreground hover:text-failed"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <footer className="space-y-3 border-t px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total odds</span>
            <span className="tabular text-2xl font-semibold text-odds">
              {formatOdds(betslip.total)}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">₦1,000 returns</span>
            <span className="tabular">{formatReturns(1000, betslip.total)}</span>
          </div>

          <Button
            className="w-full"
            disabled={create.isPending}
            onClick={() =>
              create.mutate({
                outcomeIds: betslip.picks.map((p) => p.outcomeId),
                isSingleBet: false,
              })
            }
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}
            {create.isPending ? 'Booking with Betway…' : 'Generate booking code'}
          </Button>
        </footer>
      </section>

      {create.error ? <ErrorState error={create.error} /> : null}
    </div>
  );
}
