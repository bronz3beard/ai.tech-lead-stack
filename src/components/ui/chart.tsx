'use client';

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
  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsBarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#94a3b8"
          fontSize={18}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#94a3b8"
          fontSize={14}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: 'none',
            borderRadius: '8px',
            color: '#f8fafc',
          }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

export function LineChart({
  data,
}: {
  data: { name: string; total: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsLineChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#334155"
        />
        <XAxis
          dataKey="name"
          stroke="#94a3b8"
          fontSize={16}
          tickLine={false}
          axisLine={false}
          padding={{ left: 10, right: 10 }}
        />
        <YAxis
          stroke="#94a3b8"
          fontSize={14}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: 'none',
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
          dot={{ r: 4, fill: '#60a5fa' }}
          activeDot={{ r: 6 }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
