import { z } from 'zod';

/**
 * Betway quotes a price three ways in the same payload (fraction + decimal).
 * We keep all three: the fraction is what Betway treats as authoritative for
 * settlement, the decimal is what Nigerian punters read, and keeping both
 * means a mismatch between them is visible rather than silently rounded away.
 */
export const oddsSchema = z.object({
  decimal: z.number().positive(),
  numerator: z.number().int(),
  denominator: z.number().int().positive(),
});
export type Odds = z.infer<typeof oddsSchema>;

export const slipEventSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  homeTeam: z.string().nullable(),
  awayTeam: z.string().nullable(),
  /** ISO-8601. Betway sends a unix epoch in seconds; normalised on the way in. */
  startsAt: z.string().datetime().nullable(),
  sportId: z.string(),
  league: z.string().nullable(),
  region: z.string().nullable(),
  isLive: z.boolean(),
  isFinished: z.boolean(),
});
export type SlipEvent = z.infer<typeof slipEventSchema>;

export const selectionSchema = z.object({
  /** The only field Betway needs to re-mint a code. Everything else is display. */
  outcomeId: z.string(),
  outcomeName: z.string(),
  marketId: z.string(),
  marketName: z.string(),
  handicap: z.number().nullable(),
  odds: oddsSchema,
  event: slipEventSchema,
  /**
   * Betway reports activity separately per level. A selection is only
   * re-bookable when all three are true, so the UI needs the breakdown to
   * explain *why* a leg is dead rather than just greying it out.
   */
  isOutcomeActive: z.boolean(),
  isMarketActive: z.boolean(),
  isEventActive: z.boolean(),
});
export type Selection = z.infer<typeof selectionSchema>;

export const slipSchema = z.object({
  code: z.string(),
  selections: z.array(selectionSchema),
  isSingleBet: z.boolean(),
  isBuildABet: z.boolean(),
  /** Product of the decimal odds, 2dp. Meaningless for a singles slip. */
  combinedOdds: z.number(),
  /** Order-independent identity of the bet — see `slipFingerprint`. */
  fingerprint: z.string(),
  /** Deep link that loads this code in Betway's own betslip. */
  betwayUrl: z.string().url(),
  resolvedAt: z.string().datetime(),
});
export type Slip = z.infer<typeof slipSchema>;

/**
 * A bet's identity is the *set* of outcomes it contains — not the order they
 * were picked in, and not the code that happens to point at them.
 *
 * This matters because Betway's own encoder is order-sensitive: POSTing the
 * same five outcomes in a different order mints a different booking code,
 * while POSTing them in the same order returns the code that already exists.
 * So "did the conversion preserve the bet?" cannot be answered by comparing
 * code strings, and "is this a new code?" is not a useful question either.
 * Sorting before joining makes the comparison answer the question we actually
 * care about.
 */
export function slipFingerprint(selections: Pick<Selection, 'outcomeId'>[]): string {
  return [...new Set(selections.map((s) => s.outcomeId))].sort().join('|');
}

/** Product of decimal odds, rounded the way a betslip displays it. */
export function combinedOdds(selections: Pick<Selection, 'odds'>[]): number {
  if (selections.length === 0) return 0;
  const raw = selections.reduce((acc, s) => acc * s.odds.decimal, 1);
  return Math.round(raw * 100) / 100;
}

export function betwayUrlFor(code: string): string {
  return `https://www.betway.com.ng/?bookingCode=${encodeURIComponent(code)}`;
}
