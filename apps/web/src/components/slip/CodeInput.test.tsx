import { describe, expect, it } from 'vitest';
import { normaliseCode } from './CodeInput';

describe('normaliseCode', () => {
  it('upper-cases and trims, because codes arrive pasted from chat apps', () => {
    expect(normaliseCode('  bw6e15de93 ')).toBe('BW6E15DE93');
  });

  it('strips the "Booking code:" preamble people paste along with it', () => {
    expect(normaliseCode('Booking code: BW6E15DE93')).toBe('BW6E15DE93');
    expect(normaliseCode('CODE BW6E15DE93')).toBe('BW6E15DE93');
  });

  it('drops separators a screenshot or a phone keyboard might introduce', () => {
    expect(normaliseCode('BW-6E15-DE93')).toBe('BW6E15DE93');
    expect(normaliseCode('BW 6E15 DE93')).toBe('BW6E15DE93');
  });

  it('leaves an already-clean code untouched', () => {
    expect(normaliseCode('BW6E15DE93')).toBe('BW6E15DE93');
  });

  it('returns an empty string for input with nothing code-like in it', () => {
    expect(normaliseCode('   ')).toBe('');
    expect(normaliseCode('!!!')).toBe('');
  });
});
