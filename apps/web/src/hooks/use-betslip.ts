'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createElement } from 'react';
import type { CatalogueEvent, CatalogueMarket, CatalogueOutcome } from '@slipstream/shared';
import { combinedOdds } from '@slipstream/shared';

export interface Pick {
  outcomeId: string;
  outcomeName: string;
  marketName: string;
  eventId: number;
  eventName: string;
  startsAt: string | null;
  odds: { decimal: number; numerator: number; denominator: number };
}

interface BetslipState {
  picks: Pick[];
  has: (outcomeId: string) => boolean;
  toggle: (event: CatalogueEvent, market: CatalogueMarket, outcome: CatalogueOutcome) => void;
  remove: (outcomeId: string) => void;
  clear: () => void;
  total: number;
}

const BetslipContext = createContext<BetslipState | null>(null);

/**
 * The builder's working set, before it becomes a booking code.
 *
 * Deliberately in memory only. A betslip is built and encoded in one sitting,
 * and persisting it would mean restoring prices that have since moved — a
 * booking code minted from a stale pick is exactly the failure this product
 * exists to prevent. The code itself is the durable artefact; the draft is not.
 */
export function BetslipProvider({ children }: { children: ReactNode }) {
  const [picks, setPicks] = useState<Pick[]>([]);

  const toggle = useCallback(
    (event: CatalogueEvent, market: CatalogueMarket, outcome: CatalogueOutcome) => {
      // Narrow once, outside the updater: `outcome.odds` is optional and the
      // closure below cannot carry the guard through.
      const odds = outcome.odds;
      if (!odds) return;
      setPicks((current) => {
        if (current.some((p) => p.outcomeId === outcome.outcomeId)) {
          return current.filter((p) => p.outcomeId !== outcome.outcomeId);
        }
        // One pick per market: a slip holding both "Over 2.5" and "Under 2.5"
        // cannot win, and Betway would reject or silently collapse it. Replace
        // rather than refuse, which is what a tap on the other side means.
        const withoutSameMarket = current.filter(
          (p) => !(p.eventId === event.id && p.marketName === market.name),
        );
        return [
          ...withoutSameMarket,
          {
            outcomeId: outcome.outcomeId,
            outcomeName: outcome.name,
            marketName: market.name,
            eventId: event.id,
            eventName: event.name,
            startsAt: event.startsAt,
            odds,
          },
        ];
      });
    },
    [],
  );

  const value = useMemo<BetslipState>(
    () => ({
      picks,
      has: (outcomeId) => picks.some((p) => p.outcomeId === outcomeId),
      toggle,
      remove: (outcomeId) => setPicks((c) => c.filter((p) => p.outcomeId !== outcomeId)),
      clear: () => setPicks([]),
      total: combinedOdds(picks),
    }),
    [picks, toggle],
  );

  return createElement(BetslipContext.Provider, { value }, children);
}

export function useBetslip(): BetslipState {
  const ctx = useContext(BetslipContext);
  if (!ctx) throw new Error('useBetslip must be used inside a BetslipProvider');
  return ctx;
}
