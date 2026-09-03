import { BetwayClient } from './betway.client';
import { toSlip } from './slip.mapper';
import { slipFingerprint } from '@slipstream/shared';

/**
 * Opt-in suite that talks to the real Betway Nigeria API (`pnpm test:live`).
 *
 * Deliberately excluded from the default `pnpm test` run. It proves the
 * integration still works against production, which is precisely why it must
 * not be able to fail a build: a Betway outage or a settled fixture would
 * then block a deploy that has nothing to do with either.
 *
 * Test codes come from Betway's own curated feed rather than being
 * hard-coded, so the suite never goes stale — a hard-coded code is valid for
 * about a week, until its events kick off.
 */
const CURATED_FEED = 'https://config.betwayafrica.com/cron/bookingcode/synapse/BW?api-version=1.0';

async function liveBookingCodes(): Promise<string[]> {
  const res = await fetch(CURATED_FEED, { signal: AbortSignal.timeout(15_000) });
  const feed = (await res.json()) as { bookingCodeId?: string; isActive?: boolean }[];
  return feed.filter((f) => f.isActive && f.bookingCodeId).map((f) => String(f.bookingCodeId));
}

describe('Betway Nigeria (live)', () => {
  const betway = new BetwayClient();
  let code: string;

  beforeAll(async () => {
    const codes = await liveBookingCodes();
    expect(codes.length).toBeGreaterThan(0);

    // The feed advertises codes as active that Betway itself then rejects
    // with BookABetSelectionsExpired (6000332) — their CMS validity window
    // and the fixtures' kickoff times are maintained separately and drift
    // apart. Taking codes[0] on faith made this suite fail for a reason that
    // had nothing to do with our code, so pick the first one that genuinely
    // resolves and only give up if none of them do.
    for (const candidate of codes) {
      try {
        await betway.findBookABet(candidate);
        code = candidate;
        break;
      } catch {
        continue;
      }
    }
    if (!code) throw new Error(`None of Betway's ${codes.length} advertised codes resolve right now.`);
  });

  it('rejects a nonsense booking code with INVALID_CODE', async () => {
    await expect(betway.findBookABet('ZZZZ9999')).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });

  it('decodes a live booking code into a slip with priced legs', async () => {
    const slip = toSlip(code, await betway.findBookABet(code));

    expect(slip.selections.length).toBeGreaterThan(0);
    expect(slip.combinedOdds).toBeGreaterThan(0);
    for (const s of slip.selections) {
      // Outcome ids are NOT plain integers. Line-based markets encode the
      // line into the id itself — "6838053018total=3.5~12" is a real one for
      // an Over 3.5. Anything that parses, validates or stores an outcome id
      // has to treat it as an opaque string; an early version of this test
      // asserted /^\d+$/ and that is how we found out.
      expect(typeof s.outcomeId).toBe('string');
      expect(s.outcomeId.length).toBeGreaterThan(0);
      expect(s.odds.decimal).toBeGreaterThan(1);
      expect(s.event.name).not.toBe('Unknown event');
    }
  });

  it('handles line markets, whose outcome ids are not numeric, through a full round trip', async () => {
    const slip = toSlip(code, await betway.findBookABet(code));
    const composite = slip.selections.filter((s) => !/^\d+$/.test(s.outcomeId));
    if (composite.length === 0) return; // this week's featured slips are all plain markets

    const ids = composite.map((s) => s.outcomeId);
    const newCode = await betway.createBookABet(ids, false);
    const back = toSlip(newCode, await betway.findBookABet(newCode));

    expect(slipFingerprint(back.selections)).toBe(slipFingerprint(composite));
  });

  it('round-trips: decode -> encode -> decode preserves every leg', async () => {
    // This is the assessment's verification requirement expressed as a test:
    // the bet that comes back out of a generated code must be the bet that
    // went in, compared on the fingerprint rather than on the code string.
    const source = toSlip(code, await betway.findBookABet(code));
    const outcomeIds = source.selections.map((s) => s.outcomeId);

    const newCode = await betway.createBookABet(outcomeIds, source.isSingleBet);
    expect(newCode).toMatch(/^[A-Z0-9]+$/);

    const converted = toSlip(newCode, await betway.findBookABet(newCode));
    expect(converted.fingerprint).toBe(source.fingerprint);
    expect(slipFingerprint(converted.selections)).toBe(slipFingerprint(source.selections));
  });

  it("confirms Betway's encoder is deterministic on the ordered outcome list", async () => {
    // The finding the conversion flow is built around. If this ever stops
    // being true, `reusedSourceCode` and the "same code returned" copy in the
    // UI become wrong, and this test is where we would find out.
    const source = toSlip(code, await betway.findBookABet(code));
    const ids = source.selections.map((s) => s.outcomeId);
    if (ids.length < 2) return;

    const first = await betway.createBookABet(ids, false);
    const again = await betway.createBookABet(ids, false);
    const reordered = await betway.createBookABet([...ids].reverse(), false);

    expect(again).toBe(first);
    expect(reordered).not.toBe(first);
  });

  it('serves the catalogue the builder needs: leagues, events, priced markets', async () => {
    const regions = await betway.regionsAndLeagues('soccer');
    expect(regions.regions?.length).toBeGreaterThan(0);

    const england = regions.regions?.find((r) => r.regionId === 'england');
    expect(england?.leagues?.length).toBeGreaterThan(0);

    const events = await betway.events({
      sportId: 'soccer',
      regionId: 'england',
      leagueId: 'premier-league',
      take: 3,
    });
    expect(events.length).toBeGreaterThan(0);

    const bundle = await betway.eventMarkets(events[0].eventId as number);
    expect(bundle?.markets?.length).toBeGreaterThan(0);
    expect(bundle?.prices?.length).toBeGreaterThan(0);
  });
});
