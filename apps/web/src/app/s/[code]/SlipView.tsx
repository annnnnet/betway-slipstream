'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2, Repeat2 } from 'lucide-react';
import { useConvertSlip, useSlip } from '@/hooks/use-slips';
import { SlipCard } from '@/components/slip/SlipCard';
import { VerificationPanel } from '@/components/slip/VerificationPanel';
import { ErrorState } from '@/components/states/ErrorState';
import { Spinner } from '@/components/states/Spinner';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { CodeInput } from '@/components/slip/CodeInput';

export function SlipView({ code }: { code: string }) {
  const { data, isPending, error } = useSlip(code);
  const convert = useConvertSlip();

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Decode another
        </Link>
      </div>

      {isPending ? <Spinner label={`Loading ${code} from Betway…`} /> : null}

      {error ? (
        <>
          <ErrorState
            error={error}
            action={
              <ButtonLink href="/" variant="secondary">
                Try another code
              </ButtonLink>
            }
          />
          <CodeInput />
        </>
      ) : null}

      {data ? (
        <>
          <SlipCard
            slip={data.slip}
            actions={
              // Converting is the one action that changes anything, so it is
              // the only primary button on this screen.
              <Button
                onClick={() => convert.mutate(data.slip.code)}
                disabled={convert.isPending}
              >
                {convert.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Repeat2 className="size-4" />
                )}
                {convert.isPending ? 'Re-booking on Betway…' : 'Convert to a new code'}
              </Button>
            }
          />

          {convert.error ? <ErrorState error={convert.error} /> : null}

          {convert.data ? (
            <>
              {/* Betway's encoder is deterministic on the ordered outcome
                  list, so re-booking a slip's own legs in their own order
                  legitimately returns the code we started from. Presenting
                  that as a shiny "new code" would be a lie the user could
                  catch in two seconds. */}
              {convert.data.reusedSourceCode ? (
                <div className="surface border-primary/30 bg-primary/5 px-4 py-3.5 text-sm">
                  <p className="font-medium">Betway returned the same code.</p>
                  <p className="mt-1 text-muted-foreground">
                    Their encoder is deterministic on the ordered list of selections, so
                    re-booking this slip&apos;s legs in this order maps back to{' '}
                    <code className="font-mono">{convert.data.converted.code}</code>. The bet is
                    unchanged and the code below is still valid — there was simply no new one
                    to mint.
                  </p>
                </div>
              ) : (
                <SlipCard slip={convert.data.converted} label="Converted slip" />
              )}

              <VerificationPanel verification={convert.data.verification} />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
