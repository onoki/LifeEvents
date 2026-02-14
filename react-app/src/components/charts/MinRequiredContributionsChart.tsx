import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceDot, ReferenceLine, Label } from 'recharts';
import type { MinRequiredContributionsChartProps } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { parseNumeric } from '../../utils/number-utils';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { APP_CONFIG } from '../../config/app-config';
import { ChartLegend } from './ChartLegend';

type ScenarioKind = 'monthly-delta' | 'lump-sum' | 'pause' | 'loan-repay';

interface ScenarioDefinition {
  id: string;
  label: string;
  shortLabel: string;
  kind: ScenarioKind;
  color: string;
  delta?: number;
  amount?: number;
  months?: number;
}

interface ScenarioResult {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  x: string;
  y: number;
}

const CONTRIBUTION_SCENARIOS: ScenarioDefinition[] = [
  { id: 'monthly-minus-500', label: '-500 €/month vs planned', shortLabel: '-500', kind: 'monthly-delta', delta: -500, color: '#ef4444' },
  { id: 'monthly-minus-250', label: '-250 €/month vs planned', shortLabel: '-250', kind: 'monthly-delta', delta: -250, color: '#f97316' },
  { id: 'monthly-planned', label: 'Planned monthly contribution', shortLabel: 'Plan', kind: 'monthly-delta', delta: 0, color: '#06b6d4' },
  { id: 'monthly-plus-250', label: '+250 €/month vs planned', shortLabel: '+250', kind: 'monthly-delta', delta: 250, color: '#10b981' },
  { id: 'monthly-plus-500', label: '+500 €/month vs planned', shortLabel: '+500', kind: 'monthly-delta', delta: 500, color: '#22c55e' },
  { id: 'lump-10000', label: '+10 000 € lump sum now', shortLabel: '+10k', kind: 'lump-sum', amount: 10000, color: '#f59e0b' },
  { id: 'lump-5000', label: '+5 000 € lump sum now', shortLabel: '+5k', kind: 'lump-sum', amount: 5000, color: '#fbbf24' },
  { id: 'lump-1000', label: '+1 000 € lump sum now', shortLabel: '+1k', kind: 'lump-sum', amount: 1000, color: '#eab308' },
  { id: 'loan-10000', label: 'Loan 10 000 € (invest next month, repay with planned)', shortLabel: 'Loan 10k', kind: 'loan-repay', amount: 10000, color: '#0ea5e9' },
  { id: 'loan-5000', label: 'Loan 5 000 € (invest next month, repay with planned)', shortLabel: 'Loan 5k', kind: 'loan-repay', amount: 5000, color: '#38bdf8' },
  { id: 'loan-1000', label: 'Loan 1 000 € (invest next month, repay with planned)', shortLabel: 'Loan 1k', kind: 'loan-repay', amount: 1000, color: '#7dd3fc' },
  { id: 'pause-1', label: 'Pause contributions for 1 month', shortLabel: 'Pause 1m', kind: 'pause', months: 1, color: '#6b7280' },
  { id: 'pause-3', label: 'Pause contributions for 3 months', shortLabel: 'Pause 3m', kind: 'pause', months: 3, color: '#9ca3af' },
  { id: 'pause-6', label: 'Pause contributions for 6 months', shortLabel: 'Pause 6m', kind: 'pause', months: 6, color: '#d1d5db' }
];

