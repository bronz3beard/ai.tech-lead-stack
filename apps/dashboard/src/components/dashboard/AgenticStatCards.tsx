'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EvaluatorHealthClassification } from '@/lib/agentic-metrics';
import { Bot, User, CheckCircle, Coins } from 'lucide-react';
import { AgenticHealthBadge } from './AgenticHealthAlerts';

interface AgenticStatCardsProps {
  awr: number;
  err: number;
  health: EvaluatorHealthClassification;
  htr: number;
  costPerPassedPlan: number;
}

export function AgenticStatCards({
  awr,
  err,
  health,
  htr,
  costPerPassedPlan,
}: AgenticStatCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-card border-l-4 border-l-primary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Autonomous Work Ratio
          </CardTitle>
          <Bot className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(awr * 100).toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            Agent events / All events
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Evaluator Rejection Rate
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{(err * 100).toFixed(1)}%</div>
            <AgenticHealthBadge health={health} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Rejections / Total critiques
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Human Touchpoints
          </CardTitle>
          <User className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{htr.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Interviews / Loop run
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Cost per Passed Plan
          </CardTitle>
          <Coins className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">
            ${costPerPassedPlan.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Average across approved runs
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
