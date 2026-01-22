import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceDot, ReferenceLine } from 'recharts';
import type { MinRequiredContributionsChartProps } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { APP_CONFIG } from '../../config/app-config';
import { ChartLegend } from './ChartLegend';

/**
 * Minimum Required Contributions Chart Component
 * Displays the minimum required monthly contributions to reach investment goals
 */
export function MinRequiredContributionsChart({ title, data, config }: MinRequiredContributionsChartProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  const plannedContributionAmount = config.planned_monthly_contribution;
  const plannedContributionUntil = config.planned_monthly_contributions_until;
  const plannedContributionDescription = isPrivacyMode
    ? 'Target trajectory to minimize the monthly contributions by contributing larger sums in the beginning until a configured date to decrease the contributions.'
    : `Target trajectory to minimize the monthly contributions by contributing larger sums (${plannedContributionAmount || 'configured amount'} €) in the beginning until ${plannedContributionUntil || 'a configured date'} to decrease the contributions.`;
  const legendItems = React.useMemo(() => ([
    {
      label: 'Percentage (left Y axis)',
      description: 'Progress to reach 0 \u20AC savings target.',
      variant: 'note'
    },
    {
      label: 'Minimum required monthly contribution',
      description: 'Minimum monthly contributions until the last month to reach the investment goal, assuming the set annual growth.',
      color: '#3b82f6',
      variant: 'area'
    },
    {
      label: 'Target minimum required contribution',
      description: 'Projected minimum monthly contributions after the last recorded month to reach the investment goal.',
      color: '#10b981',
      variant: 'line'
    },
    {
      label: 'Monthly contribution adjusted for EUNL trend',
      description: 'Minimum monthly contributions adjusted to the trend of MSCI World ETF (EUNL) instead of the daily price.',
      color: '#8b5cf6',
      strokeDasharray: '5 5',
      variant: 'line'
    },
    {
      label: 'Target contribution adjusted for EUNL trend',
      description: 'Projected contributions adjusted to the EUNL trend after the last recorded month.',
      color: '#10b981',
      strokeDasharray: '5 5',
      variant: 'line'
    },
    {
      label: 'Expected estimate',
      description: 'Expected trajectory of monthly contribution requirement based on current savings.',
      color: '#06b6d4',
      variant: 'line'
    },
    {
      label: 'Target',
      description: plannedContributionDescription,
      color: '#f59e0b',
      variant: 'line'
    }
  ]), [plannedContributionDescription]);
  // Add target line data to the main dataset
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    
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
    const enhancedData = data.map((item) => {
      let targetLineValue = null;
      let minRequiredContributionArea = null;
      let minRequiredContributionLine = null;
      let minRequiredContributionAdjustedArea = null;
      let minRequiredContributionAdjustedLine = null;
      
      targetLineValue = typeof item.plannedMinRequiredContribution === 'number'
        ? item.plannedMinRequiredContribution
        : null;
      
      // Split minRequiredContribution into area (with data) and line (projection)
      // Include transition point in line to avoid gap
      if (item.date <= lastStockDataDate) {
        // Up to and including last stock data: show as area
        minRequiredContributionArea = item.minRequiredContribution;
        // Include transition point in line for continuity
        if (item.date.getTime() === lastStockDataDate.getTime()) {
          minRequiredContributionLine = item.minRequiredContribution;
        }
      } else {
        // After last stock data: show as line only
        minRequiredContributionLine = item.minRequiredContribution;
      }
      
      // Split minRequiredContributionAdjustedForEUNLTrend
      // Up to latest data: show as line (matching StockChart style)
      // After latest data: show as line (green)
      if (item.date <= lastStockDataDate) {
        // Up to and including last stock data: show as line (purple dashed, matching StockChart)
        minRequiredContributionAdjustedArea = item.minRequiredContributionAdjustedForEUNLTrend;
        // Include transition point in line for continuity
        if (item.date.getTime() === lastStockDataDate.getTime()) {
          minRequiredContributionAdjustedLine = item.minRequiredContributionAdjustedForEUNLTrend;
        }
      } else {
        // After last stock data: show as line only (green)
        minRequiredContributionAdjustedLine = item.minRequiredContributionAdjustedForEUNLTrend;
      }
      
      const result = {
        ...item,
        targetLine: targetLineValue,
        minRequiredContributionArea,
        minRequiredContributionLine,
        minRequiredContributionAdjustedArea,
        minRequiredContributionAdjustedLine
      };
      return result;
    });
    
    return enhancedData;
  }, [data]);
  const rightAxisDomain = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return [0, 0] as [number, number];
    const keys = [
      'minRequiredContributionArea',
      'minRequiredContributionLine',
      'minRequiredContributionAdjustedArea',
      'minRequiredContributionAdjustedLine',
      'targetLine',
      'expectedMinRequiredContribution'
    ] as const;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    chartData.forEach((item) => {
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
    return [min, max] as [number, number];
  }, [chartData]);
  const progressAxis = React.useMemo(() => {
    const firstValue = chartData.length > 0 ? chartData[0]?.minRequiredContribution : null;
    if (typeof firstValue !== 'number' || !Number.isFinite(firstValue) || firstValue <= 0) {
      return { ticks: [] as number[], entries: [] as Array<{ value: number; label: string }>, labelByValue: new Map<number, string>() };
    }
    const percentSteps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const entries = percentSteps.map((percent) => ({
      value: firstValue * (1 - percent / 100),
      label: `${percent} %`
    }));
    const [domainMin, domainMax] = rightAxisDomain;
    const visibleEntries = entries.filter((entry) => entry.value >= domainMin && entry.value <= domainMax);
    const usedEntries = visibleEntries.length > 0 ? visibleEntries : entries;
    const ticks = usedEntries.map((entry) => entry.value);
    const labelByValue = new Map<number, string>();
    usedEntries.forEach((entry) => {
      labelByValue.set(entry.value, entry.label);
    });
    return { ticks, entries: usedEntries, labelByValue };
  }, [chartData, rightAxisDomain]);
  const isWithinRightAxisDomain = React.useCallback((value: number) => {
    return value >= rightAxisDomain[0] && value <= rightAxisDomain[1];
  }, [rightAxisDomain]);
  const leftAnchorX = React.useMemo(() => {
    return chartData.length > 0 ? chartData[0]?.dateFormatted : null;
  }, [chartData]);
  const latestAdjustedContributionPoint = React.useMemo(() => {
    const latestWithAdjusted = [...chartData]
      .reverse()
      .find((item) => typeof item.minRequiredContributionAdjustedArea === 'number');
    if (!latestWithAdjusted) return null;
    return {
      x: latestWithAdjusted.dateFormatted,
      y: latestWithAdjusted.minRequiredContributionAdjustedArea as number
    };
  }, [chartData]);

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
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => isPrivacyMode ? '•••' : formatCurrency(value)}
            domain={rightAxisDomain}
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
                const label = name === 'minRequiredContributionArea' ? 'Minimum required monthly contribution' : 
                             name === 'minRequiredContributionLine' ? 'Target minimum required contribution' :
                             name === 'minRequiredContributionAdjustedArea' ? 'Monthly contribution adjusted for EUNL trend' :
                             name === 'minRequiredContributionAdjustedLine' ? 'Target contribution adjusted for EUNL trend' :
                             name === 'expectedMinRequiredContribution' ? 'Expected estimate' :
                             name === 'targetLine' ? 'Target' : 'Unknown';
                return [formatCurrency(value as number), label];
              }}
            />
          )}
          {latestAdjustedContributionPoint !== null
            && leftAnchorX
            && isWithinRightAxisDomain(latestAdjustedContributionPoint.y) && (
            <ReferenceLine
              segment={[
                { x: leftAnchorX, y: latestAdjustedContributionPoint.y },
                { x: latestAdjustedContributionPoint.x, y: latestAdjustedContributionPoint.y }
              ]}
              stroke="#6b7280"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
          )}
          <Area 
            type="monotone" 
            dataKey="minRequiredContributionArea"
            stroke="#3b82f6" 
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#3b82f6' }}
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
            dataKey="minRequiredContributionAdjustedArea"
            stroke="#8b5cf6" 
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={true}
            activeDot={{ r: 3, fill: '#8b5cf6' }}
          />
          {latestAdjustedContributionPoint !== null && (
            <ReferenceDot
              x={latestAdjustedContributionPoint.x}
              y={latestAdjustedContributionPoint.y}
              r={4}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.25}
              ifOverflow="extendDomain"
              className="pulse-ring"
            />
          )}
          <Line 
            type="monotone" 
            dataKey="minRequiredContributionAdjustedLine"
            stroke="#10b981" 
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 3, fill: '#10b981' }}
          />
          <Line 
            type="monotone"
            dataKey="expectedMinRequiredContribution"
            stroke="#06b6d4"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#06b6d4' }}
          />
          <Line 
            type="monotone" 
            dataKey="targetLine"
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#f59e0b' }}
          />
          <Line 
            type="monotone"
            dataKey="minRequiredContributionArea"
            yAxisId="progress"
            stroke="rgba(0, 0, 0, 0)"
            strokeWidth={1}
            dot={false}
            activeDot={false}
            legendType="none"
            isAnimationActive={false}
            tooltipType="none"
          />
        </AreaChart>
      </ResponsiveContainer>
      <ChartLegend items={legendItems} />
    </div>
  );
}
