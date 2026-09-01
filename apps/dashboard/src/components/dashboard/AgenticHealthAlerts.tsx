'use client';

import { EvaluatorHealthClassification } from '@/lib/agentic-metrics';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface AgenticHealthBadgeProps {
  health: EvaluatorHealthClassification;
}

export function AgenticHealthBadge({ health }: AgenticHealthBadgeProps) {
  let icon = <HelpCircle className="h-4 w-4 mr-1" />;
  let label = 'WATCH';
  let tooltip = 'Insufficient data to classify evaluator health.';
  let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'secondary';
  let className = '';

  if (health.state === 'NODDING_LOOP') {
    icon = <AlertCircle className="h-4 w-4 mr-1" />;
    label = 'NODDING LOOP';
    tooltip = 'An evaluator that has never said no is proof no check exists.';
    variant = 'destructive';
  } else if (health.state === 'BLOCKED_EVALUATOR') {
    icon = <AlertTriangle className="h-4 w-4 mr-1" />;
    label = 'BLOCKED EVALUATOR';
    tooltip = 'The evaluator is rejecting almost everything (>95%). Check threshold calibration.';
    variant = 'destructive';
    className = 'bg-amber-500 hover:bg-amber-600 text-white border-transparent';
  } else if (health.state === 'HEALTHY') {
    icon = <CheckCircle className="h-4 w-4 mr-1" />;
    label = 'HEALTHY';
    tooltip = 'Evaluator rejection rate is within the healthy 15-85% band.';
    variant = 'default';
    className = 'bg-emerald-500 hover:bg-emerald-600 text-white border-transparent';
  } else if (health.state === 'WATCH') {
    icon = <HelpCircle className="h-4 w-4 mr-1" />;
    label = 'WATCH';
    tooltip = 'ERR is outside healthy band, but sample size is too small to alert.';
    variant = 'outline';
    className = 'text-muted-foreground';
  }

  return (
    <Tooltip text={tooltip}>
      <Badge variant={variant} className={`flex items-center cursor-help ${className}`}>
        {icon}
        {label}
      </Badge>
    </Tooltip>
  );
}
