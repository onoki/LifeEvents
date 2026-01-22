import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, ReferenceDot, ReferenceLine, Label } from 'recharts';
import type { StockChartProps, ChartDataPoint } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { parseNumeric } from '../../utils/number-utils';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { APP_CONFIG } from '../../config/app-config';
import { StockValueIndicator } from './StockValueIndicator';
import { ChartLegend } from './ChartLegend';

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
  milestoneMarkers = [],
  trendAnnualGrowthRate,
  rawData
}: StockChartProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  const [isSimplified, setIsSimplified] = React.useState(false);
  const rightAxisDomain = React.useMemo(() => {
    const keys: Array<keyof ChartDataPoint> = [
      'lineWithPlusOnePercentGrowth',
      'targetWithMinimumContribution',
      'lineWithTrendGrowth',
      'lineWithMinusOnePercentGrowth',
      'stocks_in_eur',
      'stocks_in_eur_adjusted_for_eunl_trend',
      'plannedContributionLine',
      'targetWithFixedContribution'
    ];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const perKeyMax: Partial<Record<keyof ChartDataPoint, number>> = {};
    data.forEach((item) => {
      keys.forEach((key) => {
        const value = item[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
          if (perKeyMax[key] === undefined || value > perKeyMax[key]!) {
            perKeyMax[key] = value;
          }
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
  const isWithinRightAxisDomain = React.useCallback((value: number) => {
    return value >= rightAxisDomain[0] && value <= rightAxisDomain[1];
  }, [rightAxisDomain]);
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

    const [domainMin, domainMax] = rightAxisDomain;
    const visibleEntries = entries.filter((entry) => entry.value >= domainMin && entry.value <= domainMax);
    const usedEntries = visibleEntries.length > 0 ? visibleEntries : entries;
    const ticks = usedEntries.map((entry) => entry.value);
    const min = Math.min(...ticks);
    const max = Math.max(...ticks);
    const labelByValue = new Map<number, string>();
    usedEntries.forEach((entry) => {
      labelByValue.set(entry.value, entry.label);
    });
    return {
      ticks,
      entries: usedEntries,
      labelByValue,
      domain: [min, max] as [number, number]
    };
  }, [data, progressAxisData, rightAxisDomain]);
  const investmentGoal = React.useMemo(() => {
    const parsed = parseNumeric(config.investment_goal || APP_CONFIG.DEFAULTS.INVESTMENT_GOAL.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }, [config.investment_goal]);
  const shouldShowInvestmentGoalLine = investmentGoal !== null
    && investmentGoal >= rightAxisDomain[0]
    && investmentGoal <= rightAxisDomain[1];
  const trendGrowthLabel = trendAnnualGrowthRate !== null && trendAnnualGrowthRate !== undefined
    ? `${Math.round(trendAnnualGrowthRate * 100 * 10) / 10} % growth scenario (EUNL trend)`
    : 'Growth scenario (EUNL trend)';
  const plannedContributionAmount = config.planned_monthly_contribution;
  const plannedContributionUntil = config.planned_monthly_contributions_until;
  const plannedContributionDescription = isPrivacyMode
    ? 'Target trajectory to minimize the monthly contributions by contributing larger sums in the beginning until a configured date to decrease the contributions.'
    : `Target trajectory to minimize the monthly contributions by contributing larger sums (${plannedContributionAmount || 'configured amount'} €) in the beginning until ${plannedContributionUntil || 'a configured date'} to decrease the contributions.`;
  const legendItems = React.useMemo(() => ([
    {
      label: 'Percentage (left Y axis)',
      description: 'Progress to reach the savings target.',
      variant: 'note'
    },
    {
      label: 'Current value of owned stocks',
      description: 'The actual value of owned stocks.',
      color: '#3b82f6',
      variant: 'area'
    },
    {
      label: 'Current value adjusted for EUNL trend',
      description: 'The stocks adjusted to the trend of MSCI World ETF (EUNL) instead of the daily price.',
      color: '#8b5cf6',
      strokeDasharray: '5 5',
      variant: 'line'
    },
    {
      label: 'Target with fixed contributions',
      description: 'Base line target assuming fixed contributions from the first month to the last and a set annual growth. The current value of stocks should always be higher than this.',
      color: '#ef4444',
      variant: 'line'
    },
    {
      label: 'Target with minimum contributions',
      description: 'The expected trajectory of stocks value assuming the annual growth and the minimum contributions from this point forward required to reach the investment goal.',
      color: '#10b981',
      variant: 'line'
    },
    {
      label: 'n % growth scenario',
      description: 'Various possibilities if the annual growth is slightly higher or lower than the set growth.',
      color: '#06b6d4',
      variant: 'line',
      hidden: isSimplified
    },
    {
      label: 'Growth scenario (EUNL trend)',
      description: 'Scenario based on the historical trend growth of EUNL.',
      color: '#06b6d4',
      strokeDasharray: '5 5',
      variant: 'line',
      hidden: isSimplified
    },
    {
      label: 'Planned contributions path',
      description: plannedContributionDescription,
      color: '#f59e0b',
      variant: 'line'
    }
  ]), [isSimplified, plannedContributionDescription]);
  const simplifyLinesButton = (
    <button
      type="button"
      onClick={() => setIsSimplified((prev) => !prev)}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-gray-500 hover:bg-gray-700/40 ${isSimplified ? 'border-gray-500 bg-gray-700/50' : 'border-gray-600 bg-card'}`}
      aria-pressed={isSimplified}
      title="Simplify lines"
    >
      <span
        aria-hidden="true"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[10px]"
      >
        {isSimplified ? '-' : '+'}
      </span>
      Simplify lines
    </button>
  );
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
  const latestAdjustedPoint = React.useMemo(() => {
    const latestWithAdjusted = [...data]
      .reverse()
      .find((item) => typeof item.stocks_in_eur_adjusted_for_eunl_trend === 'number');
    if (!latestWithAdjusted) return null;
    return {
      x: latestWithAdjusted.dateFormatted,
      y: latestWithAdjusted.stocks_in_eur_adjusted_for_eunl_trend as number
    };
  }, [data]);
  
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
            tickFormatter={(value) => isPrivacyMode ? '•••' : `${Math.round(value / 1000)}k €`}
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
                             name === 'plannedContributionLine' ? 'Planned contributions path' :
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
          {latestAdjustedPoint !== null && isWithinRightAxisDomain(latestAdjustedPoint.y) && (
            <ReferenceLine y={latestAdjustedPoint.y} stroke="#6b7280" strokeDasharray="4 4" />
          )}
          {shouldShowInvestmentGoalLine && investmentGoal !== null && (
            <ReferenceLine y={investmentGoal} stroke="#6b7280" strokeDasharray="4 4" />
          )}
          {/* 1. 8% growth scenario (background) */}
          <Line 
            type="monotone" 
            dataKey="lineWithPlusOnePercentGrowth"
            stroke="#06b6d4" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#06b6d4' }}
            hide={isSimplified}
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
          {/* 2a. Planned contributions path */}
          <Line
            type="monotone"
            dataKey="plannedContributionLine"
            stroke="#f59e0b"
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: '#f59e0b' }}
          />
          {/* 2b. Calculated trend growth scenario */}
          <Line 
            type="monotone" 
            dataKey="lineWithTrendGrowth"
            stroke="#06b6d4" 
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 3, fill: '#06b6d4' }}
            hide={isSimplified || data.every(item => item.lineWithTrendGrowth == null)}
          />
          {milestoneMarkers
            .filter((marker) => isWithinRightAxisDomain(marker.y))
            .map((marker) => {
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
            hide={isSimplified}
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
          {latestAdjustedPoint !== null && isWithinRightAxisDomain(latestAdjustedPoint.y) && (
            <ReferenceDot
              x={latestAdjustedPoint.x}
              y={latestAdjustedPoint.y}
              r={4}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.25}
              className="pulse-ring"
            />
          )}
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
      <ChartLegend items={legendItems} controls={simplifyLinesButton} />
      
      {/* Stock Value Indicator */}
      {rawData && (
        <StockValueIndicator data={rawData} config={config} chartData={data} />
      )}
    </div>
  );
}
