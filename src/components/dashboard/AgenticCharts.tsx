'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { EvaluatorHealthClassification } from '@/lib/agentic-metrics';

interface AgenticChartsProps {
  weeklyAWR: { date: string; awr: number }[];
  err: number;
  health: EvaluatorHealthClassification;
}

export function AgenticCharts({ weeklyAWR, err, health }: AgenticChartsProps) {
  const errData = [{ name: 'Current Period', value: err * 100 }];

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Autonomous Work Ratio Trend
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Weekly percentage of autonomous agent work
          </p>
        </CardHeader>
        <CardContent className="h-[300px]">
          {weeklyAWR.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyAWR} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`, 'AWR']}
                  labelFormatter={(label) => `Week of ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="awr"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  aria-label="AWR Trend Line"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Evaluator Rejection Band
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Healthy zone is between 15% and 85%
          </p>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={errData}
              margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'ERR']} />

              {/* Healthy Band Shading */}
              <ReferenceArea
                y1={15}
                y2={85}
                fill="#22c55e"
                fillOpacity={0.1}
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />
              <ReferenceArea
                y1={0}
                y2={15}
                fill="#ef4444"
                fillOpacity={0.05}
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />
              <ReferenceArea
                y1={85}
                y2={100}
                fill="#eab308"
                fillOpacity={0.05}
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />

              <Line
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={0}
                dot={{ r: 8, fill: health.state === 'NODDING_LOOP' ? '#ef4444' : health.state === 'BLOCKED_EVALUATOR' ? '#eab308' : '#10b981' }}
                aria-label="Current ERR"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
