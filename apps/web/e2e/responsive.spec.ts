import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * A booking code is something people paste on a phone, in a group chat, one
 * handed. Desktop is the secondary surface here, so the narrow viewport gets
 * its own checks rather than being assumed to follow.
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const CURATED_FEED = 'https://config.betwayafrica.com/cron/bookingcode/synapse/BW?api-version=1.0';
const SHOTS = path.resolve(__dirname, '../../../docs/screenshots');

test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

async function liveCode(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const feed = await (await request.get(CURATED_FEED)).json();
  for (const entry of feed) {
    if (!entry.isActive || !entry.bookingCodeId) continue;
    if ((await request.get(`${API}/api/slips/${entry.bookingCodeId}`)).ok()) return entry.bookingCodeId;
  }
  throw new Error('no featured Betway code currently resolves');
}

/** Nothing may scroll the page sideways — the single worst mobile smell. */
async function expectNoHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);
}

test('the landing page fits a phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByPlaceholder(/booking code/i)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: path.join(SHOTS, '06-mobile-home.png'), fullPage: true });
});

test('a decoded slip is readable on a phone', async ({ page, request }) => {
  const code = await liveCode(request);
  await page.goto(`/s/${code}`);

  await expect(page.getByRole('listitem').first()).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page);

  // Odds are the number people came for; they must not be truncated by a
  // long team name pushing them out of the row.
  const odds = page.locator('.tabular').filter({ hasText: /^\d+\.\d{2}$/ }).first();
  await expect(odds).toBeVisible();

  await page.screenshot({ path: path.join(SHOTS, '07-mobile-slip.png'), fullPage: true });
});

test('the builder stacks instead of squeezing three columns onto a phone', async ({ page }) => {
  await page.goto('/build');
  await page.getByRole('button', { name: 'Premier League' }).first().click();

  const fixture = page.getByRole('button').filter({ hasText: ' vs. ' }).first();
  await expect(fixture).toBeVisible({ timeout: 45_000 });
  await expectNoHorizontalScroll(page);

  await page.screenshot({ path: path.join(SHOTS, '08-mobile-builder.png'), fullPage: true });
});
