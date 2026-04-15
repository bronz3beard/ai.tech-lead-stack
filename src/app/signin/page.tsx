'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Github, Loader2, Lock, LogIn, Mail } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

function SignInContent() {
  const searchParams = useSearchParams();
  const paramError = searchParams.get('error');

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signInStarted = useRef(false);

  useEffect(() => {
    if (paramError) {
      toast.error('Authentication Error', {
        description:
          paramError === 'CredentialsSignin'
            ? 'Invalid email or password. Please try again.'
            : `Error: ${paramError}`,
      });
    }
  }, [paramError]);

  const handleGitHubSignIn = async () => {
    if (signInStarted.current) return;
    signInStarted.current = true;
    setLoading(true);

    try {
      await signIn('github', { callbackUrl: '/dashboard' });
    } catch (err) {
      signInStarted.current = false;
      setLoading(false);
      toast.error('GitHub Connection Failed', {
        description:
          'Could not initiate GitHub login. Please check your connection.',
      });
    }
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInStarted.current) return;

    setLoading(true);
    signInStarted.current = true;

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        signInStarted.current = false;
        setLoading(false);
        toast.error('Sign In Failed', {
          description:
            res.error === 'CredentialsSignin'
              ? 'Invalid email or password. Please try again.'
              : res.error,
        });
      } else {
        toast.success('Welcome Back!', {
          description: 'Authentication successful. Entering dashboard...',
        });
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      }
    } catch (err) {
      signInStarted.current = false;
      setLoading(false);
      toast.error('System Error', {
        description: 'An unexpected error occurred during sign in.',
      });
    }
  };

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/40 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-500">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20">
          <LogIn className="h-6 w-6" />
        </div>
        <CardTitle className="text-3xl font-bold text-zinc-100">
          Sign In
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Access your Interlink insights and analytics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleCredentialsSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                required
                className="bg-zinc-950/50 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-600 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-zinc-300">
                Password
              </Label>
              <Link
                href="#"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                className="bg-zinc-950/50 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-600 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 py-6 text-base font-semibold text-white hover:bg-indigo-700 transition-all active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Validating...
              </>
            ) : (
              <div className="flex items-center">
                Sign In
                <ArrowRight className="ml-2 h-5 w-5" />
              </div>
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#111113] px-2 text-zinc-500">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGitHubSignIn}
          disabled={loading}
          className="w-full border-zinc-800 bg-transparent py-6 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all active:scale-[0.98]"
        >
          <Github className="mr-2 h-5 w-5" />
          GitHub Account
        </Button>

        <div className="text-center text-sm">
          <span className="text-zinc-400">New here? </span>
          <Link
            href="/register"
            className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
          >
            Create an account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />

      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-4 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium animate-pulse">
              Initializing Auth Module...
            </p>
          </div>
        }
      >
        <SignInContent />
      </Suspense>

      <div className="absolute bottom-4 text-xs text-zinc-600 select-none">
        Identity Management System • v1.0.0
      </div>
    </div>
  );
}
