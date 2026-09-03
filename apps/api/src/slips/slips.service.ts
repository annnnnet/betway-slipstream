import { Injectable, Logger } from '@nestjs/common';
import { SlipActionKind } from '@prisma/client';
import {
  betwayUrlFor,
  slipFingerprint,
  type ConvertResponse,
  type CreateSlipRequest,
  type CreateSlipResponse,
  type OddsDrift,
  type Selection,
  type Slip,
  type Verification,
} from '@slipstream/shared';
import type { Principal } from '../auth/auth.guard';
import { BetwayClient } from '../betway/betway.client';
import { toSlip } from '../betway/slip.mapper';
import { AppError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

/**
 * How long a cached resolution is allowed to answer a plain decode request.
 *
 * Short on purpose. The cache exists to keep us from hammering a public
 * endpoint when one code goes around a WhatsApp group, not to make the app
 * fast — and odds behind a booking code move continuously, so a slip served
 * from a long-lived cache would be quietly wrong in the one number users
 * actually read.
 */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class SlipsService {
  private readonly log = new Logger(SlipsService.name);

  constructor(
    private betway: BetwayClient,
    private prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------
  // Decode
  // ---------------------------------------------------------------------

  /** Resolve a booking code into a slip, using the cache where it is fresh. */
  async resolve(code: string, principal: Principal): Promise<Slip> {
    const cached = await this.readCache(code);
    const slip = cached ?? (await this.resolveFresh(code));

    await this.record(SlipActionKind.RESOLVE, slip, principal);
    return slip;
  }

  /** Always goes upstream. Used wherever a stale price would be misleading. */
  private async resolveFresh(code: string): Promise<Slip> {
    const raw = await this.betway.findBookABet(code);
    const slip = toSlip(code, raw);
    await this.writeCache(slip);
    return slip;
  }

  /**
   * Resolve a code we have *just* minted.
   *
   * Betway occasionally answers `BookABetInvalidCode` for a code its own
   * encoder returned a moment earlier — observed twice while building this,
   * and not reproducible on a retry, so it reads as replication lag between
   * whatever writes the code and whatever reads it. For any other caller
   * "invalid code" is the truth and must be shown; here we know for a fact
   * the code exists, so one short retry is warranted rather than surfacing a
   * confusing error about a code we created ourselves.
   */
  private async resolveMinted(code: string): Promise<Slip> {
    try {
      return await this.resolveFresh(code);
    } catch (err) {
      if (!(err instanceof AppError) || err.code !== 'INVALID_CODE') throw err;
      this.log.warn(`Betway did not recognise its own fresh code ${code}; retrying once.`);
      await new Promise((r) => setTimeout(r, 400));
      return this.resolveFresh(code);
    }
  }

  // ---------------------------------------------------------------------
  // Encode
  // ---------------------------------------------------------------------

  /**
   * Mint a booking code for a set of outcomes, then prove it carries them.
   *
   * The verification is not optional and not a separate endpoint the caller
   * may forget to call: an encoder that reports success on Betway's 200 alone
   * is asserting something it never checked. We re-resolve the code we were
   * given and diff it against what we asked for, and the client renders that
   * evidence rather than our say-so.
   */
  async create(req: CreateSlipRequest, principal: Principal): Promise<CreateSlipResponse> {
    const outcomeIds = [...new Set(req.outcomeIds)];
    const code = await this.betway.createBookABet(outcomeIds, req.isSingleBet);

    const slip = await this.resolveMinted(code);
    const verification = this.verify(code, outcomeIds.map(toExpected), slip.selections);

    await this.record(SlipActionKind.CREATE, slip, principal, { verification });
    return { slip, verification };
  }

  // ---------------------------------------------------------------------
  // Convert
  // ---------------------------------------------------------------------

  /**
   * Take an existing code and produce a Betway code for the same bet.
   *
   * `reusedSourceCode` is here because of a genuine quirk rather than
   * defensiveness: Betway's encoder is a deterministic function of the
   * *ordered* outcome list, so re-booking a slip's legs in the order they
   * came back hands you the identical code you started from. That is a
   * correct conversion, not a failure, and the UI has to be able to say so
   * instead of showing a "new" code that is the old one.
   */
  async convert(code: string, principal: Principal): Promise<ConvertResponse> {
    const source = await this.resolveFresh(code);

    const dead = source.selections.filter((s) => !isLive(s));
    if (dead.length === source.selections.length) {
      throw new AppError(
        'OUTCOME_UNAVAILABLE',
        'Every leg on this slip has been settled or pulled, so there is nothing left to re-book.',
        409,
        { outcomeIds: dead.map((s) => s.outcomeId) },
      );
    }

    const outcomeIds = source.selections.map((s) => s.outcomeId);
    const newCode = await this.betway.createBookABet(outcomeIds, source.isSingleBet);
    const converted = await this.resolveMinted(newCode);
    // Diff against the *source slip*, odds included, so the report shows what
    // moved between booking the original and re-booking it.
    const verification = this.verify(newCode, source.selections, converted.selections);

    await this.record(SlipActionKind.CONVERT, converted, principal, {
      sourceCode: code,
      verification,
    });

    return { source, converted, verification, reusedSourceCode: newCode === code };
  }

  // ---------------------------------------------------------------------
  // Verification
  // ---------------------------------------------------------------------

  /** Re-resolve a code against Betway and diff it against an expected bet. */
  async verifyCode(code: string, expected: ExpectedLeg[]): Promise<Verification> {
    const slip = await this.resolveFresh(code);
    return this.verify(code, expected, slip.selections);
  }

  /**
   * The diff itself. Kept pure and separate from the fetching so the rules
   * below are testable without a network.
   *
   * Odds drift is reported but never fails the check. Prices move between the
   * encode call and the verify call as a matter of course — a slip whose legs
   * are identical but whose price ticked 1.97 -> 1.95 is still the same bet,
   * and failing on that would make the feature cry wolf on every busy market.
   * A missing or extra leg is a real failure and always fails.
   */
  private verify(code: string, expected: ExpectedLeg[], resolved: Selection[]): Verification {
    const expectedIds = new Set(expected.map((e) => e.outcomeId));
    const actualById = new Map(resolved.map((s) => [s.outcomeId, s]));

    const missing = [...expectedIds].filter((id) => !actualById.has(id));
    const extra = [...actualById.keys()].filter((id) => !expectedIds.has(id));

    const oddsDrift: OddsDrift[] = [];
    for (const leg of expected) {
      const actual = actualById.get(leg.outcomeId);
      if (!actual || leg.odds === undefined) continue;
      if (leg.odds.decimal !== actual.odds.decimal) {
        oddsDrift.push({
          outcomeId: leg.outcomeId,
          outcomeName: actual.outcomeName,
          expected: leg.odds.decimal,
          actual: actual.odds.decimal,
        });
      }
    }

    const verification: Verification = {
      code,
      betwayUrl: betwayUrlFor(code),
      matches: missing.length === 0 && extra.length === 0,
      expectedFingerprint: slipFingerprint(expected),
      actualFingerprint: slipFingerprint(resolved),
      missing,
      extra,
      oddsDrift,
      resolved,
      checkedAt: new Date().toISOString(),
    };

    if (!verification.matches) {
      this.log.warn(
        `Verification FAILED for ${code}: missing=${missing.join(',')} extra=${extra.join(',')}`,
      );
    }
    return verification;
  }

  // ---------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------

  async history(principal: Principal, limit = 25) {
    if (principal.kind !== 'user') return [];
    return this.prisma.slipAction.findMany({
      where: { userId: principal.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        kind: true,
        code: true,
        sourceCode: true,
        selectionCount: true,
        combinedOdds: true,
        verified: true,
        createdAt: true,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------

  private async readCache(code: string): Promise<Slip | null> {
    const row = await this.prisma.cachedSlip.findUnique({ where: { code } }).catch(() => null);
    if (!row) return null;
    if (Date.now() - row.resolvedAt.getTime() > CACHE_TTL_MS) return null;

    await this.prisma.cachedSlip
      .update({ where: { code }, data: { hits: { increment: 1 } } })
      .catch(() => undefined);

    return {
      code: row.code,
      selections: row.selections as unknown as Selection[],
      isSingleBet: row.isSingleBet,
      isBuildABet: row.isBuildABet,
      combinedOdds: row.combinedOdds,
      fingerprint: row.fingerprint,
      betwayUrl: betwayUrlFor(row.code),
      resolvedAt: row.resolvedAt.toISOString(),
    };
  }

  private async writeCache(slip: Slip): Promise<void> {
    const data = {
      fingerprint: slip.fingerprint,
      isSingleBet: slip.isSingleBet,
      isBuildABet: slip.isBuildABet,
      combinedOdds: slip.combinedOdds,
      selections: slip.selections as unknown as object,
      resolvedAt: new Date(slip.resolvedAt),
    };
    // The cache and the audit log are conveniences layered on top of the
    // product. If Postgres is down the user should still be able to decode a
    // code against Betway, so persistence failures are logged and swallowed
    // rather than turned into a 500 on the request path.
    await this.prisma.cachedSlip
      .upsert({ where: { code: slip.code }, create: { code: slip.code, ...data }, update: data })
      .catch((err) => this.log.warn(`cache write failed for ${slip.code}: ${err.message}`));
  }

  private async record(
    kind: SlipActionKind,
    slip: Slip,
    principal: Principal,
    extras: { sourceCode?: string; verification?: Verification } = {},
  ): Promise<void> {
    await this.prisma.slipAction
      .create({
        data: {
          kind,
          code: slip.code,
          sourceCode: extras.sourceCode,
          fingerprint: slip.fingerprint,
          selectionCount: slip.selections.length,
          combinedOdds: slip.combinedOdds,
          verified: extras.verification?.matches ?? null,
          verification: (extras.verification ?? undefined) as unknown as object | undefined,
          userId: principal.kind === 'user' ? principal.userId : null,
        },
      })
      .catch((err) => this.log.warn(`action log failed for ${slip.code}: ${err.message}`));
  }
}

/**
 * What we claim a code should contain. `odds` is optional because the two
 * callers know different amounts: a freshly built slip has only the outcome
 * ids the user picked, while a conversion has the whole source slip and can
 * therefore also report which prices moved.
 */
export type ExpectedLeg = { outcomeId: string; odds?: { decimal: number } };

const toExpected = (outcomeId: string): ExpectedLeg => ({ outcomeId });

/** A leg can only be re-booked when Betway reports all three levels active. */
function isLive(s: Selection): boolean {
  return s.isOutcomeActive && s.isMarketActive && s.isEventActive;
}
