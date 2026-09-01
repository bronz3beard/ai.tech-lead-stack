'use client';

import { AgenticHealthSummary } from '@/app/dashboard/agentic-health-loader';
import { AgenticStatCards } from './AgenticStatCards';
import { AgenticCharts } from './AgenticCharts';
import { ReflexionRunsTable } from './ReflexionRunsTable';

interface AgenticHealthSectionProps {
  summary: AgenticHealthSummary;
}

export function AgenticHealthSection({ summary }: AgenticHealthSectionProps) {
  return (
    <div className="space-y-6 pt-4 border-t mt-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Agentic Health
        </h2>
        <p className="text-muted-foreground text-sm">
          Metrics and telemetry specifically scoped to autonomous agent activity and reflexion loops.
        </p>
      </div>

      <AgenticStatCards
        awr={summary.autonomousWorkRatio}
        err={summary.evaluatorRejectionRate}
        health={summary.evaluatorHealth}
        htr={summary.humanTouchpointsPerRun}
        costPerPassedPlan={summary.costPerPassedPlan}
      />

      <AgenticCharts
        weeklyAWR={summary.weeklyAWR}
        err={summary.evaluatorRejectionRate}
        health={summary.evaluatorHealth}
      />

      <div className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight">Reflexion Runs</h3>
        <ReflexionRunsTable runs={summary.runs} />
      </div>
    </div>
  );
}
