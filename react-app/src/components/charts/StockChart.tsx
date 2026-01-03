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
  progressAxisData,
  dataKey,
  config,
  conditions,
  trendAnnualGrowthRate,
  rawData
}: StockChartProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  const progressAxis = React.useMemo(() => {
    const sourceData = progressAxisData && progressAxisData.length > 0 ? progressAxisData : data;
    if (!sourceData || sourceData.length === 0) {
      return { ticks: [] as number[], entries: [] as Array<{ value: number; label: string }>, labelByValue: new Map<number, string>(), domain: [0, 0] as [number, number] };
    }

    const lastIndex = sourceData.length - 1;
    const percentSteps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const entries = percentSteps
      .map((percent) => {
        const index = Math.round((percent / 100) * lastIndex);
        const value = sourceData[index]?.targetWithFixedContribution;
        if (typeof value !== 'number' || Number.isNaN(value)) return null;
        return { value, label: `${percent} %` };
      })
      .filter((entry): entry is { value: number; label: string } => entry !== null);

    if (entries.length === 0) {
      return { ticks: [] as number[], entries: [] as Array<{ value: number; label: string }>, labelByValue: new Map<number, string>(), domain: [0, 0] as [number, number] };
    }

    const ticks = entries.map((entry) => entry.value);
    const min = Math.min(...ticks);
    const max = Math.max(...ticks);
    const labelByValue = new Map<number, string>();
    entries.forEach((entry) => {
      labelByValue.set(entry.value, entry.label);
    });
    return {
      ticks,
      entries,
      labelByValue,
      domain: [min, max] as [number, number]
    };
  }, [data, progressAxisData]);
  const rightAxisDomain = React.useMemo(() => {
    const keys: Array<keyof ChartDataPoint> = [
      'lineWithPlusOnePercentGrowth',
      'targetWithMinimumContribution',
      'lineWithTrendGrowth',
      'lineWithMinusOnePercentGrowth',
      'stocks_in_eur',
      'stocks_in_eur_adjusted_for_eunl_trend',
      'targetWithFixedContribution'
    ];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    data.forEach((item) => {
      keys.forEach((key) => {
        const value = item[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [0, 0] as [number, number];
    }
    const roundedMin = Math.floor(min / 1000) * 1000;
    const roundedMax = Math.ceil(max / 1000) * 1000;
    return [roundedMin, roundedMax] as [number, number];
  }, [data]);
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
            yAxisId="progress"
            type="number"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            ticks={progressAxis.ticks.length > 0 ? progressAxis.ticks : undefined}
            domain={rightAxisDomain}
            tickFormatter={(value) => {
              const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
              if (Number.isNaN(numericValue)) return '';
              const directLabel = progressAxis.labelByValue.get(numericValue);
              if (directLabel) return directLabel;
              let closestLabel = '';
              let closestDistance = Number.POSITIVE_INFINITY;
              progressAxis.entries.forEach((entry) => {
                const distance = Math.abs(entry.value - numericValue);
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestLabel = entry.label;
                }
              });
              return closestLabel;
            }}
            interval={0}
            width={46}
            orientation="left"
          />
          <YAxis 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => isPrivacyMode ? '•••' : `${Math.round(value / 1000)}k€`}
            domain={rightAxisDomain}
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
          {/* Anchor line for the left progress axis (invisible, same values as targetWithFixedContribution) */}
          <Line 
            type="monotone"
            dataKey="targetWithFixedContribution"
            yAxisId="progress"
            stroke="rgba(0, 0, 0, 0)"
            strokeWidth={1}
            dot={false}
            activeDot={false}
            legendType="none"
            isAnimationActive={false}
            tooltipType="none"
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
