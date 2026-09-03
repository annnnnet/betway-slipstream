import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Smoke test of our own app against real dev servers, and the source of the
 * screenshots in the README. Each shot is taken at the moment the screen is
 * actually interesting rather than on page load, so the README shows the
 * product doing something rather than an empty state.
 */

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const CURATED_FEED = 'https://config.betwayafrica.com/cron/bookingcode/synapse/BW?api-version=1.0';
const SHOTS = path.resolve(__dirname, '../../../docs/screenshots');

test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

/** A booking code that resolves right now, taken from Betway's own feed. */
async function liveCode(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const feed = await (await request.get(CURATED_FEED)).json();
  for (const entry of feed) {
    if (!entry.isActive || !entry.bookingCodeId) continue;
    if ((await request.get(`${API}/api/slips/${entry.bookingCodeId}`)).ok()) {
      return entry.bookingCodeId;
    }
  }
  throw new Error('no featured Betway code currently resolves');
}

test('the landing page invites a code and explains what happens to it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('booking code');
  await expect(page.getByPlaceholder(/booking code/i)).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, '01-home.png'), fullPage: true });
});

test('pasting a live code renders its legs, markets and prices', async ({ page, request }) => {
  const code = await liveCode(request);

  await page.goto('/');
  await page.getByPlaceholder(/booking code/i).fill(code);
  await page.getByRole('button', { name: 'Decode' }).click();

  await expect(page).toHaveURL(new RegExp(`/s/${code}$`));
  await expect(page.getByText(code, { exact: true }).first()).toBeVisible();
  // The slip renders as a list of legs; at least one must show up.
  await expect(page.getByRole('listitem').first()).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: path.join(SHOTS, '02-decoded-slip.png'), fullPage: true });
});

test('an unknown code says so plainly instead of spinning', async ({ page }) => {
  await page.goto('/s/ZZZZ9999');
  await expect(page.getByText(/does not know that code/i)).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: path.join(SHOTS, '03-invalid-code.png'), fullPage: true });
});

test('converting a slip produces a code and a verification report', async ({ page, request }) => {
  const code = await liveCode(request);

  await page.goto(`/s/${code}`);
  await page.getByRole('button', { name: /convert to a new code/i }).click();

  // Either a new code or the deterministic same-code notice is a pass — both
  // are correct outcomes, and which one you get depends on Betway.
  await expect(
    page.getByText(/verified against betway|returned the same code/i).first(),
  ).toBeVisible({ timeout: 45_000 });

  await page.screenshot({ path: path.join(SHOTS, '04-converted.png'), fullPage: true });
});

test('the builder lists live fixtures and prices them', async ({ page }) => {
  await page.goto('/build');

  await page.getByRole('button', { name: 'Premier League' }).first().click();
  const fixture = page.getByRole('button').filter({ hasText: ' vs. ' }).first();
  await expect(fixture).toBeVisible({ timeout: 45_000 });
  await fixture.click();

  // Markets render as a grid of priced buttons; picking one fills the slip.
  const price = page.getByRole('button').filter({ hasText: /^\D+\d+\.\d{2}$/ }).first();
  await expect(price).toBeVisible({ timeout: 45_000 });
  await price.click();
  await expect(page.getByRole('button', { name: /generate booking code/i })).toBeEnabled();

  await page.screenshot({ path: path.join(SHOTS, '05-builder.png'), fullPage: true });
});
