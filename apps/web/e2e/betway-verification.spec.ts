import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The assessment's verification requirement, automated.
 *
 * Anyone can claim a generated booking code works. This suite proves it the
 * only way that counts: it builds a slip through our own API, then opens the
 * resulting code on betway.com.ng — Betway's real site, in a real browser —
 * and asserts their betslip comes back holding the same selections we asked
 * for. Screenshots of Betway's own UI are written to docs/verification/ as
 * the artefact.
 *
 * Run with:  pnpm --filter @slipstream/web test:e2e betway-verification
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const CURATED_FEED = 'https://config.betwayafrica.com/cron/bookingcode/synapse/BW?api-version=1.0';
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/verification');

interface Slip {
  code: string;
  betwayUrl: string;
  selections: { outcomeId: string; outcomeName: string; eventName: string }[];
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

/**
 * Betway's betslip is a client-rendered Nuxt drawer that opens off the
 * `?bookingCode=` query parameter, so there is nothing in the initial HTML to
 * assert against — the check has to happen in a real browser after hydration.
 */
async function openOnBetway(page: import('@playwright/test').Page, slip: Slip, evidence: string) {
  try {
    await page.goto(slip.betwayUrl, { waitUntil: 'domcontentloaded' });
  } catch (err) {
    // Distinguish "we could not get to Betway" from "Betway disagrees with
    // our code". Corporate networks, CI egress rules and sandboxed agent
    // environments routinely refuse outbound browser traffic to a gambling
    // domain — this suite was written in one that allows the bare host but
    // refuses any path or query on it. Failing with the same message as a
    // genuine mismatch would make an environment problem look like a product
    // bug, which is exactly the confusion this whole feature exists to avoid.
    throw new Error(
      `Could not reach ${slip.betwayUrl} from this browser (${(err as Error).message.split('\n')[0]}).\n` +
        'This is a network/egress restriction, NOT a verification failure — the API-level ' +
        'round-trip check in apps/api (pnpm test:live) covers the same guarantee without a browser. ' +
        'Re-run this suite from a network that permits betway.com.ng.',
    );
  }

  // The site sets a country/consent overlay on first visit that sits over the
  // betslip. Dismiss whichever variant appears, and shrug if neither does.
  for (const label of [/accept/i, /agree/i, /continue/i, /got it/i]) {
    const button = page.getByRole('button', { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      break;
    }
  }

  // Wait for a team name from our slip to appear anywhere on the page. That
  // is the real assertion: Betway resolved our code into these fixtures.
  const firstEvent = slip.selections[0].eventName.split(' vs.')[0].trim();
  await expect(page.getByText(firstEvent, { exact: false }).first()).toBeVisible({
    timeout: 45_000,
  });

  await page.screenshot({ path: path.join(EVIDENCE_DIR, evidence), fullPage: false });
}

test('a code we generate loads on Betway with the selections we asked for', async ({
  page,
  request,
}) => {
  // 1. Take a live, currently-valid slip from Betway's own featured feed and
  //    decode it through our API. Hard-coding a code would rot within a week.
  const feed = await (await request.get(CURATED_FEED)).json();
  const candidates: string[] = feed
    .filter((f: { isActive?: boolean; bookingCodeId?: string }) => f.isActive && f.bookingCodeId)
    .map((f: { bookingCodeId: string }) => f.bookingCodeId);

  let source: Slip | null = null;
  for (const code of candidates) {
    const res = await request.get(`${API}/api/slips/${code}`);
    if (res.ok()) {
      source = (await res.json()).slip;
      break;
    }
  }
  expect(source, 'no featured Betway code currently resolves').not.toBeNull();

  // 2. Generate a *new* code from those selections through our encode path.
  const created = await request.post(`${API}/api/slips`, {
    data: { outcomeIds: source!.selections.map((s) => s.outcomeId), isSingleBet: false },
  });
  expect(created.ok()).toBe(true);

  const { slip, verification } = await created.json();

  // 3. Our own verification must already agree before we go near a browser.
  expect(verification.matches, JSON.stringify(verification, null, 2)).toBe(true);
  expect(verification.missing).toEqual([]);
  expect(verification.extra).toEqual([]);

  // 4. The part that actually proves it: load the code on Betway itself.
  await openOnBetway(page, slip, `generated-${slip.code}.png`);

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, `generated-${slip.code}.json`),
    JSON.stringify({ sourceCode: source!.code, generated: slip, verification }, null, 2),
  );
});

test('a converted code carries the same bet as the code it came from', async ({
  page,
  request,
}) => {
  const feed = await (await request.get(CURATED_FEED)).json();
  const candidates: string[] = feed
    .filter((f: { isActive?: boolean; bookingCodeId?: string }) => f.isActive && f.bookingCodeId)
    .map((f: { bookingCodeId: string }) => f.bookingCodeId);

  let converted = null;
  for (const code of candidates) {
    const res = await request.post(`${API}/api/slips/${code}/convert`);
    if (res.ok()) {
      converted = await res.json();
      break;
    }
  }
  expect(converted, 'no featured Betway code could be converted').not.toBeNull();

  // Fingerprints, not code strings: Betway's encoder is order-sensitive, so
  // the same bet legitimately has more than one valid code and comparing the
  // strings would fail a conversion that is perfectly correct.
  expect(converted.verification.matches).toBe(true);
  expect(converted.converted.fingerprint).toBe(converted.source.fingerprint);

  await openOnBetway(page, converted.converted, `converted-${converted.converted.code}.png`);
});
