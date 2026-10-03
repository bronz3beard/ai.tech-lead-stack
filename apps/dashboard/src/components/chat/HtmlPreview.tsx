'use client';

import { useState, type ReactNode } from 'react';

/**
 * Model output is untrusted. Two independent layers keep the preview static:
 * `sandbox=""` withholds every permission (no scripts, forms, popups, top
 * navigation or same-origin access), and this CSP blocks all network
 * requests, so a visual cannot load remote content or beacon out. Only inline
 * styles and data: images are allowed, which is all the show-it static HTML
 * contract needs.
 */
const PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

export function buildPreviewDocument(html: string): string {
  const body = html.replace(/^\s*<!doctype[^>]*>/i, '');
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">${body}`;
}

interface HtmlPreviewProps {
  html: string;
  /** The source view, shown by default. */
  children: ReactNode;
}

export default function HtmlPreview({ html, children }: HtmlPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="my-6">
      <div className="flex gap-1 mb-2" role="group" aria-label="HTML view">
        <ViewToggle pressed={!showPreview} onClick={() => setShowPreview(false)}>
          Source
        </ViewToggle>
        <ViewToggle pressed={showPreview} onClick={() => setShowPreview(true)}>
          Preview
        </ViewToggle>
      </div>
      {showPreview ? (
        <div className="h-96 resize-y overflow-hidden rounded-xl border border-white/10 bg-white">
          <iframe
            title="HTML visual preview"
            sandbox=""
            srcDoc={buildPreviewDocument(html)}
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
          />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function ViewToggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-white/10 aria-pressed:bg-white/10 aria-pressed:text-white transition-colors"
    >
      {children}
    </button>
  );
}
