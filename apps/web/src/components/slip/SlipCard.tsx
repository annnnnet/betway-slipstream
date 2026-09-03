'use client';

import type { ReactNode } from 'react';
import type { Slip } from '@slipstream/shared';
import { formatOdds, formatReturns } from '@/lib/format';
import { CodeBadge } from './CodeBadge';
import { SelectionRow } from './SelectionRow';

/** What ₦1,000 returns — a concrete number reads faster than a multiplier. */
const SAMPLE_STAKE = 1000;

export function SlipCard({
  slip,
  label,
  actions,
}: {
  slip: Slip;
  label?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="surface overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-5">
        {label ? (
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
        ) : null}

        <CodeBadge slip={slip} />

        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <Stat
            label={slip.isSingleBet ? 'Singles' : 'Accumulator'}
            value={`${slip.selections.length} ${slip.selections.length === 1 ? 'leg' : 'legs'}`}
          />
          {/* Combined odds are the product of the legs and mean nothing on a
              singles slip, where each leg settles on its own. Showing the
              product there would invent a price the bet never had. */}
          {slip.isSingleBet ? null : (
            <>
              <Stat
                label="Total odds"
                value={formatOdds(slip.combinedOdds)}
                className="text-odds"
                emphasis
              />
              <Stat label="₦1,000 returns" value={formatReturns(SAMPLE_STAKE, slip.combinedOdds)} />
            </>
          )}
        </div>

        {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      </header>

      <ul className="divide-y">
        {slip.selections.map((selection, i) => (
          <SelectionRow key={selection.outcomeId} selection={selection} index={i} />
        ))}
      </ul>
    </section>
  );
}

function Stat({
  label,
  value,
  className,
  emphasis,
}: {
  label: string;
  value: string;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`tabular font-semibold ${emphasis ? 'text-2xl' : 'text-base'} ${className ?? ''}`}
      >
        {value}
      </div>
    </div>
  );
}
