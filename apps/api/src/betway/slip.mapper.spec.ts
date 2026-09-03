import { AppError } from '../common/api-error';
import { toCatalogueMarkets, toSelection, toSlip } from './slip.mapper';
import type { RawEmopBundle, RawFindBookABetResponse, RawSelection } from './betway.types';

// Recorded from the real endpoint (`POST /Betting/FindBookABet`, code
// BW6E15DE93) so the suite exercises Betway's actual field layout without
// depending on Betway being up, or on those fixtures still being live.
const recorded = require('./__fixtures__/find-book-a-bet.BW6E15DE93.json') as RawFindBookABetResponse;
const recordedEmop = require('./__fixtures__/emop.72221244.json') as RawEmopBundle[];

/** A minimal well-formed leg, for the cases the recording does not cover. */
function leg(overrides: Partial<RawSelection> = {}): RawSelection {
  return {
    outcomeId: '123',
    outcomeName: 'Home',
    marketId: '456',
    marketName: '1X2',
    priceDecimal: 2,
    priceNumerator: 1,
    priceDenominator: 1,
    eventId: 789,
    eventName: 'A vs. B',
    ...overrides,
  };
}

describe('toSlip', () => {
  it('maps a recorded Betway slip into the shared contract', () => {
    const slip = toSlip('BW6E15DE93', recorded);

    expect(slip.code).toBe('BW6E15DE93');
    expect(slip.selections).toHaveLength(5);
    expect(slip.betwayUrl).toBe('https://www.betway.com.ng/?bookingCode=BW6E15DE93');
    expect(slip.selections.map((s) => s.outcomeId)).toEqual([
      '6330296311',
      '6330293911',
      '6330385511',
      '6330294913',
      '6330240711',
    ]);
  });

  it('reads names, market and odds off the first leg', () => {
    const [first] = toSlip('BW6E15DE93', recorded).selections;

    expect(first.event.name).toBe('Minnesota Twins vs. Detroit Tigers');
    expect(first.event.homeTeam).toBe('Minnesota Twins');
    expect(first.event.league).toBe('MLB');
    expect(first.marketName).toBe('1X2');
    expect(first.outcomeName).toBe('Minnesota Twins');
    expect(first.odds.decimal).toBe(1.97);
    expect(first.odds.numerator).toBe(97);
    expect(first.odds.denominator).toBe(100);
  });

  it('converts the epoch kickoff into an ISO timestamp', () => {
    const [first] = toSlip('BW6E15DE93', recorded).selections;
    // expectedStartEpoch 1788392400 (seconds)
    expect(first.event.startsAt).toBe(new Date(1788392400 * 1000).toISOString());
  });

  it('computes combined odds as the product of the legs', () => {
    // 1.97 * 2.48 * 1.83 * 1.73 * 1.46
    expect(toSlip('BW6E15DE93', recorded).combinedOdds).toBe(22.58);
  });

  it('rejects an empty slip with SLIP_EMPTY rather than a bare 200', () => {
    // Betway answers 200 with `selections: []` for a structurally valid code
    // that no longer carries anything.
    expect(() => toSlip('BW00000000', { selections: [] })).toThrow(
      expect.objectContaining({ code: 'SLIP_EMPTY' }) as unknown as AppError,
    );
  });
});

describe('toSelection', () => {
  it('prefers the nested price object over the flattened copy', () => {
    // The flattened fields are a snapshot taken at booking time; the nested
    // object is what Betway keeps current.
    const s = toSelection(leg({ priceDecimal: 1.5, price: { priceDecimal: 2.75, numerator: 7, denominator: 4 } }));
    expect(s.odds).toEqual({ decimal: 2.75, numerator: 7, denominator: 4 });
  });

  it('falls back to the flattened price when there is no nested one', () => {
    expect(toSelection(leg({ price: null })).odds.decimal).toBe(2);
  });

  it('derives a fraction when Betway sends only a decimal', () => {
    const s = toSelection(leg({ priceNumerator: undefined, priceDenominator: undefined, priceDecimal: 2.5 }));
    expect(s.odds).toEqual({ decimal: 2.5, numerator: 150, denominator: 100 });
  });

  it('treats a missing activity flag as active, and false as inactive', () => {
    expect(toSelection(leg()).isMarketActive).toBe(true);
    expect(toSelection(leg({ isMarketActive: false })).isMarketActive).toBe(false);
  });

  it('normalises a zero handicap to null so the UI does not print "+0"', () => {
    expect(toSelection(leg({ handicap: 0 })).handicap).toBeNull();
    expect(toSelection(leg({ handicap: -1.5 })).handicap).toBe(-1.5);
  });

  it('refuses a leg with no outcome id instead of dropping it', () => {
    // Dropping it would produce a "converted" code missing a leg, which is
    // the one failure this product must never ship silently.
    expect(() => toSelection(leg({ outcomeId: undefined, outcome: null }))).toThrow(
      expect.objectContaining({ code: 'UPSTREAM_UNAVAILABLE' }) as unknown as AppError,
    );
  });

  it('refuses a leg with an unusable price rather than defaulting it to evens', () => {
    expect(() => toSelection(leg({ priceDecimal: 0, price: null }))).toThrow(
      expect.objectContaining({ code: 'UPSTREAM_UNAVAILABLE' }) as unknown as AppError,
    );
  });
});

describe('toCatalogueMarkets', () => {
  it('stitches the flat market/outcome/price arrays back into a tree', () => {
    const markets = toCatalogueMarkets(recordedEmop[0]);

    expect(markets.length).toBeGreaterThan(0);
    for (const m of markets) {
      expect(m.outcomes.length).toBeGreaterThan(0);
      for (const o of m.outcomes) {
        expect(o.odds!.decimal).toBeGreaterThan(0);
      }
    }
  });

  it('drops outcomes with no price, and markets left with none', () => {
    const bundle: RawEmopBundle = {
      markets: [
        { marketId: 'm1', displayName: 'Priced' },
        { marketId: 'm2', displayName: 'Unpriced' },
      ],
      outcomes: [
        { outcomeId: 'o1', marketId: 'm1', displayName: 'Yes' },
        { outcomeId: 'o2', marketId: 'm2', displayName: 'No' },
      ],
      prices: [{ outcomeId: 'o1', priceDecimal: 1.8, numerator: 4, denominator: 5 }],
    };

    const markets = toCatalogueMarkets(bundle);
    expect(markets.map((m) => m.marketId)).toEqual(['m1']);
    expect(markets[0].outcomes.map((o) => o.outcomeId)).toEqual(['o1']);
  });
});
