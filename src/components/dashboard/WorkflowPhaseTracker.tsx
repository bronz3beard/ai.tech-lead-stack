'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { TraceData } from './DashboardContent';
import { useMemo } from 'react';

export function WorkflowPhaseTracker({ traces }: { traces: TraceData[] }) {
  const phases = useMemo(() => {
    const hasResearch = traces.some(t => t.name.includes('mission-architect') || t.metadata?.skillName === 'mission-architect');
    const hasPlan = traces.some(t => t.name.includes('mission-architect') || t.metadata?.skillName === 'mission-architect'); // In a real app, we'd check metadata for "Phase"
    const hasImplement = traces.some(t => 
      t.name.includes('verification-auditor') || 
      t.name.includes('remediation-orchestrator') ||
      t.metadata?.skillName === 'verification-auditor' ||
      t.metadata?.skillName === 'remediation-orchestrator'
    );

    return [
      { id: 'research', label: 'Research', status: hasResearch ? 'complete' : 'pending' },
      { id: 'plan', label: 'Plan', status: (hasResearch && hasPlan) ? 'complete' : hasResearch ? 'current' : 'pending' },
      { id: 'implement', label: 'Implement', status: hasImplement ? 'complete' : (hasResearch && hasPlan) ? 'current' : 'pending' },
    ];
  }, [traces]);

  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto py-6">
      {phases.map((phase, index) => (
        <div key={phase.id} className="flex flex-col items-center relative flex-1">
          {/* Connector Line */}
          {index < phases.length - 1 && (
            <div 
              className={`absolute top-4 left-1/2 w-full h-0.5 -z-10 ${
                phase.status === 'complete' ? 'bg-emerald-500' : 'bg-muted'
              }`} 
            />
          )}
          
          <div className="bg-background px-2">
            {phase.status === 'complete' ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            ) : phase.status === 'current' ? (
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            ) : (
              <Circle className="w-8 h-8 text-muted" />
            )}
          </div>
          
          <span className={`mt-2 text-sm font-medium ${
            phase.status === 'pending' ? 'text-muted' : 'text-foreground'
          }`}>
            {phase.label}
          </span>
        </div>
      ))}
    </div>
  );
}
