'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function InProgressDashboard() {
  // Mock data for in-progress features
  const features = [
    {
      id: 'feat-1',
      title: 'Dark Mode Support',
      branch: 'feature/dark-mode',
      previewUrl: 'https://dev-gilly-client.vercel.app',
      status: 'In Review',
      lastUpdated: '10 mins ago',
    },
    {
      id: 'feat-2',
      title: 'Bulk Permit Caching',
      branch: 'feature/bulk-caching',
      previewUrl: 'https://stg-gilly-client.vercel.app',
      status: 'Dev Iterating',
      lastUpdated: '2 hours ago',
    }
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">In-Progress Features</h1>
          <p className="text-slate-500">View and review Draft PRs deployed on Vercel</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(feat => (
          <Card key={feat.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">{feat.title}</CardTitle>
              <p className="text-sm font-mono text-slate-500">{feat.branch}</p>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {feat.status}
                </span>
                <span className="text-xs text-slate-400">{feat.lastUpdated}</span>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Link href={feat.previewUrl} target="_blank" className="w-full">
                  <Button variant="outline" className="w-full">View Preview</Button>
                </Link>
                <Link href={`/feature-development/in-progress/${feat.id}`} className="w-full">
                  <Button variant="default" className="w-full">Leave Feedback</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
