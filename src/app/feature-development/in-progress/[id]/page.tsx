'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  HelpCircle,
  Loader2,
  Send,
  UploadCloud,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = (params.id as string).replace(/-/g, '/');

  const [feedback, setFeedback] = useState('');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [featureData, setFeatureData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch feature details from our new API (or filter from the list)
  useEffect(() => {
    async function fetchFeature() {
      try {
        const res = await fetch('/api/feature-development/active-features');
        if (res.ok) {
          const data = await res.json();
          const feat = data.features.find((f: any) => f.branch === branchId);
          setFeatureData(feat);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFeature();
  }, [branchId]);

  // Handle help modal display only on initial mount to avoid cascading renders
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('hasSeenFeedbackHelp');
    if (!hasSeenHelp) {
      // Defer the state update to the next tick to avoid the cascading render warning
      const timeout = setTimeout(() => {
        setShowHelp(true);
      }, 0);
      localStorage.setItem('hasSeenFeedbackHelp', 'true');
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSnapshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!feedback.trim() && !snapshot) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feature-development/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: branchId,
          projectId: featureData.projectId,
          feedback,
          snapshotBase64: snapshot,
        }),
      });

      if (res.ok) {
        alert('Feedback submitted successfully!');
        setFeedback('');
        setSnapshot(null);
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (err) {
      console.error(err);
      alert('Error submitting feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!featureData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-slate-950 text-white">
        <p className="text-lg">Feature branch not found.</p>
        <Button onClick={() => router.push('/feature-development/in-progress')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-50 overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-6 bg-slate-900/50 backdrop-blur-xl z-20">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-4 w-px bg-slate-800 mx-2" />
          <h1 className="text-sm font-semibold tracking-tight uppercase">
            Review: {featureData.title}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(true)}
            className="text-slate-400 hover:text-white"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            How to Review
          </Button>
          {featureData.prUrl && (
            <Link href={featureData.prUrl} target="_blank">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300"
              >
                View Pull Request
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Vercel Preview Iframe */}
        <section className="flex-1 bg-white relative">
          {featureData.previewUrl ? (
            <iframe
              src={featureData.previewUrl}
              className="w-full h-full border-none"
              title="Vercel Preview"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-900 text-slate-400">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p>Waiting for Vercel deployment...</p>
              </div>
            </div>
          )}
        </section>

        {/* Feedback Sidebar */}
        <section className="w-[350px] border-l border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col z-10 shadow-2xl">
          <div className="p-5 border-b border-slate-800">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
              Design Feedback
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Observations
              </label>
              <Textarea
                placeholder="What adjustments are needed? Be specific about colors, spacing, or logic..."
                className="bg-slate-950/50 border-slate-800 text-sm min-h-[150px] focus:ring-blue-500/20"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Visual Snapshot
              </label>

              {!snapshot ? (
                <div className="group relative border-2 border-dashed border-slate-800 rounded-xl p-8 transition-all hover:border-blue-500/50 hover:bg-blue-500/5 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                    <UploadCloud className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-300">
                      Upload Screenshot
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Drag and drop or click to browse
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={snapshot}
                    alt="Snapshot"
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setSnapshot(null)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 border-t border-slate-800 bg-slate-950/50">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest py-6"
              disabled={isSubmitting || (!feedback.trim() && !snapshot)}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit to PR
            </Button>
          </div>
        </section>
      </main>

      {/* Usage Walkthrough Modal */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              How to Review & Leave Feedback
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Follow these steps to provide high-quality visual feedback to the
              AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex shrink-0 items-center justify-center font-bold text-sm">
                1
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Inspect the Preview
                </p>
                <p className="text-xs text-slate-400">
                  Interact with the feature in the left pane. Test responsive
                  views, hover states, and logic.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex shrink-0 items-center justify-center font-bold text-sm">
                2
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Capture a Screenshot
                </p>
                <p className="text-xs text-slate-400">
                  Use your OS shortcut (e.g., <b>Cmd+Shift+4</b> on Mac) to
                  capture the specific UI component or issue.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex shrink-0 items-center justify-center font-bold text-sm">
                3
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Drag & Drop</p>
                <p className="text-xs text-slate-400">
                  Drag the screenshot file into the &quot;Visual Snapshot&quot;
                  area in the sidebar.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex shrink-0 items-center justify-center font-bold text-sm">
                4
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Describe & Submit
                </p>
                <p className="text-xs text-slate-400">
                  Add your written feedback and hit <b>Submit</b>. It will be
                  posted directly as a PR comment and notify the developers.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setShowHelp(false)}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Got it, let&apos;s go!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
