import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from 'recharts';
import type { StockChartProps, MilestoneMarker } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';
import { StockValueIndicator } from './StockValueIndicator';

/**
 * Stock Chart Component
 * Displays stock value progression with target lines and milestone markers
 */
export function StockChart({ title, data, dataKey, config, conditions, rawData }: StockChartProps): React.JSX.Element {
  // Calculate milestone markers for conditions
  const milestoneMarkers: MilestoneMarker[] = [];
  if (conditions && conditions.length > 0) {
    conditions.forEach((condition) => {
      const conditionValue = parseFloat(condition.condition || '0');
      if (!isNaN(conditionValue)) {
        // Find the first data point where targetWithMinimumContribution exceeds the condition
        const milestonePoint = data.find(item => 
          item.targetWithMinimumContribution && 
          item.targetWithMinimumContribution >= conditionValue
        );
        
        if (milestonePoint && milestonePoint.targetWithMinimumContribution) {
          milestoneMarkers.push({
            x: milestonePoint.dateFormatted,
            y: milestonePoint.targetWithMinimumContribution,
            label: condition.explanation_short || 'Unknown',
            condition: conditionValue
          });
        }
      }
    });
  }
  
  return (
    <div className="bg-card border border-gray-600 rounded-lg p-2 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={APP_CONFIG.UI.CHART_HEIGHT}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => `${Math.round(value / 1000)}k€`}
            domain={[(dataMin) => Math.floor(dataMin / 1000) * 1000, (dataMax) => Math.ceil(dataMax / 1000) * 1000]}
            width={40}
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
              const annualGrowthRate = parseFloat(config.annual_growth_rate || APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE.toString());
              const label = name === 'stocks_in_eur' ? 'Current value of owned stocks' : 
                           name === 'targetWithFixedContribution' ? 'Target with fixed contributions' :
                           name === 'targetWithMinimumContribution' ? 'Target with minimum contributions' :
                           name === 'lineWithMinusOnePercentGrowth' ? `${Math.round((annualGrowthRate - 0.01) * 100)} % growth scenario` :
                           name === 'lineWithPlusOnePercentGrowth' ? `${Math.round((annualGrowthRate + 0.01) * 100)} % growth scenario` :
                           'Unknown';
              return [formatCurrency(value as number), label];
            }}
          />
          {/* 1. 8% growth scenario (background) */}
          <Line 
            type="monotone" 
            dataKey="lineWithPlusOnePercentGrowth"
            stroke="#06b6d4" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#06b6d4' }}
          />
          {/* 2. Target with minimum contributions */}
          <Line 
            type="monotone" 
            dataKey="targetWithMinimumContribution"
            stroke="#10b981" 
            strokeWidth={1}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const milestone = milestoneMarkers.find(m => m.x === payload.dateFormatted);
              
              if (milestone) {
                return (
                  <g key={`milestone-${milestone.x}-${milestone.condition}`}>
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={6} 
                      fill="#f59e0b" 
                      stroke="#ffffff" 
                      strokeWidth={2}
                    />
                    <text 
                      x={cx} 
                      y={cy - 15} 
                      textAnchor="middle" 
                      fill="#f59e0b" 
                      fontSize="10" 
                      fontWeight="bold"
                    >
                      {milestone.label}
                    </text>
                  </g>
                );
              }
              return <circle key={`empty-${cx}-${cy}`} cx={cx} cy={cy} r={0} fill="transparent" />;
            }}
            activeDot={{ r: 3, fill: '#10b981' }}
          />
          {/* 3. 6% growth scenario */}
          <Line 
            type="monotone" 
            dataKey="lineWithMinusOnePercentGrowth"
            stroke="#06b6d4" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#06b6d4' }}
          />
          {/* 4. Current value of owned stocks */}
          <Area 
            type="monotone" 
            dataKey={dataKey}
            stroke="#3b82f6" 
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#3b82f6' }}
          />
          {/* 5. Target with fixed contributions (foreground) */}
          <Line 
            type="monotone" 
            dataKey="targetWithFixedContribution"
            stroke="#ef4444" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#ef4444' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Stock Value Indicator */}
      {rawData && (
        <StockValueIndicator data={rawData} config={config} chartData={data} />
      )}
    </div>
  );
}
