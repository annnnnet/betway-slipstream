import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { bookingCodeSchema, createSlipRequestSchema, type CreateSlipRequest } from '@slipstream/shared';
import { AuthGuard, type Principal } from '../auth/auth.guard';
import { CurrentPrincipal } from '../auth/principal.decorator';
import { AppError } from '../common/api-error';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SlipsService } from './slips.service';

/**
 * The whole product surface is four verbs against one noun. Everything is
 * readable by an anonymous caller (see AuthGuard) — signing in only attaches
 * the action to a history.
 */
@ApiTags('slips')
@UseGuards(AuthGuard)
@Controller('slips')
export class SlipsController {
  constructor(private slips: SlipsService) {}

  /** Codes are pasted from chat apps, so trim and upper-case before use. */
  private normalise(raw: string): string {
    const parsed = bookingCodeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_FAILED',
        'That does not look like a booking code — they are letters and digits only.',
        400,
        { issues: parsed.error.issues },
      );
    }
    return parsed.data;
  }

  @Get('history')
  @ApiOperation({ summary: 'Codes this account has resolved, created or converted' })
  history(@CurrentPrincipal() principal: Principal) {
    return this.slips.history(principal);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Decode a Betway booking code into its slip' })
  async resolve(@Param('code') code: string, @CurrentPrincipal() principal: Principal) {
    return { slip: await this.slips.resolve(this.normalise(code), principal) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a Betway booking code from a set of selections' })
  create(
    @Body(new ZodValidationPipe(createSlipRequestSchema)) body: CreateSlipRequest,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.slips.create(body, principal);
  }

  @Post(':code/convert')
  @ApiOperation({ summary: 'Produce a Betway booking code for the same bet as an existing code' })
  convert(@Param('code') code: string, @CurrentPrincipal() principal: Principal) {
    return this.slips.convert(this.normalise(code), principal);
  }

  @Get(':code/verify')
  @ApiOperation({
    summary: 'Re-resolve a code against Betway and diff it against an expected set of outcomes',
  })
  verify(@Param('code') code: string, @Query('outcomeIds') outcomeIds?: string) {
    const expected = (outcomeIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (expected.length === 0) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Pass the outcome ids the code is expected to carry, comma-separated.',
        400,
      );
    }
    return this.slips.verifyCode(this.normalise(code), expected.map((outcomeId) => ({ outcomeId })));
  }
}
