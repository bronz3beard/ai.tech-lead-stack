'use client';

import { DesignResourcePanel } from '@/components/design-review/DesignResourcePanel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HelpCircle } from 'lucide-react';
import { FeatureDevelopmentGuidePanel } from './FeatureDevelopmentGuidePanel';

interface FeatureDevelopmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  figmaUrl?: string;
  chromaticUrl?: string;
}

/**
 * @desc Modal that displays the Design Resource Panel and the Feature Development Guide.
 */
export function FeatureDevelopmentModal({
  isOpen,
  onClose,
  figmaUrl,
  chromaticUrl,
}: FeatureDevelopmentModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] bg-zinc-950 border-zinc-800 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <DialogTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-900/30 border border-violet-700/40">
              <HelpCircle className="h-4 w-4 text-violet-400" />
            </div>
            Feature Development Guide
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-y-auto p-6 scrollbar-hide space-y-2">
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Welcome to the autonomous feature development pipeline. This guide
            helps you navigate the discovery and generation phases.
          </p>

          <DesignResourcePanel
            figmaUrl={figmaUrl}
            chromaticUrl={chromaticUrl}
          />

          <FeatureDevelopmentGuidePanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}
