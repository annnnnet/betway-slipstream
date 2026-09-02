import { z } from 'zod';

/**
 * Error codes are part of the public contract: the web app and the Flutter
 * client both branch on them, so they are defined once here rather than
 * inferred from HTTP status. `INVALID_CODE` and `SLIP_EMPTY` are the two a
 * user can actually cause and are the only ones rendered as inline copy.
 */
export const ErrorCode = z.enum([
  /** Betway rejected the booking code (its errorCode 6000331). */
  'INVALID_CODE',
  /** Betway accepted the code but returned zero selections. */
  'SLIP_EMPTY',
  /** One or more outcome ids are no longer offered (event settled/pulled). */
  'OUTCOME_UNAVAILABLE',
  /** Betway answered with a shape we do not recognise, or not at all. */
  'UPSTREAM_UNAVAILABLE',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const apiErrorSchema = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
