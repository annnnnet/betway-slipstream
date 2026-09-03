import type { Selection } from '@slipstream/shared';
import type { BetwayClient } from '../betway/betway.client';
import type { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../common/api-error';
import { SlipsService } from './slips.service';

const anon = { kind: 'anonymous' } as const;

function selection(outcomeId: string, overrides: Partial<Selection> = {}): Selection {
  return {
    outcomeId,
    outcomeName: `Outcome ${outcomeId}`,
    marketId: 'm1',
    marketName: '1X2',
    handicap: null,
    odds: { decimal: 2, numerator: 1, denominator: 1 },
    event: {
      id: 1,
      name: 'A vs. B',
      homeTeam: 'A',
      awayTeam: 'B',
      startsAt: '2026-09-10T18:00:00.000Z',
      sportId: 'soccer',
      league: 'Premier League',
      region: 'England',
      isLive: false,
      isFinished: false,
    },
    isOutcomeActive: true,
    isMarketActive: true,
    isEventActive: true,
    ...overrides,
  };
}

/** Betway's payload shape, built back from our own Selection for brevity. */
function rawFrom(selections: Selection[], isSingleBet = false) {
  return {
    isSingleBet,
    isBuildABet: false,
    selections: selections.map((s) => ({
      outcomeId: s.outcomeId,
      outcomeName: s.outcomeName,
      marketId: s.marketId,
      marketName: s.marketName,
      priceDecimal: s.odds.decimal,
      priceNumerator: s.odds.numerator,
      priceDenominator: s.odds.denominator,
      eventId: s.event.id,
      eventName: s.event.name,
      isOutcomeActive: s.isOutcomeActive,
      isMarketActive: s.isMarketActive,
      isEventActive: s.isEventActive,
    })),
  };
}

/** Persistence is best-effort in this service, so the double just no-ops. */
function fakePrisma() {
  const noop = jest.fn().mockResolvedValue(null);
  return {
    cachedSlip: { findUnique: jest.fn().mockResolvedValue(null), upsert: noop, update: noop },
    slipAction: { create: noop, findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

describe('SlipsService', () => {
  describe('create', () => {
    it('mints a code and verifies it against what was actually asked for', async () => {
      const wanted = ['a', 'b', 'c'];
      const betway = {
        createBookABet: jest.fn().mockResolvedValue('BWNEW0001'),
        findBookABet: jest.fn().mockResolvedValue(rawFrom(wanted.map((id) => selection(id)))),
      } as unknown as BetwayClient;

      const { slip, verification } = await new SlipsService(betway, fakePrisma()).create(
        { outcomeIds: wanted, isSingleBet: false },
        anon,
      );

      expect(slip.code).toBe('BWNEW0001');
      expect(verification.matches).toBe(true);
      expect(verification.expectedFingerprint).toBe(verification.actualFingerprint);
      expect(verification.betwayUrl).toBe('https://www.betway.com.ng/?bookingCode=BWNEW0001');
    });

    it('reports a failure when Betway drops a leg from the code it minted', async () => {
      // The whole reason the encode path re-resolves rather than trusting a
      // 200: a code that silently lost a leg is the one bug that would cost a
      // user money, and it is invisible without this check.
      const betway = {
        createBookABet: jest.fn().mockResolvedValue('BWNEW0002'),
        findBookABet: jest.fn().mockResolvedValue(rawFrom([selection('a'), selection('b')])),
      } as unknown as BetwayClient;

      const { verification } = await new SlipsService(betway, fakePrisma()).create(
        { outcomeIds: ['a', 'b', 'c'], isSingleBet: false },
        anon,
      );

      expect(verification.matches).toBe(false);
      expect(verification.missing).toEqual(['c']);
      expect(verification.extra).toEqual([]);
    });

    it('de-duplicates the requested outcomes before sending them upstream', async () => {
      const betway = {
        createBookABet: jest.fn().mockResolvedValue('BWNEW0003'),
        findBookABet: jest.fn().mockResolvedValue(rawFrom([selection('a'), selection('b')])),
      } as unknown as BetwayClient;

      await new SlipsService(betway, fakePrisma()).create(
        { outcomeIds: ['a', 'b', 'a'], isSingleBet: false },
        anon,
      );

      expect(betway.createBookABet).toHaveBeenCalledWith(['a', 'b'], false);
    });
  });

  describe('convert', () => {
    it('re-books the source slip legs and verifies the result', async () => {
      const legs = [selection('a'), selection('b')];
      const betway = {
        createBookABet: jest.fn().mockResolvedValue('BWCONV001'),
        findBookABet: jest
          .fn()
          .mockResolvedValueOnce(rawFrom(legs)) // source
          .mockResolvedValueOnce(rawFrom(legs)), // converted
      } as unknown as BetwayClient;

      const res = await new SlipsService(betway, fakePrisma()).convert('BWOLD0001', anon);

      expect(res.source.code).toBe('BWOLD0001');
      expect(res.converted.code).toBe('BWCONV001');
      expect(res.verification.matches).toBe(true);
      expect(res.reusedSourceCode).toBe(false);
    });

    it('flags when Betway hands back the code we started from', async () => {
      // Betway's encoder is deterministic on the ordered outcome list, so
      // re-booking a slip's own legs in their own order returns the same
      // code. That is a correct conversion, not a failure — but the UI has to
      // be able to say so rather than presenting the old code as new.
      const legs = [selection('a'), selection('b')];
      const betway = {
        createBookABet: jest.fn().mockResolvedValue('BWSAME001'),
        findBookABet: jest.fn().mockResolvedValue(rawFrom(legs)),
      } as unknown as BetwayClient;

      const res = await new SlipsService(betway, fakePrisma()).convert('BWSAME001', anon);

      expect(res.reusedSourceCode).toBe(true);
      expect(res.verification.matches).toBe(true);
    });

    it('reports odds drift without failing the verification', async () => {
      // Prices move between booking and re-booking constantly. Failing on
      // that would make the check cry wolf on every busy market.
      const before = [selection('a', { odds: { decimal: 1.97, numerator: 97, denominator: 100 } })];
      const after = [selection('a', { odds: { decimal: 1.95, numerator: 95, denominator: 100 } })];
      const betway = {
        createBookABet: jest.fn().mockResolvedValue('BWDRIFT01'),
        findBookABet: jest
          .fn()
          .mockResolvedValueOnce(rawFrom(before))
          .mockResolvedValueOnce(rawFrom(after)),
      } as unknown as BetwayClient;

      const res = await new SlipsService(betway, fakePrisma()).convert('BWOLD0002', anon);

      expect(res.verification.matches).toBe(true);
      expect(res.verification.oddsDrift).toEqual([
        { outcomeId: 'a', outcomeName: 'Outcome a', expected: 1.97, actual: 1.95 },
      ]);
    });

    it('refuses a slip whose every leg is dead rather than minting a useless code', async () => {
      const dead = [selection('a', { isEventActive: false }), selection('b', { isMarketActive: false })];
      const betway = {
        createBookABet: jest.fn(),
        findBookABet: jest.fn().mockResolvedValue(rawFrom(dead)),
      } as unknown as BetwayClient;

      await expect(new SlipsService(betway, fakePrisma()).convert('BWDEAD001', anon)).rejects.toThrow(
        expect.objectContaining({ code: 'OUTCOME_UNAVAILABLE' }) as unknown as AppError,
      );
      expect(betway.createBookABet).not.toHaveBeenCalled();
    });

    it('still converts when only some legs are dead, so a part-settled slip is salvageable', async () => {
      const legs = [selection('a', { isEventActive: false }), selection('b')];
      const betway = {
        createBookABet: jest.fn().mockResolvedValue('BWPART001'),
        findBookABet: jest.fn().mockResolvedValue(rawFrom(legs)),
      } as unknown as BetwayClient;

      const res = await new SlipsService(betway, fakePrisma()).convert('BWOLD0003', anon);
      expect(res.converted.code).toBe('BWPART001');
    });
  });

  describe('history', () => {
    it('is empty for an anonymous caller and never queries the database', async () => {
      const prisma = fakePrisma();
      const service = new SlipsService({} as BetwayClient, prisma);

      expect(await service.history(anon)).toEqual([]);
      expect(prisma.slipAction.findMany).not.toHaveBeenCalled();
    });
  });
});
