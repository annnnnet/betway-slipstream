'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { Slip } from '@slipstream/shared';
import { Button } from '@/components/ui/button';
import { ButtonAnchor } from '@/components/ui/button-link';

/**
 * The booking code itself, presented as the artefact it is: the one string the
 * user will paste into Betway, read out over the phone, or send to a friend.
 *
 * Both of the things anyone wants to do with it — copy it, open it on Betway —
 * are one tap away and never behind a menu.
 */
export function CodeBadge({ slip }: { slip: Pick<Slip, 'code' | 'betwayUrl'> }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(slip.code);
      setCopied(true);
      // Long enough to register as feedback, short enough that the button is
      // back to its normal affordance before the user looks again.
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (insecure context, denied permission) — the code is
         selectable on screen either way, so there is nothing useful to say */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="booking-code select-all text-primary">{slip.code}</code>

      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" onClick={copy} aria-label="Copy booking code">
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>

        {/* noreferrer as well as noopener: this is an outbound link to a
            bookmaker and there is no reason to hand them our referrer. */}
        <ButtonAnchor
          href={slip.betwayUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          size="sm"
        >
          <ExternalLink className="size-4" />
          Open on Betway
        </ButtonAnchor>
      </div>
    </div>
  );
}
