import {
  betwayUrlFor,
  combinedOdds,
  slipFingerprint,
  type CatalogueEvent,
  type CatalogueMarket,
  type Odds,
  type Selection,
  type Slip,
  type SlipEvent,
} from '@slipstream/shared';
import { AppError } from '../common/api-error';
import type { RawEmopBundle, RawEvent, RawFindBookABetResponse, RawSelection } from './betway.types';

/**
 * Betway -> our contract. This is the anti-corruption layer: everything past
 * this file works with `Selection`/`Slip` and never sees a Betway field name.
 *
 * The payloads are redundant on purpose — a price appears both as
 * `selection.priceDecimal` and `selection.price.priceDecimal`, an event name
 * both as `selection.eventName` and `selection.sportEvent.name`. Where both
 * exist the nested object is preferred: it is the object Betway's own client
 * subscribes to for live updates, while the flattened copy is a snapshot
 * taken when the slip was booked and can lag a re-scheduled fixture.
 */

function epochToIso(epochSeconds: number | null | undefined): string | null {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds) || epochSeconds <= 0) {
    return null;
  }
  return new Date(epochSeconds * 1000).toISOString();
}

function toOdds(sel: RawSelection): Odds {
  const decimal = sel.price?.priceDecimal ?? sel.priceDecimal;
  const numerator = sel.price?.numerator ?? sel.priceNumerator;
  const denominator = sel.price?.denominator ?? sel.priceDenominator;

  // A leg with no price is not renderable and not re-bookable, and silently
  // defaulting it to 1.00 would understate a slip's real return. Fail here so
  // the caller sees which leg is broken.
  if (typeof decimal !== 'number' || !Number.isFinite(decimal) || decimal <= 0) {
    throw new AppError(
      'UPSTREAM_UNAVAILABLE',
      `Betway returned a selection with no usable price (outcome ${sel.outcomeId ?? 'unknown'}).`,
      502,
    );
  }
  return {
    decimal,
    numerator: typeof numerator === 'number' ? numerator : Math.round((decimal - 1) * 100),
    denominator: typeof denominator === 'number' && denominator > 0 ? denominator : 100,
  };
}

function toEvent(sel: RawSelection): SlipEvent {
  const ev = sel.sportEvent ?? {};
  const id = ev.eventId ?? sel.eventId;
  if (typeof id !== 'number') {
    throw new AppError('UPSTREAM_UNAVAILABLE', 'Betway returned a selection with no event.', 502);
  }
  return {
    id,
    name: ev.displayName ?? ev.name ?? sel.eventName ?? 'Unknown event',
    homeTeam: ev.homeTeam ?? null,
    awayTeam: ev.awayTeam ?? null,
    startsAt: epochToIso(ev.expectedStartEpoch ?? sel.eventEpoch),
    sportId: ev.sportId ?? sel.sportId ?? 'unknown',
    league: ev.league ?? sel.league ?? null,
    region: ev.region ?? sel.region ?? null,
    isLive: ev.isLive === true,
    isFinished: ev.isFinished === true,
  };
}

export function toSelection(sel: RawSelection): Selection {
  const outcomeId = sel.outcomeId ?? sel.outcome?.outcomeId;
  if (!outcomeId) {
    // Without an outcome id the leg cannot be re-booked, which makes the whole
    // slip unconvertible. Better to fail the slip than to hand back a
    // "converted" code that quietly dropped a leg.
    throw new AppError('UPSTREAM_UNAVAILABLE', 'Betway returned a selection with no outcome id.', 502);
  }
  const handicap = sel.handicap ?? sel.marketHandicap ?? sel.market?.handicap ?? null;

  return {
    outcomeId: String(outcomeId),
    outcomeName: sel.outcome?.displayName ?? sel.outcome?.name ?? sel.outcomeName ?? 'Unknown selection',
    marketId: String(sel.marketId ?? sel.market?.marketId ?? ''),
    marketName: sel.market?.displayName ?? sel.marketName ?? sel.market?.name ?? 'Unknown market',
    handicap: typeof handicap === 'number' && handicap !== 0 ? handicap : null,
    odds: toOdds(sel),
    event: toEvent(sel),
    // Betway reports these three independently; a leg is only live when all
    // three are. Treating a missing flag as `true` matches how their own
    // betslip behaves — absence means "nothing wrong reported".
    isOutcomeActive: sel.isOutcomeActive !== false && sel.outcome?.isTradingActive !== false,
    isMarketActive: sel.isMarketActive !== false && sel.market?.isActive !== false,
    isEventActive: sel.isEventActive !== false && sel.sportEvent?.isActive !== false,
  };
}