const monthsBetween = (start: Date, end: Date) =>
  (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const findDateLabelForMonth = (data: Array<{ date: Date; dateFormatted: string }>, target: Date): string | null => {
  const exact = data.find((item) => isSameMonth(item.date, target));
  return exact ? exact.dateFormatted : null;
};

const clampMin = (value: number, min: number) => (value < min ? min : value);
const formatCurrencyPerMonth = (value: number): string => {
  const base = formatCurrency(value);
  return base.includes(' €') ? base.replace(' €', ' €/m') : `${base} €/m`;
};

const calculateRequiredMonthlyContributionRaw = (
  currentValue: number,
  goal: number,
  annualGrowthRate: number,
  monthsRemaining: number
): number => {
  if (!Number.isFinite(currentValue) || !Number.isFinite(goal) || !Number.isFinite(annualGrowthRate)) {
    return NaN;
  }
  if (monthsRemaining <= 0) return 0;
  const monthlyRate = annualGrowthRate / 12;
  if (monthlyRate === 0) {
    return (goal - currentValue) / monthsRemaining;
  }
  const pow1p = (rate: number, n: number) => Math.pow(1 + rate, n);
  const annuityFactor = (rate: number, n: number) => {
    if (n <= 0) return 0;
    if (rate === 0) return n;
    return (pow1p(rate, n) - 1) / rate;
  };
  const futureValue = currentValue * pow1p(monthlyRate, monthsRemaining);
  const remaining = goal - futureValue;
  const denominator = annuityFactor(monthlyRate, monthsRemaining);
  if (denominator === 0) return 0;
  return remaining / denominator;
};

/**
 * Minimum Required Contributions Chart Component
 * Displays the minimum required monthly contributions to reach investment goals
 */
export function MinRequiredContributionsChart({ title, data, fullData, config }: MinRequiredContributionsChartProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  const fullDataSet = fullData && fullData.length > 0 ? fullData : data;
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
    },
    {
      label: 'Scenario markers',
      description: 'Dots on the planned-until date show required monthly contribution for each scenario.',
      variant: 'note'
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
  const baseRightAxisDomain = React.useMemo(() => {
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

  const plannedUntilDate = React.useMemo(() => {
    if (!config.planned_monthly_contributions_until) return null;
    const parsed = new Date(config.planned_monthly_contributions_until);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }, [config.planned_monthly_contributions_until]);

  const plannedUntilX = React.useMemo(() => {
    if (!plannedUntilDate || !chartData || chartData.length === 0) return null;
    return findDateLabelForMonth(chartData, plannedUntilDate);
  }, [chartData, plannedUntilDate]);

  const scenarioResults = React.useMemo((): ScenarioResult[] => {
    if (!plannedUntilDate || !plannedUntilX) return [];
    if (!fullDataSet || fullDataSet.length === 0) return [];
    const baseMonthlyContribution = parseNumeric(config.planned_monthly_contribution || '0');
    const plannedMonthlyContribution = Number.isFinite(baseMonthlyContribution) ? baseMonthlyContribution : 0;
    const investmentGoal = parseNumeric(config.investment_goal || APP_CONFIG.DEFAULTS.INVESTMENT_GOAL.toString());
    const annualGrowthRate = parseNumeric(config.annual_growth_rate || APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE.toString());

    if (!Number.isFinite(investmentGoal) || !Number.isFinite(annualGrowthRate)) {
      return [];
    }

    const firstDate = fullDataSet[0]?.date;
    const lastDate = fullDataSet[fullDataSet.length - 1]?.date;
    if (!firstDate || !lastDate) return [];
    const totalMonths = monthsBetween(firstDate, lastDate) + 1;
    const plannedUntilIndex = fullDataSet.findIndex((item) => isSameMonth(item.date, plannedUntilDate));
    if (plannedUntilIndex < 0) return [];
    const monthsRemainingAtPlannedUntil = Math.max(0, totalMonths - monthsBetween(firstDate, plannedUntilDate) - 1);

    const latestIndex = [...fullDataSet]
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => typeof item.stocks_in_eur === 'number' && Number.isFinite(item.stocks_in_eur) && item.stocks_in_eur > 0)
      .pop()?.index ?? -1;

    if (latestIndex < 0) return [];
    const latestPoint = fullDataSet[latestIndex];
    const latestDate = latestPoint.date;
    if (plannedUntilDate < latestDate) return [];
    if (plannedUntilIndex < latestIndex) return [];

    const startValueRaw = typeof latestPoint.stocks_in_eur_adjusted_for_eunl_trend === 'number'
      && Number.isFinite(latestPoint.stocks_in_eur_adjusted_for_eunl_trend)
      ? latestPoint.stocks_in_eur_adjusted_for_eunl_trend
      : latestPoint.stocks_in_eur;

    if (typeof startValueRaw !== 'number' || !Number.isFinite(startValueRaw)) {
      return [];
    }

    const monthlyGrowthRate = annualGrowthRate / 12;

    const monthlyContributionForScenario = (
      scenario: ScenarioDefinition,
      monthIndex: number,
      baseContribution: number
    ): number => {
      switch (scenario.kind) {
        case 'monthly-delta': {
          const delta = scenario.delta ?? 0;
          return clampMin(baseContribution + delta, 0);
        }
        case 'lump-sum':
          return baseContribution;
        case 'pause': {
          const pauseMonths = scenario.months ?? 0;
          return monthIndex <= pauseMonths ? 0 : baseContribution;
        }
        default:
          return baseContribution;
      }
    };

    return CONTRIBUTION_SCENARIOS.map((scenario) => {
      let projectionValue = startValueRaw;
      const isLoanRepay = scenario.kind === 'loan-repay';
      let debtRemaining = isLoanRepay ? (scenario.amount ?? 0) : 0;
      if (scenario.kind === 'lump-sum') {
        projectionValue += scenario.amount ?? 0;
      }

      const stepsToPlanned = plannedUntilIndex - latestIndex;
      for (let stepIndex = 1; stepIndex <= stepsToPlanned; stepIndex += 1) {
        const stepDate = fullDataSet[latestIndex + stepIndex]?.date ?? plannedUntilDate;
        const appliesPlanned = stepDate <= plannedUntilDate;
        const baseContribution = appliesPlanned ? plannedMonthlyContribution : 0;
        let contribution = monthlyContributionForScenario(scenario, stepIndex, baseContribution);

        if (isLoanRepay) {
          contribution = baseContribution;
          if (stepIndex >= 2 && debtRemaining > 0) {
            const payment = Math.min(baseContribution, debtRemaining);
            debtRemaining -= payment;
            contribution = baseContribution - payment;
          }
          if (stepIndex === 1) {
            contribution += scenario.amount ?? 0;
          }
        }

        projectionValue = projectionValue * (1 + monthlyGrowthRate) + contribution;
      }

      const requiredAtPlanned = calculateRequiredMonthlyContributionRaw(
        projectionValue,
        investmentGoal,
        annualGrowthRate,
        monthsRemainingAtPlannedUntil
      );

      return {
        id: scenario.id,
        label: scenario.label,
        shortLabel: scenario.shortLabel,
        color: scenario.color,
        x: plannedUntilX,
        y: requiredAtPlanned
      };
    }).filter((scenario) => Number.isFinite(scenario.y));
  }, [
    config.annual_growth_rate,
    config.investment_goal,
    config.planned_monthly_contribution,
    fullDataSet,
    plannedUntilDate,
    plannedUntilX
  ]);

  const orderedScenarioResults = React.useMemo(() => {
    if (scenarioResults.length === 0) return scenarioResults;
    const orderMap = new Map(CONTRIBUTION_SCENARIOS.map((scenario, index) => [scenario.id, index]));
    return [...scenarioResults].sort((a, b) => {
      const orderA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const orderB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }, [scenarioResults]);

  const rightAxisDomain = baseRightAxisDomain;
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
          {plannedUntilX && (
            <ReferenceLine
              x={plannedUntilX}
              stroke="#6b7280"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
          )}
          {orderedScenarioResults
            .filter((scenario) => isWithinRightAxisDomain(scenario.y))
            .map((scenario, index) => (
              <ReferenceDot
                key={`scenario-${scenario.id}`}
                x={scenario.x}
                y={scenario.y}
                r={4}
                fill={scenario.color}
                stroke="#ffffff"
                strokeWidth={1.25}
                ifOverflow="extendDomain"
              >
                <Label
                  value={scenario.shortLabel}
                  position={index % 2 === 0 ? 'top' : 'bottom'}
                  fill={scenario.color}
                  fontSize={10}
                  fontWeight="bold"
                />
              </ReferenceDot>
            ))}
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
      {orderedScenarioResults.length > 0 && plannedUntilX && (
        <div className="mt-3 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">
            Scenario markers at {plannedUntilX}
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {orderedScenarioResults.map((scenario) => (
              <div key={`scenario-summary-${scenario.id}`} className="flex items-center gap-2">
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: scenario.color }}
                  aria-hidden="true"
                />
                <span className="flex-1">{scenario.label}</span>
                <span className="font-semibold text-foreground">
                  {isPrivacyMode ? '••••' : formatCurrencyPerMonth(scenario.y)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <ChartLegend items={legendItems} />
    </div>
  );
}
