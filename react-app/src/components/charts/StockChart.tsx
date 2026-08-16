import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, ReferenceDot, ReferenceLine, Label } from 'recharts';
import type { StockChartProps, ChartDataPoint, MilestoneMarker } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { parseNumeric } from '../../utils/number-utils';
import {
  formatPrivacyAwareDateTick,
  PRIVACY_DATE_MASK,
  PRIVACY_RATE_MASK,
  PRIVACY_VALUE_MASK
} from '../../utils/privacy-utils';
import { parseLocalCalendarDate } from '../../utils/date-utils';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { APP_CONFIG } from '../../config/app-config';
import { StockValueIndicator } from './StockValueIndicator';
import { ChartLegend } from './ChartLegend';
import type { LegendItem } from './ChartLegend';

const GROWTH_PLUS_COLOR = '#06b6d4';
const GROWTH_MINUS_COLOR = '#67e8f9';
const INDEX_MIN_COLOR = '#0284c7';
const INDEX_PLANNED_COLOR = '#38bdf8';

const formatAnnualRate = (rate: number): string =>
  `${Math.round(rate * 1000) / 10} %`;

const parseAnnualRate = (value: string | undefined, fallback: number): number => {
  const parsed = parseNumeric(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const STOCK_VALUE_KEYS: Array<keyof ChartDataPoint> = [
  'lineWithPlusOnePercentGrowth',
  'targetWithMinimumContribution',
  'lineWithTrendGrowth',
  'lineWithTrendGrowthAndPlannedContribution',
  'growthOnlyGoalLine',
  'lineWithMinusOnePercentGrowth',
  'stocks_in_eur',
  'stocks_in_eur_adjusted_for_eunl_trend',
  'plannedContributionLine',
  'targetWithFixedContribution'
];

export interface StockChartDomainState {
  domain: [number, number];
  visibleMilestoneMarkers: MilestoneMarker[];
}

/**
 * Build the Y domain from the displayed series and only those milestone markers
 * whose categorical X value is present in the displayed data range.
 */
export const calculateStockChartDomain = (
  data: ChartDataPoint[],
  milestoneMarkers: MilestoneMarker[]
): StockChartDomainState => {
  const visibleXValues = new Set(data.map((item) => item.dateFormatted));
  const visibleMilestoneMarkers = milestoneMarkers.filter((marker) =>
    visibleXValues.has(marker.x)
    && Number.isFinite(marker.y)
  );
  const values: number[] = [];

  data.forEach((item) => {
    STOCK_VALUE_KEYS.forEach((key) => {
      const value = item[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        values.push(value);
      }
    });
  });
  visibleMilestoneMarkers.forEach((marker) => values.push(marker.y));

  if (values.length === 0) {
    return { domain: [0, 0], visibleMilestoneMarkers };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (visibleMilestoneMarkers.length > 0) {
    const span = max - min;
    const padding = Math.max(
      span * 0.05,
      Math.max(Math.abs(min), Math.abs(max)) * 0.01,
      1000
    );
    min -= padding;
    max += padding;
  }

  return {
    domain: [
      Math.floor(min / 1000) * 1000,
      Math.ceil(max / 1000) * 1000
    ],
    visibleMilestoneMarkers
  };
};

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
  const {
    domain: rightAxisDomain,
    visibleMilestoneMarkers
  } = React.useMemo(
    () => calculateStockChartDomain(data, milestoneMarkers),
    [data, milestoneMarkers]
  );
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
  const nearTermGrowthRate = parseAnnualRate(
    config.annual_growth_rate_near_term,
    APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE_NEAR_TERM
  );
  const longTermGrowthRate = parseAnnualRate(
    config.annual_growth_rate_long_term,
    APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE_LONG_TERM
  );
  const nearTermGrowthLabel = isPrivacyMode
    ? PRIVACY_RATE_MASK
    : formatAnnualRate(nearTermGrowthRate);
  const longTermGrowthLabel = isPrivacyMode
    ? PRIVACY_RATE_MASK
    : formatAnnualRate(longTermGrowthRate);
  const hasValidTrendRate = typeof trendAnnualGrowthRate === 'number'
    && Number.isFinite(trendAnnualGrowthRate);
  const trendRateLabel = hasValidTrendRate
    ? (isPrivacyMode ? PRIVACY_RATE_MASK : formatAnnualRate(trendAnnualGrowthRate))
    : null;
  const trendGrowthLabel = trendRateLabel
    ? `${trendRateLabel} index + min`
    : 'Index growth + min';
  const trendGrowthWithPlannedLabel = trendRateLabel
    ? `${trendRateLabel} index + planned`
    : 'Index growth + planned';
  const plannedContributionAmount = config.planned_monthly_contribution;
  const plannedContributionUntil = config.planned_monthly_contributions_until;
  const parsedPlannedUntil = plannedContributionUntil
    ? parseLocalCalendarDate(plannedContributionUntil)
    : null;
  const hasValidPlannedUntil = parsedPlannedUntil !== null
    && !Number.isNaN(parsedPlannedUntil.getTime());
  const cutoffLabel = isPrivacyMode
    ? PRIVACY_DATE_MASK
    : plannedContributionUntil || 'the planned-until month';
  const configuredGrowthDescription = hasValidPlannedUntil
    ? `${nearTermGrowthLabel} through ${cutoffLabel} inclusive, then ${longTermGrowthLabel}`
    : `${nearTermGrowthLabel} for the full projection (no valid planned-until date is configured)`;
  const plannedAmountLabel = isPrivacyMode
    ? `${PRIVACY_VALUE_MASK} €/month`
    : `${plannedContributionAmount || 'the configured amount'} €/month`;
  const plannedThenMinimumDescription = hasValidPlannedUntil
    ? `${plannedAmountLabel} through ${cutoffLabel} inclusive, then the recalculated minimum monthly amount until and including the goal month`
    : `${plannedAmountLabel} on every monthly step until and including the goal month`;
  const plannedThenLatestMinimumDescription = hasValidPlannedUntil
    ? `${plannedAmountLabel} through ${cutoffLabel} inclusive, then the same latest minimum monthly amount as Target (min contributions) until and including the goal month`
    : `${plannedAmountLabel} on every monthly step until and including the goal month`;
  const plannedContributionDescription = `Growth: ${configuredGrowthDescription}. Contributions: ${plannedThenMinimumDescription}. The path starts at the first portfolio value (index-adjusted when available).`;
  const legendItems = React.useMemo<LegendItem[]>(() => ([
    {
      label: 'Percentage (left Y axis)',
      description: 'Progress along Target with fixed contributions. This is an axis guide, not a separate projection.',
      variant: 'note'
    },
    {
      label: 'Owned stocks',
      description: 'Growth: no rate is assumed. Contributions: only activity already reflected in each recorded portfolio value.',
      color: '#3b82f6',
      variant: 'area'
    },
    {
      label: 'Owned stocks (index trend)',
      description: 'Growth: no future rate is assumed; each recorded value is adjusted with its index-to-trend factor. Contributions: only activity already reflected in the recorded value.',
      color: '#8b5cf6',
      strokeDasharray: '5 5',
      variant: 'line'
    },
    {
      label: 'Target with fixed contributions',
      description: `Growth: ${configuredGrowthDescription}. Contributions: one fixed monthly amount, calculated once and added on every monthly step after the initial point until and including the goal month.`,
      color: '#ef4444',
      variant: 'line'
    },
    {
      label: 'Target (min contributions)',
      description: `Growth: ${configuredGrowthDescription}. Contributions: the minimum monthly amount calculated at the latest portfolio value (index-adjusted when available), added on every monthly step until and including the goal month.`,
      color: '#10b981',
      variant: 'line'
    },
    {
      label: 'Growth (+1 pp)',
      description: hasValidPlannedUntil
        ? `Growth: ${isPrivacyMode ? PRIVACY_RATE_MASK : formatAnnualRate(nearTermGrowthRate + 0.01)} through ${cutoffLabel} inclusive, then ${isPrivacyMode ? PRIVACY_RATE_MASK : formatAnnualRate(longTermGrowthRate + 0.01)}—one percentage point above each configured rate. Contributions: the same latest minimum monthly amount as Target (min contributions), added until and including the goal month.`
        : `Growth: ${isPrivacyMode ? PRIVACY_RATE_MASK : formatAnnualRate(nearTermGrowthRate + 0.01)} for the full projection—one percentage point above the configured near-term rate. Contributions: the same latest minimum monthly amount as Target (min contributions), added until and including the goal month.`,
      color: GROWTH_PLUS_COLOR,
      variant: 'line',
      hidden: isSimplified
    },
    {
      label: 'Growth (-1 pp)',
      description: hasValidPlannedUntil
        ? `Growth: ${isPrivacyMode ? PRIVACY_RATE_MASK : formatAnnualRate(nearTermGrowthRate - 0.01)} through ${cutoffLabel} inclusive, then ${isPrivacyMode ? PRIVACY_RATE_MASK : formatAnnualRate(longTermGrowthRate - 0.01)}—one percentage point below each configured rate. Contributions: the same latest minimum monthly amount as Target (min contributions), added until and including the goal month.`
        : `Growth: ${isPrivacyMode ? PRIVACY_RATE_MASK : formatAnnualRate(nearTermGrowthRate - 0.01)} for the full projection—one percentage point below the configured near-term rate. Contributions: the same latest minimum monthly amount as Target (min contributions), added until and including the goal month.`,
      color: GROWTH_MINUS_COLOR,
      variant: 'line',
      hidden: isSimplified
    },
    {
      label: trendGrowthLabel,
      description: `Growth: ${trendRateLabel || 'the fetched average historical index rate'} (the fetched historical-index average) for the full projection. Contributions: the same latest minimum monthly amount as Target (min contributions), added on every monthly step until and including the goal month.`,
      color: INDEX_MIN_COLOR,
      strokeDasharray: '5 5',
      variant: 'line',
      hidden: isSimplified || trendRateLabel === null
    },
    {
      label: trendGrowthWithPlannedLabel,
      description: `Growth: ${trendRateLabel || 'the fetched average historical index rate'} (the fetched historical-index average) for the full projection. Contributions: ${plannedThenLatestMinimumDescription}.`,
      color: INDEX_PLANNED_COLOR,
      strokeDasharray: '2 4',
      variant: 'line',
      hidden: isSimplified || trendRateLabel === null
    },
    {
      label: 'Planned contributions',
      description: plannedContributionDescription,
      color: '#f59e0b',
      variant: 'line'
    },
    {
      label: 'Goal (growth only)',
      description: `Growth: ${longTermGrowthLabel} from the month after ${cutoffLabel} until and including the goal month. Contributions: none. The cutoff marker is the portfolio value required for growth alone to reach the goal.`,
      color: '#fde68a',
      strokeDasharray: '4 6',
      variant: 'line',
      hidden: !hasValidPlannedUntil
    }
  ]), [
    isPrivacyMode,
    isSimplified,
    configuredGrowthDescription,
    cutoffLabel,
    hasValidPlannedUntil,
    longTermGrowthLabel,
    longTermGrowthRate,
    nearTermGrowthRate,
    plannedContributionDescription,
    plannedThenLatestMinimumDescription,
    trendGrowthLabel,
    trendGrowthWithPlannedLabel,
    trendRateLabel
  ]);
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
    width?: number;
    height?: number;
    stroke?: string;
    coordinate?: { x: number; y: number };
  }) => {
    const { points, x, width, height, stroke, coordinate } = props;
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
  const growthOnlyGoalStart = React.useMemo(() => {
    if (!config.planned_monthly_contributions_until) return null;
    const plannedUntilDate = parseLocalCalendarDate(config.planned_monthly_contributions_until);
    if (Number.isNaN(plannedUntilDate.getTime())) return null;
    const firstPoint = data.find((item) =>
      item.date.getFullYear() === plannedUntilDate.getFullYear()
      && item.date.getMonth() === plannedUntilDate.getMonth()
      && typeof item.growthOnlyGoalLine === 'number'
      && Number.isFinite(item.growthOnlyGoalLine)
    );
    if (!firstPoint || typeof firstPoint.growthOnlyGoalLine !== 'number') return null;
    return {
      x: firstPoint.dateFormatted,
      y: firstPoint.growthOnlyGoalLine
    };
  }, [config.planned_monthly_contributions_until, data]);
  
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
            tickFormatter={(value) => formatPrivacyAwareDateTick(value, isPrivacyMode)}
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
              itemSorter={(item) => {
                const rawValue = Array.isArray(item.value) ? item.value[0] : item.value;
                const numericValue = Number(rawValue);
                return Number.isFinite(numericValue) ? -numericValue : 0;
              }}
              formatter={(value, name) => {
                const label = name === 'stocks_in_eur' ? 'Owned stocks' :
                             name === 'stocks_in_eur_adjusted_for_eunl_trend' ? 'Owned stocks (index trend)' :
                             name === 'plannedContributionLine' ? 'Planned contributions' :
                             name === 'targetWithFixedContribution' ? 'Target with fixed contributions' :
                             name === 'targetWithMinimumContribution' ? 'Target (min contributions)' :
                             name === 'lineWithMinusOnePercentGrowth' ? 'Growth (-1 pp)' :
                             name === 'lineWithPlusOnePercentGrowth' ? 'Growth (+1 pp)' :
                             name === 'lineWithTrendGrowth' ? trendGrowthLabel :
                             name === 'lineWithTrendGrowthAndPlannedContribution' ? trendGrowthWithPlannedLabel :
                             name === 'growthOnlyGoalLine' ? 'Goal (growth only)' :
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
            stroke={GROWTH_PLUS_COLOR}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: GROWTH_PLUS_COLOR }}
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
            stroke={INDEX_MIN_COLOR}
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 3, fill: INDEX_MIN_COLOR }}
            hide={isSimplified || data.every(item => item.lineWithTrendGrowth == null)}
          />
          <Line
            type="monotone"
            dataKey="lineWithTrendGrowthAndPlannedContribution"
            stroke={INDEX_PLANNED_COLOR}
            strokeWidth={1}
            strokeDasharray="2 4"
            dot={false}
            activeDot={{ r: 3, fill: INDEX_PLANNED_COLOR }}
            hide={isSimplified || data.every(item => item.lineWithTrendGrowthAndPlannedContribution == null)}
          />
          <Line
            type="monotone"
            dataKey="growthOnlyGoalLine"
            stroke="#fde68a"
            strokeOpacity={0.75}
            strokeWidth={1.5}
            strokeDasharray="4 6"
            dot={false}
            activeDot={{ r: 3, fill: '#facc15' }}
            connectNulls={false}
            hide={data.every(item => item.growthOnlyGoalLine == null)}
          />
          {growthOnlyGoalStart !== null && isWithinRightAxisDomain(growthOnlyGoalStart.y) && (
            <ReferenceDot
              x={growthOnlyGoalStart.x}
              y={growthOnlyGoalStart.y}
              r={6}
              fill="#facc15"
              stroke="#fff7cc"
              strokeWidth={2}
            />
          )}
          {visibleMilestoneMarkers.map((marker) => {
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
            stroke={GROWTH_MINUS_COLOR}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: GROWTH_MINUS_COLOR }}
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
          {/* 4b. Current value adjusted for index trend */}
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
