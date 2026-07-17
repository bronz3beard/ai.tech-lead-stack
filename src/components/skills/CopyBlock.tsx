'use client';

import { useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyBlockProps {
  text: string;
  label?: string;
}

export function CopyBlock({ text, label }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {label ?? 'Prompt'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          aria-label="Copy to clipboard"
          className="gap-1.5 text-slate-400 hover:text-slate-100"
        >
          {copied ? (
            <CheckCircle2 className="size-4 text-emerald-400" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-slate-200">
        {text}
      </pre>
    </div>
  );
}
