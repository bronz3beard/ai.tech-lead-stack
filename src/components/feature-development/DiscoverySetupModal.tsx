'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface DiscoverySetupModalProps {
  isOpen: boolean;
  onComplete: (data: {
    componentName?: string;
    figmaUrl?: string;
    branchUrl?: string;
    localEnv?: string;
  }) => void;
}

/**
 * @desc Optional setup modal for Feature Discovery.
 * Captures Figma URL, Branch URL, and Component Name to provide context to the agent.
 */
export function DiscoverySetupModal({
  isOpen,
  onComplete,
}: DiscoverySetupModalProps) {
  const [componentName, setComponentName] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [branchUrl, setBranchUrl] = useState('');
  const [localEnv, setLocalEnv] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Slight delay for premium feel
    setTimeout(() => {
      onComplete({
        componentName: componentName.trim() || undefined,
        figmaUrl: figmaUrl.trim() || undefined,
        branchUrl: branchUrl.trim() || undefined,
        localEnv: localEnv.trim() || undefined,
      });
      setIsSubmitting(false);
    }, 600);
  };

  const handleSkip = () => {
    onComplete({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <DialogTitle className="text-lg font-bold text-zinc-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-900/30 border border-violet-700/40">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            Initialize Discovery
          </DialogTitle>
          <p className="text-xs text-zinc-500 mt-1.5">
            Provide existing resources to help the agent align with your current
            designs and codebase.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="component-name"
                className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold"
              >
                Feature / Component Name
              </Label>
              <Input
                id="component-name"
                placeholder="e.g. Analytics Dashboard, User Profile"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus:ring-violet-500/20 focus:border-violet-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="figma-url"
                className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold"
              >
                Figma Design URL{' '}
                <span className="text-zinc-700 font-normal ml-1">
                  (Optional)
                </span>
              </Label>
              <Input
                id="figma-url"
                type="url"
                placeholder="https://www.figma.com/file/..."
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus:ring-violet-500/20 focus:border-violet-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="branch-url"
                className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold"
              >
                Existing Branch URL{' '}
                <span className="text-zinc-700 font-normal ml-1">
                  (Optional)
                </span>
              </Label>
              <Input
                id="branch-url"
                type="url"
                placeholder="https://github.com/.../tree/..."
                value={branchUrl}
                onChange={(e) => setBranchUrl(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus:ring-violet-500/20 focus:border-violet-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="local-env"
                className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center justify-between"
              >
                <span>
                  LOCAL .ENV{' '}
                  <span className="text-zinc-700 font-normal ml-1">
                    (OPTIONAL)
                  </span>
                </span>
              </Label>
              <p className="text-[11px] text-zinc-500">
                Paste your local environment variables to run the app in the sandbox.
              </p>
              <Textarea
                id="local-env"
                placeholder="NEXT_PUBLIC_API_URL=...\nDB_HOST=..."
                value={localEnv}
                onChange={(e) => setLocalEnv(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus:ring-violet-500/20 focus:border-violet-500/50 font-mono text-xs min-h-[80px]"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="flex-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            >
              Skip
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-violet-700 hover:bg-violet-600 text-white shadow-lg shadow-violet-900/20"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Start Discovery'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
