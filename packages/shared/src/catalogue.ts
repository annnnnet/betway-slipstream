import { z } from 'zod';
import { oddsSchema } from './slip';

/** Sports we surface in the builder. Betway carries many more, but each one
 *  needs its market layout checked by hand, so the list is explicit rather
 *  than scraped — an unchecked sport renders worse than a missing one. */
export const sportSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Sport = z.infer<typeof sportSchema>;

export const leagueSchema = z.object({
  leagueId: z.string(),
  name: z.string(),
  sportId: z.string(),
});
export type League = z.infer<typeof leagueSchema>;

export const regionSchema = z.object({
  regionId: z.string(),
  name: z.string(),
  sportId: z.string(),
  leagues: z.array(leagueSchema),
});
export type Region = z.infer<typeof regionSchema>;

export const catalogueEventSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  homeTeam: z.string().nullable(),
  awayTeam: z.string().nullable(),
  startsAt: z.string().datetime().nullable(),
  sportId: z.string(),
  regionId: z.string().nullable(),
  leagueId: z.string().nullable(),
  league: z.string().nullable(),
  isLive: z.boolean(),
});
export type CatalogueEvent = z.infer<typeof catalogueEventSchema>;

export const catalogueOutcomeSchema = z.object({
  outcomeId: z.string(),
  name: z.string(),
  odds: oddsSchema.nullable(),
  isActive: z.boolean(),
});
export type CatalogueOutcome = z.infer<typeof catalogueOutcomeSchema>;

export const catalogueMarketSchema = z.object({
  marketId: z.string(),
  name: z.string(),
  handicap: z.number().nullable(),
  isActive: z.boolean(),
  outcomes: z.array(catalogueOutcomeSchema),
});
export type CatalogueMarket = z.infer<typeof catalogueMarketSchema>;

export const eventMarketsResponseSchema = z.object({
  event: catalogueEventSchema,
  markets: z.array(catalogueMarketSchema),
});
export type EventMarketsResponse = z.infer<typeof eventMarketsResponseSchema>;
