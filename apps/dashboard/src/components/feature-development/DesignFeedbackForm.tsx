'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function DesignFeedbackForm({ featureId, branch }: { featureId: string, branch: string }) {
  const [feedback, setFeedback] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotData, setSnapshotData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const captureSnapshot = async () => {
    setIsCapturing(true);
    try {
      // Lazy load to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { useCORS: true });
      const base64Image = canvas.toDataURL('image/png');
      setSnapshotData(base64Image);
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
      alert('Could not capture screen. You can still submit text feedback.');
    } finally {
      setIsCapturing(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedback && !snapshotData) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feature-development/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureId,
          branch,
          feedback,
          snapshotBase64: snapshotData
        })
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      alert('Feedback submitted to Draft PR successfully!');
      setFeedback('');
      setSnapshotData(null);
    } catch (err) {
      console.error(err);
      alert('Error submitting feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border rounded-md bg-white shadow-sm">
      <h3 className="font-semibold text-lg">Leave Feedback</h3>
      
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          onClick={captureSnapshot} 
          disabled={isCapturing}
        >
          {isCapturing ? 'Capturing...' : '📸 Capture UI Snapshot'}
        </Button>
        {snapshotData && (
          <span className="text-sm text-green-600 flex items-center">
            ✓ Snapshot attached
            <Button variant="ghost" size="sm" className="ml-2 text-red-500" onClick={() => setSnapshotData(null)}>
              Remove
            </Button>
          </span>
        )}
      </div>

      <Textarea
        placeholder="Describe what needs to be changed..."
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        rows={4}
      />

      <Button onClick={submitFeedback} disabled={isSubmitting || (!feedback && !snapshotData)}>
        {isSubmitting ? 'Submitting to GitHub...' : 'Submit to Draft PR'}
      </Button>
    </div>
  );
}
