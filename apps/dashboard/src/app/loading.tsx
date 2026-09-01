import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-75"></div>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Loading Analytics</h2>
          <p className="text-sm text-muted">Fetching high-performance telemetry data...</p>
        </div>
        
        {/* Skeleton Grid */}
        <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-30 animate-pulse px-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 ring-1 ring-border/50" />
          ))}
          <div className="col-span-1 h-64 rounded-2xl bg-muted/40 ring-1 ring-border/50 sm:col-span-2 lg:col-span-3" />
        </div>
      </div>
    </div>
  );
}
