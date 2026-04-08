'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Github } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useRef, useState } from 'react';

function SignInContent() {
  const searchParams = useSearchParams();
  const paramError = searchParams.get('error') as unknown as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(paramError ? `Error: ${paramError}` : '');
  const signInStarted = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGitHubSignIn = async () => {
    if (signInStarted.current) return;
    signInStarted.current = true;
    setLoading(true);
    setError('');
    try {
      await signIn('github', { callbackUrl: '/dashboard' });
    } catch {
      signInStarted.current = false;
      setError('Failed to sign in with GitHub. Please try again.');
      setLoading(false);
    }
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInStarted.current) return;
    signInStarted.current = true;
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        signInStarted.current = false;
        setError(res.error);
        setLoading(false);
      } else {
        // redirect to dashboard manually
        window.location.href = '/dashboard';
      }
    } catch {
      signInStarted.current = false;
      setError('Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Sign In</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-center text-muted-foreground text-sm mb-4">
          Welcome to TechDash. Please sign in to access your dashboard.
        </p>

        <form onSubmit={handleCredentialsSignIn} className="flex flex-col gap-3 mb-2">
          <input
            name="email"
            type="email"
            required
            placeholder="Email Address"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Sign In with Email
          </button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGitHubSignIn}
          disabled={loading}
          className="border hover:bg-gray-50/55 hover:text-black border-px rounded-xl cursor-pointer border-gray-300 inline-flex items-center justify-center text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-4 py-2 w-full"
        >
          {loading ? (
            'Connecting...'
          ) : (
            <>
              <Github className="w-6 h-6 mr-2" />
              Continue with GitHub
            </>
          )}
        </button>

        <div className="text-center mt-4 text-sm text-zinc-400">
           Need an account? <Link href="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition-colors">Register here</Link>
        </div>

        {error || paramError ? (
          <div className="text-sm text-destructive font-medium text-center mt-2">
            {error || `Error: ${paramError}`}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-center text-muted-foreground text-sm mb-4">
                Loading...
              </p>
            </CardContent>
          </Card>
        }
      >
        <SignInContent />
      </Suspense>
    </div>
  );
}
