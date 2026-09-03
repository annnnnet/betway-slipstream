import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/api-error';
import {
  BETWAY_INVALID_CODE,
  BETWAY_SELECTIONS_EXPIRED,
  type RawBookABetResponse,
  type RawEmopBundle,
  type RawErrorResponse,
  type RawEvent,
  type RawFindBookABetResponse,
  type RawRegionsAndLeagues,
} from './betway.types';

/**
 * The only place in the codebase that talks to Betway.
 *
 * Everything here was derived from Betway Nigeria's own Nuxt bundle rather
 * than from documentation, which does not exist publicly. The endpoints are
 * unauthenticated: no API key, no session, no bot challenge. The bundle
 * builds a request URL as `baseUrl + "/" + apiVersion + path`, which is why
 * BETWAY_BETTING_URL already carries the `/v1` suffix.
 *
 * Every call is wrapped so that a Betway outage surfaces as one of our own
 * error codes. A sportsbook we do not control sits on the critical path of
 * every feature, so "upstream is having a bad day" has to be a first-class,
 * explainable state rather than a stack trace.
 */
@Injectable()
export class BetwayClient {
  private readonly log = new Logger(BetwayClient.name);

  private readonly bettingUrl =
    process.env.BETWAY_BETTING_URL ?? 'https://www.betway.com.ng/appsynapse/bet-api-sr/v1';
  private readonly sportsUrl = process.env.BETWAY_SPORTS_URL ?? 'https://www.betway.com.ng/sportsapi/br';
  private readonly siteUrl = process.env.BETWAY_SITE_URL ?? 'https://www.betway.com.ng';
  readonly countryCode = process.env.BETWAY_COUNTRY_CODE ?? 'NG';
  readonly cultureCode = process.env.BETWAY_CULTURE_CODE ?? 'en-US';

  /** Betway's edge rejects requests without a browser-shaped UA. */
  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: this.siteUrl,
      Referer: `${this.siteUrl}/`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };
  }

  private async call<T>(url: string, init: RequestInit & { label: string }): Promise<T> {
    const { label, ...rest } = init;
    let res: Response;
    try {
      res = await fetch(url, {
        ...rest,
        headers: this.headers(),
        // Betway's p99 sits well under a second; ten seconds is generous and
        // still short enough that a hung upstream cannot pin our workers.
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      this.log.warn(`${label}: transport failure — ${(err as Error).message}`);
      throw new AppError(
        'UPSTREAM_UNAVAILABLE',
        'Betway did not respond. This is on their side — try again in a moment.',
        502,
      );
    }

    const body = (await res.json().catch(() => null)) as unknown;

    if (!res.ok) {
      const err = (body ?? {}) as RawErrorResponse;
      const upstream = { upstreamCode: err.errorCode, upstreamMessage: err.errorMessage };

      // The two upstream errors a user can actually hit. Both arrive as a
      // bare HTTP 400 and are indistinguishable without the body, but they
      // mean opposite things to the person holding the code — one is a typo,
      // the other is a slip that has aged out — so they get separate codes
      // and separate copy.
      if (err.errorCode === BETWAY_INVALID_CODE) {
        throw new AppError(
          'INVALID_CODE',
          'Betway does not recognise that booking code. Check it and try again.',
          404,
          upstream,
        );
      }
      if (err.errorCode === BETWAY_SELECTIONS_EXPIRED) {
        throw new AppError(
          'OUTCOME_UNAVAILABLE',
          'That code is real, but its selections have expired — those events have already started.',
          409,
          upstream,
        );
      }
      this.log.warn(`${label}: HTTP ${res.status} ${JSON.stringify(err).slice(0, 300)}`);
      throw new AppError(
        'UPSTREAM_UNAVAILABLE',
        'Betway rejected the request.',
        502,
        { status: res.status, upstreamCode: err.errorCode, upstreamMessage: err.errorMessage },
      );
    }

    if (body === null) {
      throw new AppError('UPSTREAM_UNAVAILABLE', 'Betway returned a response we could not read.', 502);
    }
    return body as T;
  }

  /** Decode: resolve a booking code into its legs. */
  async findBookABet(bookingCode: string): Promise<RawFindBookABetResponse> {
    return this.call<RawFindBookABetResponse>(`${this.bettingUrl}/Betting/FindBookABet`, {
      label: 'FindBookABet',
      method: 'POST',
      body: JSON.stringify({
        countryCode: this.countryCode,
        bookingCode,
        cultureCode: this.cultureCode,
      }),
    });
  }

  /**
   * Encode: mint a booking code for a set of outcomes.
   *
   * Betway accepts the full betslip selection objects its own UI holds, but
   * only reads `outcomeId` off them — verified by posting both shapes and
   * getting the identical code back. Sending the minimal shape keeps us
   * independent of the rest of their selection model.
   */
  async createBookABet(outcomeIds: string[], isSingleBet: boolean): Promise<string> {
    const body = await this.call<RawBookABetResponse>(`${this.bettingUrl}/Betting/BookABet`, {
      label: 'BookABet',
      method: 'POST',
      body: JSON.stringify({
        cultureCode: this.cultureCode,
        countryCode: this.countryCode,
        isSingleBet,
        outcomes: outcomeIds.map((outcomeId) => ({ outcomeId })),
      }),
    });

    if (!body.bookingCode) {
      throw new AppError(
        'UPSTREAM_UNAVAILABLE',
        'Betway accepted the selections but returned no booking code.',
        502,
      );
    }
    return body.bookingCode;
  }

  async regionsAndLeagues(sportId: string): Promise<RawRegionsAndLeagues> {
    const q = new URLSearchParams({ countryCode: this.countryCode });
    return this.call<RawRegionsAndLeagues>(
      `${this.sportsUrl}/v1/Feeds/RegionsAndLeagues/${encodeURIComponent(sportId)}?${q}`,
      { label: 'RegionsAndLeagues', method: 'GET' },
    );
  }

  async events(params: {
    sportId: string;
    regionId: string;
    leagueId: string;
    skip?: number;
    take?: number;
  }): Promise<RawEvent[]> {
    const q = new URLSearchParams({
      countryCode: this.countryCode,
      sportId: params.sportId,
      regionId: params.regionId,
      leagueId: params.leagueId,
      skip: String(params.skip ?? 0),
      take: String(params.take ?? 20),
    });
    // This feed is the one endpoint on v2 rather than v1 — Betway's own
    // client special-cases it the same way.
    const body = await this.call<RawEvent[] | { events?: RawEvent[] }>(
      `${this.sportsUrl}/v2/FeedsEvent/Events?${q}`,
      { label: 'FeedsEvent/Events', method: 'GET' },
    );
    return Array.isArray(body) ? body : (body.events ?? []);
  }

  /** Every market and priced outcome for one event. */
  async eventMarkets(eventId: number): Promise<RawEmopBundle | null> {
    const q = new URLSearchParams({
      eventIds: String(eventId),
      marketNames: '',
      countryCode: this.countryCode,
      cultureCode: this.cultureCode,
    });
    const body = await this.call<RawEmopBundle[]>(`${this.sportsUrl}/v1/Feeds/EMOP?${q}`, {
      label: 'Feeds/EMOP',
      method: 'GET',
    });
    return Array.isArray(body) ? (body[0] ?? null) : null;
  }
}
