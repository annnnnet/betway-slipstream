/**
 * Shapes Betway Nigeria actually returns, transcribed from live responses.
 *
 * These are deliberately *loose* — every field is optional or nullable except
 * the handful we cannot render without. Betway ships new fields into these
 * payloads regularly (their bundle still carries an `IsNewBookingCodeEnabled`
 * flag), and a strict interface here would turn an additive upstream change
 * into a 500. Validation happens at our own boundary instead, in the mapper.
 */

export interface RawPrice {
  outcomeId?: string;
  numerator?: number;
  denominator?: number;
  priceDecimal?: number;
}

export interface RawOutcome {
  outcomeId?: string;
  name?: string;
  displayName?: string;
  marketId?: string;
  eventId?: number;
  handicap?: number;
  isTradingActive?: boolean;
  shouldDisplay?: boolean;
}

export interface RawMarket {
  marketId?: string;
  name?: string;
  displayName?: string;
  eventId?: number;
  handicap?: number;
  isActive?: boolean;
  isSuspended?: boolean;
  shouldDisplay?: boolean;
}

export interface RawEvent {
  eventId?: number;
  name?: string;
  displayName?: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  /** Unix seconds. */
  expectedStartEpoch?: number | null;
  sportId?: string;
  regionId?: string | null;
  region?: string | null;
  leagueId?: string | null;
  league?: string | null;
  isLive?: boolean;
  isActive?: boolean;
  isFinished?: boolean;
}

/** One leg of a slip as `POST /Betting/FindBookABet` returns it. */
export interface RawSelection {
  outcomeId?: string;
  outcomeName?: string;
  marketId?: string;
  marketName?: string;
  handicap?: number | null;
  marketHandicap?: number | null;
  priceDecimal?: number;
  priceNumerator?: number;
  priceDenominator?: number;
  price?: RawPrice | null;
  outcome?: RawOutcome | null;
  market?: RawMarket | null;
  sportEvent?: RawEvent | null;
  eventId?: number;
  eventName?: string;
  eventEpoch?: number | null;
  sportId?: string;
  league?: string | null;
  region?: string | null;
  isMarketActive?: boolean;
  isEventActive?: boolean;
  isOutcomeActive?: boolean;
}

export interface RawFindBookABetResponse {
  selections?: RawSelection[];
  isSingleBet?: boolean;
  isBuildABet?: boolean;
  accountId?: string;
}

export interface RawBookABetResponse {
  bookingCode?: string;
}

/** Betway's error envelope, e.g. `{errorCode: 6000331, errorMessage: "BookABetInvalidCode"}`. */
export interface RawErrorResponse {
  errorCode?: number;
  errorMessage?: string;
  responseMetadata?: unknown;
}

/** Upstream: "that booking code does not resolve to a slip". */
export const BETWAY_INVALID_CODE = 6000331;

/**
 * Upstream: the code is real, but its selections are no longer bettable —
 * the events have kicked off or been settled. Distinct from an invalid code
 * and worth its own message: the user did not mistype anything, the slip has
 * simply aged out.
 */
export const BETWAY_SELECTIONS_EXPIRED = 6000332;

export interface RawEmopBundle {
  event?: RawEvent;
  markets?: RawMarket[];
  outcomes?: RawOutcome[];
  prices?: RawPrice[];
}

export interface RawRegionsAndLeagues {
  regions?: {
    regionId?: string;
    name?: string;
    sportId?: string;
    leagues?: { leagueId?: string; name?: string; sportId?: string }[];
  }[];
}