export function toSlip(code: string, raw: RawFindBookABetResponse): Slip {
  const rawSelections = raw.selections ?? [];
  if (rawSelections.length === 0) {
    // Betway answers 200 with an empty array for a code that is structurally
    // valid but carries nothing — an expired promo slip, typically. That is a
    // different failure from "no such code" and deserves its own message.
    throw new AppError('SLIP_EMPTY', 'That code resolved, but the slip has no selections left on it.', 404);
  }
  const selections = rawSelections.map(toSelection);

  return {
    code,
    selections,
    isSingleBet: raw.isSingleBet === true,
    isBuildABet: raw.isBuildABet === true,
    combinedOdds: combinedOdds(selections),
    fingerprint: slipFingerprint(selections),
    betwayUrl: betwayUrlFor(code),
    resolvedAt: new Date().toISOString(),
  };
}

export function toCatalogueEvent(ev: RawEvent): CatalogueEvent {
  return {
    id: ev.eventId as number,
    name: ev.displayName ?? ev.name ?? 'Unknown event',
    homeTeam: ev.homeTeam ?? null,
    awayTeam: ev.awayTeam ?? null,
    startsAt: epochToIso(ev.expectedStartEpoch),
    sportId: ev.sportId ?? 'unknown',
    regionId: ev.regionId ?? null,
    leagueId: ev.leagueId ?? null,
    league: ev.league ?? null,
    isLive: ev.isLive === true,
  };
}

/**
 * Betway returns markets, outcomes and prices as three flat sibling arrays
 * joined by id rather than as a tree. Stitch them back together, and drop any
 * outcome with no price: an unpriced outcome cannot be put on a betslip, so
 * rendering it only produces a button that fails when clicked.
 */
export function toCatalogueMarkets(bundle: RawEmopBundle): CatalogueMarket[] {
  const priceByOutcome = new Map(
    (bundle.prices ?? []).filter((p) => p.outcomeId).map((p) => [String(p.outcomeId), p]),
  );

  return (bundle.markets ?? [])
    .filter((m) => m.marketId && m.shouldDisplay !== false)
    .map((m) => {
      const outcomes = (bundle.outcomes ?? [])
        .filter((o) => o.outcomeId && String(o.marketId) === String(m.marketId) && o.shouldDisplay !== false)
        .map((o) => {
          const price = priceByOutcome.get(String(o.outcomeId));
          const decimal = price?.priceDecimal;
          const odds =
            typeof decimal === 'number' && decimal > 0
              ? {
                  decimal,
                  numerator: price?.numerator ?? Math.round((decimal - 1) * 100),
                  denominator: price?.denominator ?? 100,
                }
              : null;
          return {
            outcomeId: String(o.outcomeId),
            name: o.displayName ?? o.name ?? 'Unknown',
            odds,
            isActive: o.isTradingActive !== false,
          };
        })
        .filter((o) => o.odds !== null);

      return {
        marketId: String(m.marketId),
        name: m.displayName ?? m.name ?? 'Unknown market',
        handicap: typeof m.handicap === 'number' && m.handicap !== 0 ? m.handicap : null,
        isActive: m.isActive !== false && m.isSuspended !== true,
        outcomes,
      };
    })
    .filter((m) => m.outcomes.length > 0);
}
