'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'signin' | 'signup';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const { error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === 'signup') {
      // Depending on the project's confirmation setting the user may or may
      // not be signed in already, so say what happens next rather than
      // redirecting into a page that might reject them.
      setMessage('Account created. If confirmation is on, check your email before signing in.');
      return;
    }
    router.push('/history');
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === 'signin' ? 'Sign in' : 'Create an account'}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Only needed to keep a history.{' '}
        <Link href="/" className="text-primary hover:underline">
          Decoding works without one.
        </Link>
      </p>

      <form onSubmit={submit} className="surface mt-6 space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-failed">{error}</p> : null}
        {message ? <p className="text-sm text-primary">{message}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setMessage(null);
          }}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
