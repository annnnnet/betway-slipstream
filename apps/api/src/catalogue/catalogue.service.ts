import { Injectable } from '@nestjs/common';
import type { CatalogueEvent, EventMarketsResponse, Region, Sport } from '@slipstream/shared';
import { BetwayClient } from '../betway/betway.client';
import { AppError } from '../common/api-error';
import { toCatalogueEvent, toCatalogueMarkets } from '../betway/slip.mapper';

/**
 * Betway carries dozens of sports, but each one lays its markets out
 * differently and needs its rendering checked by hand. An explicit list is
 * better than scraping theirs: a sport nobody has looked at renders worse
 * than a sport that is simply absent, and the builder is a means to producing
 * a booking code rather than a full sportsbook.
 */
const SPORTS: Sport[] = [
  { id: 'soccer', name: 'Football' },
  { id: 'basketball', name: 'Basketball' },
  { id: 'tennis', name: 'Tennis' },
  { id: 'baseball', name: 'Baseball' },
  { id: 'ice-hockey', name: 'Ice Hockey' },
  { id: 'american-football', name: 'American Football' },
];

@Injectable()
export class CatalogueService {
  constructor(private betway: BetwayClient) {}

  sports(): Sport[] {
    return SPORTS;
  }

  async regions(sportId: string): Promise<Region[]> {
    this.assertKnownSport(sportId);
    const raw = await this.betway.regionsAndLeagues(sportId);

    return (raw.regions ?? [])
      .filter((r) => r.regionId)
      .map((r) => ({
        regionId: String(r.regionId),
        name: r.name ?? String(r.regionId),
        sportId,
        leagues: (r.leagues ?? [])
          .filter((l) => l.leagueId)
          .map((l) => ({
            leagueId: String(l.leagueId),
            name: l.name ?? String(l.leagueId),
            sportId,
          })),
      }))
      .filter((r) => r.leagues.length > 0);
  }

  async events(params: {
    sportId: string;
    regionId: string;
    leagueId: string;
    take?: number;
  }): Promise<CatalogueEvent[]> {
    this.assertKnownSport(params.sportId);
    const raw = await this.betway.events(params);
    return raw
      .filter((e) => typeof e.eventId === 'number' && e.isFinished !== true)
      .map(toCatalogueEvent);
  }

  async eventMarkets(eventId: number): Promise<EventMarketsResponse> {
    const bundle = await this.betway.eventMarkets(eventId);
    if (!bundle?.event) {
      throw new AppError('NOT_FOUND', 'Betway has no markets for that event.', 404);
    }
    return { event: toCatalogueEvent(bundle.event), markets: toCatalogueMarkets(bundle) };
  }

  /**
   * Betway echoes an unknown sportId back as an empty result rather than an
   * error, which would surface as a mysteriously blank picker. Reject it here
   * so a typo in a URL says what is wrong.
   */
  private assertKnownSport(sportId: string): void {
    if (!SPORTS.some((s) => s.id === sportId)) {
      throw new AppError('NOT_FOUND', `Unsupported sport "${sportId}".`, 404, {
        supported: SPORTS.map((s) => s.id),
      });
    }
  }
}
