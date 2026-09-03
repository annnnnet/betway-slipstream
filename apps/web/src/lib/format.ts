/** Odds always show two decimals — "2" reads as a typo on a betslip, "2.00" does not. */
export function formatOdds(decimal: number): string {
  return decimal.toFixed(2);
}

/** Betway settles on the fraction, so it is worth showing alongside the decimal. */
export function formatFraction(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`;
}

/**
 * Kickoff time. Relative for anything inside a day — "in 3h" answers the only
 * question a punter actually has about a fixture that is close — and an
 * absolute date beyond that, where a relative offset stops being meaningful.
 */
export function formatKickoff(iso: string | null, now = Date.now()): string {
  if (!iso) return 'Time TBC';
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return 'Time TBC';

  const diffMinutes = Math.round((at - now) / 60_000);
  if (diffMinutes < 0) return 'Started';
  if (diffMinutes < 60) return `in ${diffMinutes}m`;
  if (diffMinutes < 24 * 60) {
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
  }
  return new Date(at).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Total (3.5)" already carries its line, so a separate "+3.5" would double it. */
export function formatHandicap(handicap: number | null): string | null {
  if (handicap === null || handicap === 0) return null;
  return handicap > 0 ? `+${handicap}` : String(handicap);
}

/**
 * What a stake returns at these odds. Naira, no decimals: stakes here are
 * whole numbers and kobo precision is noise on a returns figure.
 */
export function formatReturns(stake: number, odds: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(stake * odds);
}
