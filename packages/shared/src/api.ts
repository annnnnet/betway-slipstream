import { z } from 'zod';
import { slipSchema } from './slip';
import { verificationSchema } from './verification';

/** Betway codes seen in the wild are `BW` + 8 hex chars, but the operator has
 *  changed code formats before (`IsNewBookingCodeEnabled` still ships in their
 *  bundle), so we validate shape loosely and let Betway be the authority. */
export const bookingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(4)
  .max(24)
  .regex(/^[A-Z0-9]+$/, 'A booking code is letters and digits only');

export const resolveResponseSchema = z.object({ slip: slipSchema });
export type ResolveResponse = z.infer<typeof resolveResponseSchema>;

export const createSlipRequestSchema = z.object({
  outcomeIds: z.array(z.string().min(1)).min(1).max(40),
  isSingleBet: z.boolean().default(false),
});
export type CreateSlipRequest = z.infer<typeof createSlipRequestSchema>;

export const createSlipResponseSchema = z.object({
  slip: slipSchema,
  verification: verificationSchema,
});
export type CreateSlipResponse = z.infer<typeof createSlipResponseSchema>;

export const convertResponseSchema = z.object({
  source: slipSchema,
  converted: slipSchema,
  verification: verificationSchema,
  /** True when Betway handed back the code we started from — see slipFingerprint. */
  reusedSourceCode: z.boolean(),
});
export type ConvertResponse = z.infer<typeof convertResponseSchema>;
