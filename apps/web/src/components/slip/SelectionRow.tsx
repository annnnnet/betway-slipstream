'use client';

import { AlertTriangle, Radio } from 'lucide-react';
import type { Selection } from '@slipstream/shared';
import { formatFraction, formatHandicap, formatKickoff, formatOdds } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One leg of a slip.
 *
 * The information hierarchy is deliberate and matches how a betslip is
 * actually read: what you picked, then which market it came from, then which
 * match, then when. The price sits on the right in the one warm colour on the
 * page, because it is the number the eye goes to first and the one people
 * compare down the column.
 */
export function SelectionRow({ selection, index }: { selection: Selection; index: number }) {
  const dead = !selection.isOutcomeActive || !selection.isMarketActive || !selection.isEventActive;
  const handicap = formatHandicap(selection.handicap);

  return (
    <li
      className={cn(
        'flex items-start gap-4 px-4 py-3.5 transition-colors',
        dead ? 'opacity-60' : 'hover:bg-secondary/40',
      )}
    >
      <span className="tabular mt-0.5 w-5 shrink-0 text-sm text-muted-foreground">{index + 1}</span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{selection.outcomeName}</span>
          {handicap ? (
            <span className="tabular rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
              {handicap}
            </span>
          ) : null}
          {selection.event.isLive ? (
            <span className="flex items-center gap-1 rounded bg-live/15 px-1.5 py-0.5 text-xs font-medium text-live">
              <Radio className="size-3" />
              Live
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 truncate text-sm text-muted-foreground">{selection.marketName}</p>

        <p className="mt-1.5 truncate text-sm">{selection.event.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[selection.event.league, formatKickoff(selection.event.startsAt)]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {dead ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-failed">
            <AlertTriangle className="size-3.5 shrink-0" />
            {/* Say which level died — "unavailable" alone leaves the user
                guessing whether it is their pick, the market or the match. */}
            {!selection.isEventActive
              ? 'This match is no longer open for betting'
              : !selection.isMarketActive
                ? 'This market has been suspended'
                : 'This selection is no longer offered'}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <div className="tabular text-lg font-semibold text-odds">{formatOdds(selection.odds.decimal)}</div>
        <div className="tabular text-xs text-muted-foreground">
          {formatFraction(selection.odds.numerator, selection.odds.denominator)}
        </div>
      </div>
    </li>
  );
}
