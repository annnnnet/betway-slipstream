import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogueService } from './catalogue.service';

/**
 * Read-only passthrough of Betway's own feeds, normalised into our contract.
 * It exists so the builder can offer real, currently-priced outcomes — a
 * booking code can only be minted from outcome ids Betway is actually
 * quoting, so a stale or hand-maintained catalogue would produce codes that
 * fail at the moment they matter.
 */
@ApiTags('catalogue')
@Controller('catalogue')
export class CatalogueController {
  constructor(private catalogue: CatalogueService) {}

  @Get('sports')
  @ApiOperation({ summary: 'Sports the builder supports' })
  sports() {
    return { sports: this.catalogue.sports() };
  }

  @Get('sports/:sportId/regions')
  @ApiOperation({ summary: 'Regions and their leagues for a sport' })
  async regions(@Param('sportId') sportId: string) {
    return { regions: await this.catalogue.regions(sportId) };
  }

  @Get('events')
  @ApiOperation({ summary: 'Upcoming events in a league' })
  async events(
    @Query('sportId') sportId: string,
    @Query('regionId') regionId: string,
    @Query('leagueId') leagueId: string,
    @Query('take') take?: string,
  ) {
    const parsed = Number(take);
    return {
      events: await this.catalogue.events({
        sportId,
        regionId,
        leagueId,
        take: Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 20,
      }),
    };
  }

  @Get('events/:eventId/markets')
  @ApiOperation({ summary: 'Every priced market and outcome for one event' })
  markets(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.catalogue.eventMarkets(eventId);
  }
}
