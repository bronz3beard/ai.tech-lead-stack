'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ReflexionRun } from '@prisma/client';

function CopyRunIdButton({ runId }: { runId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(runId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      title="Copy Run ID"
      className="text-muted-foreground hover:text-foreground h-5 w-5 p-0"
    >
      {copied ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3" />
      )}
    </Button>
  );
}

interface ReflexionRunsTableProps {
  runs: ReflexionRun[];
}

export function ReflexionRunsTable({ runs }: ReflexionRunsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center">
        No reflexion runs recorded yet.
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Run ID</TableHead>
            <TableHead>Brief</TableHead>
            <TableHead className="text-right">Revisions</TableHead>
            <TableHead>Score Path</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const shortId = run.id.slice(-6);
            const truncatedBrief =
              run.brief.length > 50
                ? run.brief.substring(0, 47) + '...'
                : run.brief;

            let scorePathStr = 'N/A';
            if (run.stateJson && typeof run.stateJson === 'object') {
              const state = run.stateJson as any;
              const scores = state.scores || state.history?.map((h: any) => h.score);
              if (Array.isArray(scores) && scores.length > 0) {
                scorePathStr = scores.join(' → ');
              }
            }

            return (
              <TableRow key={run.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>{shortId}</span>
                    <CopyRunIdButton runId={run.id} />
                  </div>
                </TableCell>
                <TableCell className="font-medium" title={run.brief}>
                  {truncatedBrief}
                </TableCell>
                <TableCell className="text-right">{run.revision}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {scorePathStr}
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-500">
                  ${(run.costUsd || 0).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={run.status === 'PASSED' ? 'default' : 'secondary'}
                    className={
                      run.status === 'PASSED'
                        ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                        : ''
                    }
                  >
                    {run.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
