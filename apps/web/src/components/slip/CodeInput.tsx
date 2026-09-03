'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Booking codes arrive from WhatsApp, Telegram and screenshots, so the input
 * accepts whatever shape they come in — surrounding whitespace, lower case,
 * and the "Code: BW1234" prefix people paste along with them — and normalises
 * rather than rejecting. Making a user hand-clean a pasted string is the
 * fastest way to lose them on the first screen.
 */
export function normaliseCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^(BOOKING\s*)?CODE[:\s]+/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function CodeInput({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const code = normaliseCode(value);
  const tooShort = code.length > 0 && code.length < 4;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code.length < 4) return;
    router.push(`/s/${code}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="surface flex items-center gap-2 p-2 focus-within:ring-2 focus-within:ring-ring">
        <Search className="ml-2 size-5 shrink-0 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          // Codes are case-insensitive and alphanumeric; turning off the
          // phone keyboard's helpfulness stops it "correcting" them.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Betway booking code"
          placeholder="Paste a booking code, e.g. BW6E15DE93"
          className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-base tracking-widest outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={code.length < 4} className="shrink-0">
          Decode
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <p className="mt-2 h-4 text-xs text-muted-foreground">
        {tooShort ? 'That is too short to be a booking code.' : null}
      </p>
    </form>
  );
}
