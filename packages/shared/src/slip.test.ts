import { describe, expect, it } from 'vitest';
import { betwayUrlFor, combinedOdds, slipFingerprint } from './slip';

const sel = (outcomeId: string) => ({ outcomeId });
const odds = (decimal: number) => ({ odds: { decimal, numerator: 1, denominator: 1 } });

describe('slipFingerprint', () => {
  it('is independent of the order the legs were picked in', () => {
    // Betway's own encoder is order-sensitive — the same outcomes in a
    // different order mint a different booking code. Our identity must not
    // inherit that, or every reordered conversion reads as a changed bet.
    expect(slipFingerprint([sel('a'), sel('b'), sel('c')])).toBe(
      slipFingerprint([sel('c'), sel('a'), sel('b')]),
    );
  });

  it('collapses a duplicated leg', () => {
    expect(slipFingerprint([sel('a'), sel('a'), sel('b')])).toBe(slipFingerprint([sel('a'), sel('b')]));
  });

  it('separates slips that differ by a single leg', () => {
    expect(slipFingerprint([sel('a'), sel('b')])).not.toBe(slipFingerprint([sel('a'), sel('c')]));
  });

  it('is empty for an empty slip rather than throwing', () => {
    expect(slipFingerprint([])).toBe('');
  });
});

describe('combinedOdds', () => {
  it('multiplies the legs and rounds the way a betslip shows it', () => {
    // 1.97 * 2.48 * 1.83 = 8.9407... -> 8.94
    expect(combinedOdds([odds(1.97), odds(2.48), odds(1.83)])).toBe(8.94);
  });

  it('returns the single price for a one-leg slip', () => {
    expect(combinedOdds([odds(1.97)])).toBe(1.97);
  });

  it('returns 0 for an empty slip instead of the multiplicative identity', () => {
    // 1 would render as "odds 1.00", which reads like a real (awful) price.
    expect(combinedOdds([])).toBe(0);
  });
});

describe('betwayUrlFor', () => {
  it('builds the deep link that opens the code in Betway own betslip', () => {
    expect(betwayUrlFor('BW6E423A7B')).toBe('https://www.betway.com.ng/?bookingCode=BW6E423A7B');
  });
});
