import type { ApiErrorBody, ErrorCode } from '@slipstream/shared';
import { supabase } from './supabase';

// NEXT_PUBLIC_* values are inlined at build time, so a missing one cannot be
// recovered at runtime — and left unchecked it produces requests to
// `undefined/api/...`, which resolve against the web origin and 404. The app
// then renders perfectly while every call fails, which reads as a broken
// product rather than a misconfigured deploy. Fail loudly instead.
const BASE = process.env.NEXT_PUBLIC_API_URL;
if (!BASE) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. Set it to the API origin (no trailing ' +
      'slash, no /api suffix) and rebuild — it is baked in at build time, so ' +
      'changing the variable without redeploying has no effect.',
  );
}

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Everything works signed-out; a token is attached only so the action can
  // be filed under an account. A failure to read the session must therefore
  // never block the request.
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  } catch {
    /* anonymous is a perfectly good state here */
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('INTERNAL', 'Could not reach the server. Check your connection and try again.', 0);
  }

  if (!res.ok) {
    // A non-JSON body means the response did not come from our API at all — a
    // proxy's HTML error page, a gateway timeout. Falling back to a domain
    // error code there would make callers that branch on it misreport an
    // infrastructure failure as a bad booking code.
    const payload = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      payload?.code ?? 'INTERNAL',
      payload?.message ?? res.statusText,
      res.status,
      payload?.details,
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b?: unknown) => request<T>('POST', p, b),
};
