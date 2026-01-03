import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, ReferenceDot, ReferenceLine, Label } from 'recharts';
import type { StockChartProps, MilestoneMarker, ChartDataPoint } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { parseNumeric } from '../../utils/number-utils';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { APP_CONFIG } from '../../config/app-config';
import { StockValueIndicator } from './StockValueIndicator';

/**
 * Stock Chart Component
 * Displays stock value progression with target lines and milestone markers
 */
export function StockChart({
  title,
  data,
  dataKey,
  config,
  conditions,
  trendAnnualGrowthRate,
  rawData
}: StockChartProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  const trendGrowthLabel = trendAnnualGrowthRate !== null && trendAnnualGrowthRate !== undefined
    ? `${Math.round(trendAnnualGrowthRate * 100 * 10) / 10} % growth scenario (EUNL trend)`
    : 'Growth scenario (EUNL trend)';
  const TooltipCursor = (props: {
    points?: Array<{ x: number; y: number }>;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    stroke?: string;
    coordinate?: { x: number; y: number };
  }) => {
    const { points, x, y, width, height, stroke, coordinate } = props;
    const cursorX = coordinate?.x ?? (points && points.length > 0 ? points[0].x : x);
    if (cursorX === undefined || width === undefined || height === undefined) return null;
    const cursorStroke = stroke || 'hsl(var(--border))';
    return (
      <g>
        <line x1={cursorX} x2={cursorX} y1={0} y2={height} stroke={cursorStroke} strokeDasharray="3 3" />
      </g>
    );
  };
  const latestAdjustedValue = React.useMemo(() => {
    const latestWithAdjusted = [...data]
      .reverse()
      .find((item) => typeof item.stocks_in_eur_adjusted_for_eunl_trend === 'number');
    return latestWithAdjusted?.stocks_in_eur_adjusted_for_eunl_trend ?? null;
  }, [data]);
  
  // Calculate milestone markers for conditions
  const milestoneMarkers: MilestoneMarker[] = [];
  if (conditions && conditions.length > 0) {
    conditions.forEach((condition) => {
      const conditionValue = parseNumeric(condition.condition || '0');
      if (!isNaN(conditionValue)) {
        const achievedPoint = data.find(item => 
          typeof item.stocks_in_eur_adjusted_for_eunl_trend === 'number' &&
          item.stocks_in_eur_adjusted_for_eunl_trend >= conditionValue
        );

        if (achievedPoint) {
          milestoneMarkers.push({
            x: achievedPoint.dateFormatted,
            y: conditionValue,
            label: condition.explanation_short || 'Unknown',
            condition: conditionValue,
            achieved: true
          });
          return;
        }

        const targetPoint = data.find(item => 
          typeof item.targetWithMinimumContribution === 'number' &&
          item.targetWithMinimumContribution >= conditionValue
        );

        if (targetPoint) {
          milestoneMarkers.push({
            x: targetPoint.dateFormatted,
            y: conditionValue,
            label: condition.explanation_short || 'Unknown',
            condition: conditionValue,
            achieved: false
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
            tickFormatter={(value) => isPrivacyMode ? '•••' : `${Math.round(value / 1000)}k€`}
            domain={[(dataMin) => Math.floor(dataMin / 1000) * 1000, (dataMax) => Math.ceil(dataMax / 1000) * 1000]}
            width={40}
            orientation="right"
          />
          {!isPrivacyMode && (
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
                color: 'hsl(var(--popover-foreground))'
              }}
              formatter={(value, name) => {
                const annualGrowthRate = parseNumeric(config.annual_growth_rate || APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE.toString());
                const label = name === 'stocks_in_eur' ? 'Current value of owned stocks' : 
                             name === 'stocks_in_eur_adjusted_for_eunl_trend' ? 'Current value adjusted for EUNL trend' :
                             name === 'targetWithFixedContribution' ? 'Target with fixed contributions' :
                             name === 'targetWithMinimumContribution' ? 'Target with minimum contributions' :
                             name === 'lineWithMinusOnePercentGrowth' ? `${Math.round((annualGrowthRate - 0.01) * 100)} % growth scenario` :
                             name === 'lineWithPlusOnePercentGrowth' ? `${Math.round((annualGrowthRate + 0.01) * 100)} % growth scenario` :
                             name === 'lineWithTrendGrowth' ? trendGrowthLabel :
                             'Unknown';
                return [formatCurrency(value as number), label];
              }}
              cursor={<TooltipCursor />}
            />
          )}
          {latestAdjustedValue !== null && (
            <ReferenceLine y={latestAdjustedValue} stroke="#6b7280" strokeDasharray="4 4" ifOverflow="extendDomain" />
          )}
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
            dot={false}
            activeDot={{ r: 3, fill: '#10b981' }}
          />
          {/* 2b. Calculated trend growth scenario */}
          <Line 
            type="monotone" 
            dataKey="lineWithTrendGrowth"
            stroke="#06b6d4" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#06b6d4' }}
            hide={data.every(item => item.lineWithTrendGrowth == null)}
          />
          {milestoneMarkers.map((marker) => {
            const color = marker.achieved ? '#10b981' : '#f59e0b';
            return (
              <ReferenceDot
                key={`milestone-${marker.x}-${marker.condition}`}
                x={marker.x}
                y={marker.y}
                r={6}
                fill={color}
                stroke="#ffffff"
                strokeWidth={2}
                ifOverflow="extendDomain"
              >
                <Label
                  value={isPrivacyMode ? 'Reward' : marker.label}
                  position="top"
                  fill={color}
                  fontSize={10}
                  fontWeight="bold"
                />
              </ReferenceDot>
            );
          })}
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
          {/* 4b. Current value adjusted for EUNL trend */}
          <Line 
            type="monotone" 
            dataKey="stocks_in_eur_adjusted_for_eunl_trend"
            stroke="#8b5cf6" 
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={true}
            connectNulls={true}
            activeDot={{ r: 3, fill: '#8b5cf6' }}
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
