import Link from 'next/link';
import { ArrowRight, BadgeCheck, Repeat2, ScanLine } from 'lucide-react';
import { CodeInput } from '@/components/slip/CodeInput';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      <div className="text-center">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">Betway Nigeria</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          See what is actually on that booking code
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-balance text-muted-foreground">
          Paste a code to read every leg, market and price before you stake anything. Build a
          new slip, convert an old one, and check the result on Betway itself.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-xl">
        <CodeInput autoFocus />
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        <Feature
          icon={<ScanLine className="size-5" />}
          title="Decode"
          body="Every selection, market, kickoff time and price behind a code — including the legs that have already died."
        />
        <Feature
          icon={<Repeat2 className="size-5" />}
          title="Build & convert"
          body="Pick from Betway's live markets to mint a fresh code, or re-book an existing slip as a new one."
        />
        <Feature
          icon={<BadgeCheck className="size-5" />}
          title="Verified, not asserted"
          body="Every code we generate is loaded back off Betway and diffed against the bet you asked for."
        />
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/build"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Build a slip from scratch
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="surface p-5">
      <div className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </div>
      <h2 className="mt-3 font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
