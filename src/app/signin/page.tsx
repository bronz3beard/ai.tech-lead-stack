'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Github } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const paramError = searchParams.get('error') as unknown as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(`Error: ${paramError}` || '');

  const handleGitHubSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn('github', { callbackUrl: '/dashboard' });
    } catch (err) {
      setError('Failed to sign in with GitHub. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Sign In</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-center text-muted-foreground text-sm mb-4">
            Welcome to TechDash. Please sign in with your GitHub account to
            access your dashboard.
          </p>

          <button
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

          {error || paramError ? (
            <div className="text-sm text-destructive font-medium text-center mt-2">
              {error || `Error: ${paramError}`}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
