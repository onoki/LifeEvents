import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { MinRequiredContributionsChartProps } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';

/**
 * Minimum Required Contributions Chart Component
 * Displays the minimum required monthly contributions to reach investment goals
 */
export function MinRequiredContributionsChart({ title, data, config }: MinRequiredContributionsChartProps): JSX.Element {
  return (
    <div className="bg-card border border-gray-600 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={APP_CONFIG.UI.CHART_HEIGHT}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => formatCurrency(value)}
            domain={[(dataMin) => Math.min(dataMin, 0), 'dataMax']}
            orientation="right"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value) => [formatCurrency(value as number), 'Minimum required monthly contribution']}
          />
          <Line 
            type="monotone" 
            dataKey="minRequiredContribution"
            stroke="#10b981" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
