import { describe, expect, it } from 'vitest';
import { formatHandicap, formatKickoff, formatOdds } from './format';

const NOW = Date.parse('2026-09-03T12:00:00.000Z');
const at = (iso: string) => formatKickoff(iso, NOW);

describe('formatOdds', () => {
  it('always shows two decimals, so a round price does not read as a typo', () => {
    expect(formatOdds(2)).toBe('2.00');
    expect(formatOdds(1.975)).toBe('1.98');
  });
});

describe('formatKickoff', () => {
  it('counts down in minutes under the hour', () => {
    expect(at('2026-09-03T12:45:00.000Z')).toBe('in 45m');
  });

  it('counts down in hours and minutes under a day', () => {
    expect(at('2026-09-03T15:30:00.000Z')).toBe('in 3h 30m');
    expect(at('2026-09-03T15:00:00.000Z')).toBe('in 3h');
  });

  it('says "Started" rather than a negative countdown', () => {
    expect(at('2026-09-03T11:00:00.000Z')).toBe('Started');
  });

  it('handles a missing or unparseable kickoff without rendering "Invalid Date"', () => {
    expect(formatKickoff(null, NOW)).toBe('Time TBC');
    expect(formatKickoff('not a date', NOW)).toBe('Time TBC');
  });
});

describe('formatHandicap', () => {
  it('signs a real line and hides a zero one', () => {
    expect(formatHandicap(2.5)).toBe('+2.5');
    expect(formatHandicap(-1)).toBe('-1');
    expect(formatHandicap(0)).toBeNull();
    expect(formatHandicap(null)).toBeNull();
  });
});
