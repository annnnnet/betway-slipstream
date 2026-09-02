import { z } from 'zod';
import { selectionSchema } from './slip';

export const oddsDriftSchema = z.object({
  outcomeId: z.string(),
  outcomeName: z.string(),
  expected: z.number(),
  actual: z.number(),
});
export type OddsDrift = z.infer<typeof oddsDriftSchema>;

/**
 * The evidence that a generated or converted code really carries the bet we
 * meant. Produced by re-resolving the code against Betway and diffing the
 * result against the selections we asked for — never by trusting our own
 * request, and never by comparing code strings (see `slipFingerprint`).
 *
 * Odds drift is reported but does not fail the check: prices move between the
 * encode call and the verify call as a matter of course, and a slip whose
 * legs are identical but whose price ticked from 1.97 to 1.95 is still the
 * same bet. A missing or extra leg is a genuine failure.
 */
export const verificationSchema = z.object({
  code: z.string(),
  betwayUrl: z.string().url(),
  matches: z.boolean(),
  expectedFingerprint: z.string(),
  actualFingerprint: z.string(),
  /** Outcome ids we asked for that Betway's resolved slip does not contain. */
  missing: z.array(z.string()),
  /** Outcome ids present in the resolved slip that we never asked for. */
  extra: z.array(z.string()),
  oddsDrift: z.array(oddsDriftSchema),
  resolved: z.array(selectionSchema),
  checkedAt: z.string().datetime(),
});
export type Verification = z.infer<typeof verificationSchema>;
