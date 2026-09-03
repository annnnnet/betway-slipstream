'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CatalogueEvent, CatalogueMarket } from '@slipstream/shared';
import { useBetslip } from '@/hooks/use-betslip';
import { useEventMarkets } from '@/hooks/use-slips';
import { formatKickoff, formatOdds } from '@/lib/format';
import { ErrorState } from '@/components/states/ErrorState';
import { Spinner } from '@/components/states/Spinner';
import { cn } from '@/lib/utils';

/** Betway returns 150+ markets per football match. Showing all of them by
 *  default turns the picker into a wall; the handful people actually bet
 *  lead, and the rest are one click away. */
const HEADLINE_MARKETS = 6;

export function EventMarkets({ event }: { event: CatalogueEvent }) {
  const { data, isPending, error } = useEventMarkets(event.id);
  const [showAll, setShowAll] = useState(false);

  if (isPending) return <Spinner label="Loading markets…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const markets = showAll ? data.markets : data.markets.slice(0, HEADLINE_MARKETS);
  const hidden = data.markets.length - markets.length;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{event.name}</h2>
        <p className="text-sm text-muted-foreground">
          {[event.league, formatKickoff(event.startsAt)].filter(Boolean).join(' · ')}
        </p>
      </div>

      {markets.map((market) => (
        <MarketRow key={market.marketId} event={event} market={market} />
      ))}

      {hidden > 0 ? (
        <button
          onClick={() => setShowAll(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          Show {hidden} more market{hidden === 1 ? '' : 's'}
          <ChevronDown className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function MarketRow({ event, market }: { event: CatalogueEvent; market: CatalogueMarket }) {
  const betslip = useBetslip();

  return (
    <section className="surface p-3">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{market.name}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {market.outcomes.map((outcome) => {
          const picked = betslip.has(outcome.outcomeId);
          const disabled = !outcome.isActive || !market.isActive;

          return (
            <button
              key={outcome.outcomeId}
              disabled={disabled}
              onClick={() => betslip.toggle(event, market, outcome)}
              aria-pressed={picked}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                disabled && 'cursor-not-allowed opacity-40',
                picked
                  ? 'border-primary bg-primary/15'
                  : 'hover:border-primary/40 hover:bg-secondary/60',
              )}
            >
              <span className="min-w-0 truncate">{outcome.name}</span>
              <span className={cn('tabular shrink-0 font-semibold', picked ? 'text-primary' : 'text-odds')}>
                {outcome.odds ? formatOdds(outcome.odds.decimal) : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
