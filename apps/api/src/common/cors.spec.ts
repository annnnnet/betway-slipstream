import { buildOriginCheck, normaliseOrigin, parseAllowedOrigins, vercelPreviewPattern } from './cors';

const PROD = 'https://betway-slipstream-web.vercel.app';

describe('normaliseOrigin', () => {
  it('strips a trailing slash, which an address-bar copy always carries', () => {
    // A browser sends Origin with no path, so a configured trailing slash can
    // never match and the failure is silent.
    expect(normaliseOrigin(`${PROD}/`)).toBe(PROD);
    expect(normaliseOrigin(`${PROD}///`)).toBe(PROD);
  });

  it('strips surrounding quotes, which a copy out of a JSON blob carries', () => {
    expect(normaliseOrigin(`"${PROD}"`)).toBe(PROD);
    expect(normaliseOrigin(`'${PROD}'`)).toBe(PROD);
  });

  it('strips whitespace around a pasted value', () => {
    expect(normaliseOrigin(`  ${PROD}  `)).toBe(PROD);
  });
});

describe('parseAllowedOrigins', () => {
  it('splits a comma-separated list and normalises each entry', () => {
    expect(parseAllowedOrigins(`${PROD}/, "http://localhost:3000" `)).toEqual([
      PROD,
      'http://localhost:3000',
    ]);
  });

  it('drops empty entries from a trailing comma', () => {
    expect(parseAllowedOrigins(`${PROD},`)).toEqual([PROD]);
    expect(parseAllowedOrigins('  ,  ')).toEqual([]);
  });
});

describe('vercelPreviewPattern', () => {
  it('admits sibling preview deployments of the same project', () => {
    const pattern = vercelPreviewPattern(PROD)!;
    expect(pattern.test('https://betway-slipstream-web-git-main-anna.vercel.app')).toBe(true);
    expect(pattern.test('https://betway-slipstream-web-abc123.vercel.app')).toBe(true);
    expect(pattern.test(PROD)).toBe(true);
  });

  it('does not admit somebody else vercel project', () => {
    // Widening to all of *.vercel.app would let any Vercel deployment on the
    // internet call this API.
    const pattern = vercelPreviewPattern(PROD)!;
    expect(pattern.test('https://evil.vercel.app')).toBe(false);
    expect(pattern.test('https://betway-slipstream-web.evil.com')).toBe(false);
  });

  it('is null for a non-Vercel origin, so no pattern is invented', () => {
    expect(vercelPreviewPattern('http://localhost:3000')).toBeNull();
    expect(vercelPreviewPattern('https://api.example.com')).toBeNull();
  });
});

describe('buildOriginCheck', () => {
  it('accepts the configured origin however it was pasted', () => {
    const check = buildOriginCheck(`  "${PROD}/"  `);
    expect(check.isAllowed(PROD)).toBe(true);
  });

  it('accepts a preview deployment of the same project', () => {
    expect(buildOriginCheck(PROD).isAllowed('https://betway-slipstream-web-git-fix-anna.vercel.app')).toBe(
      true,
    );
  });

  it('rejects anything else', () => {
    const check = buildOriginCheck(PROD);
    expect(check.isAllowed('https://example.com')).toBe(false);
    expect(check.isAllowed('http://betway-slipstream-web.vercel.app')).toBe(false); // http, not https
  });

  it('reports an empty list rather than silently allowing nothing', () => {
    expect(buildOriginCheck('  ,  ').allowed).toEqual([]);
  });
});
