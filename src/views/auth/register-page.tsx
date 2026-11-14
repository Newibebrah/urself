'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/layout/auth-layout';
import { createClient } from '../../../lib/supabase/client';
import { validateEmail } from '../../lib/utils';

export function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get('plan');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emailRes = validateEmail(email);
    if (!emailRes.ok) {
      setError(emailRes.error);
      return;
    }
    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailRes.value,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: name.trim() || emailRes.value.split('@')[0],
            requested_plan: selectedPlan ?? 'basic',
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        toast.success('Account created.');
        router.replace('/projects');
        router.refresh();
        return;
      }

      setNotice('Check your inbox to confirm your email, then sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-xl font-bold tracking-tighter text-slate-900">Create your workspace</h1>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        {selectedPlan
          ? `Selected plan: ${selectedPlan.toUpperCase()} · start prompting in seconds.`
          : 'Start generating React + Vite websites from prompts.'}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="register-name" className="block text-xs font-medium text-slate-700">
            Name
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ada Lovelace"
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="block text-xs font-medium text-slate-700">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            placeholder="you@company.com"
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="block text-xs font-medium text-slate-700">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Minimum 6 characters"
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          />
        </div>

        {error ? (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-xs font-medium text-emerald-700">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        <span>or continue with</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={async () => {
          try {
            const supabase = createClient();
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: `${window.location.origin}/auth/callback?next=/projects`,
              },
            });
            if (oauthError) setError(oauthError.message);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in is not configured.');
          }
        }}
        className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        Continue with Google
      </button>

      <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
        <span>
          Already have an account?{' '}
          <Link
            href="/login"
            className="rounded font-medium text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
        </span>
        <Link
          href="/"
          className="rounded font-medium text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Back to home
        </Link>
      </div>
    </AuthLayout>
  );
}
