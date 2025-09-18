import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { MinRequiredContributionsChartProps } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';

/**
 * Minimum Required Contributions Chart Component
 * Displays the minimum required monthly contributions to reach investment goals
 */
export function MinRequiredContributionsChart({ title, data }: MinRequiredContributionsChartProps): React.JSX.Element {
  // Add target line data to the main dataset
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const firstValue = data[0]?.minRequiredContribution || 0;
    const targetValue = 250;
    const targetDate = new Date('2030-08-01');
    
    // Find the last date where we have actual stock data
    let lastStockDataIndex = -1;
    for (let i = data.length - 1; i >= 0; i--) {
      const item = data[i];
      if (item?.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0) {
        lastStockDataIndex = i;
        break;
      }
    }
    const lastStockDataDate = lastStockDataIndex >= 0 ? data[lastStockDataIndex]?.date : data[0]?.date;
    
    // Create target line points only for the existing data range
    const enhancedData = data.map((item, index) => {
      let targetLineValue = null;
      let minRequiredContributionArea = null;
      let minRequiredContributionLine = null;
      
      // Calculate target line value based on linear interpolation
      if (index === 0) {
        // First point: start value
        targetLineValue = firstValue;
      } else if (item.date <= targetDate) {
        // Calculate linear interpolation from first value to target value
        const totalDays = targetDate.getTime() - data[0].date.getTime();
        const currentDays = item.date.getTime() - data[0].date.getTime();
        const progress = Math.min(currentDays / totalDays, 1); // Cap at 1
        targetLineValue = firstValue + (targetValue - firstValue) * progress;
      } else {
        // After target date: horizontal line at target value
        targetLineValue = targetValue;
      }
      
      // Split minRequiredContribution into area (with data) and line (projection)
      if (item.date <= lastStockDataDate) {
        // Up to last stock data: show as area
        minRequiredContributionArea = item.minRequiredContribution;
      } else {
        // After last stock data: show as line only
        minRequiredContributionLine = item.minRequiredContribution;
      }
      
      return {
        ...item,
        targetLine: targetLineValue,
        minRequiredContributionArea,
        minRequiredContributionLine
      };
    });
    
    return enhancedData;
  }, [data]);

  return (
    <div className="bg-card border border-gray-600 rounded-lg p-2 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={APP_CONFIG.UI.CHART_HEIGHT}>
        <AreaChart data={chartData}>
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
            formatter={(value, name) => {
              const label = name === 'minRequiredContributionArea' ? 'Minimum required monthly contribution' : 
                           name === 'minRequiredContributionLine' ? 'Minimum required monthly contribution' :
                           name === 'targetLine' ? 'Target' : 'Unknown';
              return [formatCurrency(value as number), label];
            }}
          />
          <Area 
            type="monotone" 
            dataKey="minRequiredContributionArea"
            stroke="#10b981" 
            fill="#10b981"
            fillOpacity={0.3}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#10b981' }}
          />
          <Line 
            type="monotone" 
            dataKey="minRequiredContributionLine"
            stroke="#10b981" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#10b981' }}
          />
          <Line 
            type="monotone" 
            dataKey="targetLine"
            stroke="#ef4444" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
