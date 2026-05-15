'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function InProgressDashboard() {
  const [features, setFeatures] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchFeatures() {
      try {
        const res = await fetch('/api/feature-development/active-features');
        if (res.ok) {
          const data = await res.json();
          setFeatures(data.features || []);
        }
      } catch (err) {
        console.error('Failed to fetch features:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFeatures();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">In-Progress Features</h1>
          <p className="text-slate-500">View and review Draft PRs deployed on Vercel</p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse h-48 bg-slate-100 border-slate-200" />
          ))}
        </div>
      ) : features.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-500">No active feature discoveries found.</p>
          <Link href="/feature-development/discovery" className="mt-4 inline-block text-blue-600 hover:underline">
            Start a new discovery session
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => (
            <Card key={feat.id} className="hover:shadow-lg transition-shadow bg-white border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-slate-900">{feat.title}</CardTitle>
                <div className="flex flex-col space-y-1">
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{feat.projectName}</p>
                  <p className="text-[10px] font-mono text-blue-500 truncate">{feat.branch}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                    feat.status === 'In Review' 
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' 
                      : feat.status === 'Discovery'
                      ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                      : 'bg-blue-50 text-blue-700 ring-blue-700/10'
                  }`}>
                    {feat.status}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{feat.lastUpdated}</span>
                </div>
                
                <div className="flex gap-2 mt-4">
                  {feat.previewUrl && (
                    <Link href={feat.previewUrl} target="_blank" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase tracking-wider border-slate-200 hover:bg-slate-50">View Preview</Button>
                    </Link>
                  )}
                  <Link href={`/feature-development/in-progress/${feat.branch.replace(/\//g, '-')}`} className="flex-1">
                    <Button variant="default" size="sm" className="w-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white shadow-sm">Review & Feedback</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
