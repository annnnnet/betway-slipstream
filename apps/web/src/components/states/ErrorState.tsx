import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { ApiError } from '@/lib/api';

/**
 * Error copy is driven by the API's error `code`, never by the HTTP status.
 * "Invalid code" and "selections expired" are both a 4xx from Betway but mean
 * opposite things to the person holding the code — one is a typo they can fix,
 * the other is a slip that has aged out and no amount of retyping will help.
 */
export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const { title, detail } = describe(error);

  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertCircle className="size-8 text-failed" />
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function describe(error: unknown): { title: string; detail: string } {
  if (!(error instanceof ApiError)) {
    return {
      title: 'Something went wrong',
      detail: 'An unexpected error stopped that from working. Try again.',
    };
  }

  switch (error.code) {
    case 'INVALID_CODE':
      return {
        title: 'Betway does not know that code',
        detail: 'Check for a mistyped character — codes are letters and digits only.',
      };
    case 'SLIP_EMPTY':
      return {
        title: 'That slip is empty',
        detail: 'The code is real, but there are no selections left on it.',
      };
    case 'OUTCOME_UNAVAILABLE':
      return {
        title: 'These selections have expired',
        detail: 'The events on this slip have already started, so it cannot be re-booked.',
      };
    case 'UPSTREAM_UNAVAILABLE':
      return {
        title: 'Betway is not answering',
        detail: 'This one is on their side rather than ours. Give it a moment and try again.',
      };
    default:
      return { title: 'Something went wrong', detail: error.message };
  }
}
