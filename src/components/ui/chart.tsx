'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  Line,
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const DEFAULT_COLORS = [
  '#60a5fa', // Soft Blue
  '#34d399', // Soft Green
  '#a78bfa', // Soft Purple
  '#fb923c', // Soft Orange
  '#f472b6', // Soft Pink
  '#2dd4bf', // Soft Teal
  '#818cf8', // Soft Indigo
];

export function BarChart({
  data,
  colors = DEFAULT_COLORS,
}: {
  data: { name: string; total: number }[];
  colors?: string[];
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="w-full aspect-[4/3] min-h-[350px] bg-slate-900/10 animate-pulse rounded-lg" />;
  }

  return (
    <div className="w-full aspect-[4/3] min-h-[350px] relative overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
          <XAxis
            dataKey="name"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
            dx={-10}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
            }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={32}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart({
  data,
}: {
  data: { name: string; total: number }[];
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="w-full aspect-[4/3] min-h-[350px] bg-slate-900/10 animate-pulse rounded-lg" />;
  }

  return (
    <div className="w-full aspect-[4/3] min-h-[350px] relative overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#334155"
          />
          <XAxis
            dataKey="name"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            padding={{ left: 10, right: 10 }}
            angle={-45}
            textAnchor="end"
            height={80}
            dx={-10}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
            }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 4, fill: '#60a5fa', strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
