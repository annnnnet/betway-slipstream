/**
 * Turning WEB_ORIGIN into a CORS allow-list.
 *
 * This exists because a mismatch here is invisible from the outside: the API
 * answers 200, the browser silently drops the response, and the app looks
 * broken for a reason nothing in either log explains. Every rule below is
 * about making that class of mistake impossible or, failing that, loud.
 */

/**
 * Normalise one configured origin.
 *
 * A pasted value routinely arrives with surrounding quotes (copied out of a
 * JSON blob) or a trailing slash (copied out of a browser address bar).
 * Neither can ever match: a browser sends `Origin` as scheme://host[:port]
 * with no path and no quotes, and the comparison is exact. Rejecting the
 * deploy over a trailing slash would be pedantry, so normalise instead.
 */
export function normaliseOrigin(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/+$/, '')
    .trim();

  if (trimmed === '') return '';

  // A scheme-less value — `example.com` rather than `https://example.com` — is
  // what you get from copying a hostname out of a dashboard, and it can never
  // match: an Origin header always carries a scheme. There is exactly one
  // sensible reading, so apply it rather than rejecting the deploy over a
  // missing "https://". Loopback gets http, since nobody runs local dev on TLS.
  if (!/^https?:\/\//i.test(trimmed)) {
    const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(trimmed);
    return `${isLoopback ? 'http' : 'https'}://${trimmed}`;
  }
  return trimmed;
}

export function parseAllowedOrigins(webOrigin: string): string[] {
  return webOrigin
    .split(',')
    .map(normaliseOrigin)
    .filter((o) => o.length > 0);
}

/**
 * Vercel gives every preview deployment its own subdomain, so pinning the
 * production hostname alone means the API rejects every preview build — which
 * looks exactly like a broken preview. Allow sibling deployments of the same
 * project: `slipstream-web.vercel.app` also admits
 * `slipstream-web-git-branch-team.vercel.app`.
 *
 * Deliberately narrow. It never widens to all of `*.vercel.app`, which would
 * let anybody's Vercel project call this API with credentials attached.
 */
export function vercelPreviewPattern(origin: string): RegExp | null {
  const match = /^https:\/\/([a-z0-9-]+)\.vercel\.app$/i.exec(origin);
  if (!match) return null;
  const project = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https://${project}(-[a-z0-9-]+)?\\.vercel\\.app$`, 'i');
}

export interface OriginCheck {
  allowed: string[];
  patterns: RegExp[];
  isAllowed: (origin: string) => boolean;
}

export function buildOriginCheck(webOrigin: string): OriginCheck {
  const allowed = parseAllowedOrigins(webOrigin);
  const patterns = allowed
    .map(vercelPreviewPattern)
    .filter((p): p is RegExp => p !== null);

  return {
    allowed,
    patterns,
    isAllowed: (origin: string) => {
      const candidate = normaliseOrigin(origin);
      return allowed.includes(candidate) || patterns.some((p) => p.test(candidate));
    },
  };
}
