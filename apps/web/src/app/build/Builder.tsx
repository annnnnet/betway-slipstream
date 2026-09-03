'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CatalogueEvent } from '@slipstream/shared';
import { useEvents, useRegions, useSports } from '@/hooks/use-slips';
import { EventMarkets } from '@/components/builder/EventMarkets';
import { BetslipPanel } from '@/components/builder/BetslipPanel';
import { ErrorState } from '@/components/states/ErrorState';
import { Spinner } from '@/components/states/Spinner';
import { formatKickoff } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Sport -> league -> match -> market, then the slip.
 *
 * A drill-down rather than a search box: Betway's catalogue has no public
 * search endpoint, and the point of this screen is to produce a valid booking
 * code, not to be a second sportsbook. Each level only loads once the one
 * above it is chosen, so browsing costs one upstream call at a time.
 */
export function Builder() {
  const [sportId, setSportId] = useState('soccer');
  const [league, setLeague] = useState<{ regionId: string; leagueId: string } | null>(null);
  const [event, setEvent] = useState<CatalogueEvent | null>(null);

  const sports = useSports();
  const regions = useRegions(sportId);
  const events = useEvents(league ? { sportId, ...league } : null);

  function pickSport(id: string) {
    setSportId(id);
    // A league from the previous sport is meaningless here, and leaving it
    // selected would show football fixtures under "Tennis".
    setLeague(null);
    setEvent(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Build a slip</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick selections from Betway&apos;s live markets, then mint a booking code you can open on
        Betway itself.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {sports.data?.sports.map((sport) => (
          <button
            key={sport.id}
            onClick={() => pickSport(sport.id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm transition-colors',
              sport.id === sportId
                ? 'border-primary bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
            )}
          >
            {sport.name}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr_320px]">
        {/* Leagues */}
        <aside className="surface max-h-[70vh] overflow-y-auto p-2">
          {regions.isPending ? <Spinner /> : null}
          {regions.error ? <ErrorState error={regions.error} /> : null}
          {regions.data?.regions.map((region) => (
            <div key={region.regionId} className="mb-3">
              <h3 className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {region.name}
              </h3>
              {region.leagues.map((l) => {
                const active = league?.leagueId === l.leagueId && league.regionId === region.regionId;
                return (
                  <button
                    key={l.leagueId}
                    onClick={() => {
                      setLeague({ regionId: region.regionId, leagueId: l.leagueId });
                      setEvent(null);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                      active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className="truncate">{l.name}</span>
                    {active ? <ChevronRight className="size-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Fixtures, then that fixture's markets */}
        <div className="min-w-0">
          {!league ? (
            <Placeholder text="Choose a league to see its fixtures." />
          ) : event ? (
            <div className="space-y-4">
              <button
                onClick={() => setEvent(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to fixtures
              </button>
              <EventMarkets event={event} />
            </div>
          ) : events.isPending ? (
            <Spinner label="Loading fixtures…" />
          ) : events.error ? (
            <ErrorState error={events.error} />
          ) : events.data?.events.length === 0 ? (
            <Placeholder text="Betway has no upcoming fixtures listed for this league." />
          ) : (
            <ul className="surface divide-y overflow-hidden">
              {events.data?.events.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setEvent(e)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{formatKickoff(e.startsAt)}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* The slip. Sticky so the running total stays visible while browsing. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <BetslipPanel />
        </aside>
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="surface grid place-items-center px-6 py-16 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
