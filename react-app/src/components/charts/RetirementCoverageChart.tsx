import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { formatCurrency } from '../../utils/financial-utils';
import { PRIVACY_VALUE_MASK } from '../../utils/privacy-utils';
import type { RetirementCoverageResult } from '../../utils/retirement-coverage-utils';

export interface RetirementCoverageChartProps {
  result: RetirementCoverageResult;
  goalDate: Date;
  title?: string;
}

// Existing project chart colors, arranged in rainbow order. If more categories
// exist than unique hues, the final one uses the chart background color instead
// of wrapping back to red/orange.
const CATEGORY_COLORS = [
  '#fb7185',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
];
const FINAL_CATEGORY_COLOR = '#1e293b';

const getCategoryColor = (index: number, categoryCount: number): string => {
  if (categoryCount > CATEGORY_COLORS.length && index === categoryCount - 1) {
    return FINAL_CATEGORY_COLOR;
  }
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));

const roundedPercent = (value: number, maximum: number): number => {
  if (!Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.round(clamp(value / maximum, 0, 1) * 1000) / 10;
};

const formatMonthly = (value: number, isPrivacyMode: boolean): string =>
  isPrivacyMode
    ? `${PRIVACY_VALUE_MASK} €/month`
    : `${formatCurrency(value)}/month`;

const formatMoney = (value: number, isPrivacyMode: boolean): string =>
  isPrivacyMode ? `${PRIVACY_VALUE_MASK} €` : formatCurrency(value);

const formatCoverageComparison = (
  context: string,
  value: number,
  isPrivacyMode: boolean
): string => {
  if (value > 0) {
    return `${context}: Full cost coverage plus a ${formatMonthly(value, isPrivacyMode)} buffer.`;
  }
  if (value === 0) {
    return `${context}: Full cost coverage.`;
  }
  return `${context}: ${formatMonthly(Math.abs(value), isPrivacyMode)} less than full cost coverage.`;
};

interface CoverageStatusProps {
  context: string;
  value: number;
  isPrivacyMode: boolean;
}

function CoverageStatus({
  context,
  value,
  isPrivacyMode,
}: CoverageStatusProps): React.JSX.Element {
  const isBuffer = value >= 0;
  const status = formatCoverageComparison(context, value, isPrivacyMode);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
        isBuffer
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/40 bg-red-500/10 text-red-300'
      }`}
      data-state={isBuffer ? 'buffer' : 'gap'}
    >
      {status}
    </span>
  );
}

interface CoverageTooltipContent {
  heading: string;
  details: string[];
  color?: string;
}

interface CoverageRowProps {
  result: RetirementCoverageResult;
  isPrivacyMode: boolean;
}

function CoverageRow({
  result,
  isPrivacyMode,
}: CoverageRowProps): React.JSX.Element {
  const goalBufferOrGap = result.goalBufferOrGap.future;
  const investmentGoal = Math.max(0, result.investmentGoal.future);
  const projectedSavings = Math.max(0, result.todayEstimate.atGoal.future);
  const totalFutureCosts = Math.max(0, result.totalMonthlyCosts.future);
  const hasAttainableRequiredSavings = totalFutureCosts <= 0 || result.netMonthlyReturnRate > 0;
  const requiredSavings = hasAttainableRequiredSavings
    ? Math.max(0, result.requiredSavings.future)
    : 0;
  const scaleMaximum = Math.max(investmentGoal, projectedSavings, requiredSavings, 1);
  const investmentGoalPosition = roundedPercent(investmentGoal, scaleMaximum);
  const requiredSavingsPosition = hasAttainableRequiredSavings
    ? roundedPercent(requiredSavings, scaleMaximum)
    : 100;
  const progressWidth = roundedPercent(projectedSavings, scaleMaximum);
  const bufferWidth = Math.round(
    Math.max(0, investmentGoalPosition - requiredSavingsPosition) * 10
  ) / 10;
  const gapWidth = Math.round(
    Math.max(0, requiredSavingsPosition - investmentGoalPosition) * 10
  ) / 10;
  const investmentGoalLineOffset = investmentGoalPosition >= 99.5
    ? -4
    : investmentGoalPosition <= 0.5 ? 2 : -2;
  const requiredSavingsLineOffset = requiredSavingsPosition >= 99.5
    ? -4
    : requiredSavingsPosition <= 0.5 ? 4 : 2;
  const [activeTooltipId, setActiveTooltipId] = React.useState<string | null>(null);
  const tooltipId = React.useId();

  const requiredSavingsText = isPrivacyMode
    ? formatMoney(0, true)
    : hasAttainableRequiredSavings
      ? formatMoney(requiredSavings, false)
      : 'Not attainable at the assumed return';
  const requiredSavingsCurrentText = isPrivacyMode
    ? formatMoney(0, true)
    : hasAttainableRequiredSavings
      ? formatMoney(result.requiredSavings.currentYear, false)
      : 'Not attainable at the assumed return';

  const currentSavingsTooltip: CoverageTooltipContent = {
    heading: 'Current savings',
    color: '#a5f3fc',
    details: [
      `Year ${result.asOfYear}: ${formatMoney(result.todayEstimate.today, isPrivacyMode)}`,
      `At goal in year ${result.asOfYear} money: ${formatMoney(result.todayEstimate.atGoal.currentYear, isPrivacyMode)}`,
      `At goal nominal money: ${formatMoney(result.todayEstimate.atGoal.future, isPrivacyMode)}`,
      `After-tax monthly income at goal: ${formatMonthly(result.existingSavingsMonthlyIncome.future, isPrivacyMode)}`,
    ],
  };
  const investmentGoalTooltip: CoverageTooltipContent = {
    heading: 'Investment goal',
    color: '#f8fafc',
    details: [
      `At goal in year ${result.asOfYear} money: ${formatMoney(result.investmentGoal.currentYear, isPrivacyMode)}`,
      `At goal nominal money: ${formatMoney(result.investmentGoal.future, isPrivacyMode)}`,
      `After-tax monthly income at goal: ${formatMonthly(result.goalMonthlyIncome.future, isPrivacyMode)}`,
    ],
  };
  const requiredSavingsTooltip: CoverageTooltipContent = {
    heading: 'Required savings',
    color: '#fde68a',
    details: [
      `At goal in year ${result.asOfYear} money: ${requiredSavingsCurrentText}`,
      `At goal nominal money: ${requiredSavingsText}`,
      `Monthly costs covered: ${formatMonthly(result.totalMonthlyCosts.future, isPrivacyMode)}`,
    ],
  };

  const tooltipLabel = (tooltip: CoverageTooltipContent): string =>
    `${tooltip.heading}. ${tooltip.details.join('. ')}.`;

  let consumedFutureCost = 0;
  const visibleCategorySegments = result.categories.map((category, index) => {
    const futureCost = Math.max(0, category.monthlyCost.future);
    const start = totalFutureCosts > 0
      ? requiredSavingsPosition * consumedFutureCost / totalFutureCosts
      : 0;
    const width = totalFutureCosts > 0
      ? requiredSavingsPosition * futureCost / totalFutureCosts
      : 0;
    consumedFutureCost += futureCost;
    const categoryRequiredSavings = hasAttainableRequiredSavings && totalFutureCosts > 0
      ? requiredSavings * futureCost / totalFutureCosts
      : null;
    const color = getCategoryColor(index, result.categories.length);
    return {
      color,
      id: `category-${index}`,
      start: Math.round(start * 10) / 10,
      width: Math.round(width * 10) / 10,
      tooltip: {
        heading: category.category || 'Unnamed category',
        color,
        details: [
          `Current monthly cost ${formatMonthly(category.monthlyCost.currentYear, false)}`,
          `Future monthly cost ${formatMonthly(category.monthlyCost.future, false)}`,
          categoryRequiredSavings === null
            ? 'Required savings not attainable at the assumed return'
            : `Required savings at goal ${formatMoney(categoryRequiredSavings, false)}`,
          ...(category.skipInflation ? ['Inflation not applied'] : []),
        ],
      } satisfies CoverageTooltipContent,
    };
  });

  const activeTooltip = activeTooltipId === 'current-savings'
    ? currentSavingsTooltip
    : activeTooltipId === 'investment-goal'
      ? investmentGoalTooltip
      : activeTooltipId === 'required-savings'
        ? requiredSavingsTooltip
        : visibleCategorySegments.find((segment) => segment.id === activeTooltipId)?.tooltip ?? null;

  const goalCoverageComparison = formatCoverageComparison(
    'At investment goal date',
    goalBufferOrGap,
    isPrivacyMode
  );
  const accessibleLabel = isPrivacyMode
    ? `Retirement savings coverage. Cost category details are hidden. Investment goal, required savings, and current savings markers shown. ${goalCoverageComparison}`
    : `Retirement savings coverage. Monthly costs ${formatMonthly(result.totalMonthlyCosts.future, false)}. Investment goal ${formatMoney(investmentGoal, false)}. Required savings ${requiredSavingsText}. Current projected savings ${formatMoney(projectedSavings, false)}. ${goalCoverageComparison}`;

  const showTooltip = (id: string): void => setActiveTooltipId(id);
  const hideTooltip = (id: string): void => {
    setActiveTooltipId((active) => active === id ? null : active);
  };

  return (
    <section
      className="rounded-lg border border-border/70 bg-background/20 p-3 sm:p-4"
      data-testid="coverage-row-future"
    >
      <div className="mb-2 flex min-w-0 text-xs text-cyan-200 sm:justify-end">
        <span className="text-left sm:text-right">
          Current savings at goal date: {formatMoney(result.todayEstimate.atGoal.future, isPrivacyMode)}{' '}
          <span className="whitespace-nowrap">
            ({formatMonthly(result.existingSavingsMonthlyIncome.future, isPrivacyMode)} after tax)
          </span>
        </span>
      </div>

      <div
        role="group"
        aria-label={accessibleLabel}
        className="w-full"
        data-testid="coverage-visual-future"
      >
        <div
          className="relative h-14 w-full overflow-hidden rounded-lg border border-slate-500/70 bg-slate-800 sm:h-12"
          data-testid="coverage-main-scale-future"
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            {visibleCategorySegments.map((segment, index) => (
              segment.width > 0 ? (
                isPrivacyMode ? (
                  <div
                    key={index}
                    className="absolute bottom-0 top-0 border-r-2 border-white/35"
                    data-testid={`coverage-category-future-${index}`}
                    aria-hidden="true"
                    style={{
                      backgroundColor: segment.color,
                      left: `${segment.start}%`,
                      width: `${segment.width}%`,
                    }}
                  />
                ) : (
                  <button
                    key={index}
                    type="button"
                    className="absolute bottom-0 top-0 cursor-pointer appearance-none border-0 border-r-2 border-white/35 p-0 outline-none transition-[filter,box-shadow] hover:brightness-125 focus-visible:z-40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                    data-testid={`coverage-category-future-${index}`}
                    data-active={activeTooltipId === segment.id}
                    style={{
                      backgroundColor: segment.color,
                      left: `${segment.start}%`,
                      width: `${segment.width}%`,
                      filter: activeTooltipId === segment.id ? 'brightness(1.65)' : undefined,
                      boxShadow: activeTooltipId === segment.id
                        ? 'inset 0 0 0 2px rgba(255, 255, 255, 0.9)'
                        : undefined,
                      zIndex: activeTooltipId === segment.id ? 20 : undefined,
                    }}
                    aria-label={tooltipLabel(segment.tooltip)}
                    aria-controls={activeTooltipId === segment.id ? tooltipId : undefined}
                    aria-expanded={activeTooltipId === segment.id}
                    onMouseEnter={() => showTooltip(segment.id)}
                    onMouseLeave={() => hideTooltip(segment.id)}
                    onFocus={() => showTooltip(segment.id)}
                    onBlur={() => hideTooltip(segment.id)}
                    onClick={() => showTooltip(segment.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setActiveTooltipId(null);
                    }}
                  />
                )
              ) : null
            ))}
            {bufferWidth > 0 && (
              <div
                className="absolute bottom-0 top-0 bg-emerald-600/80"
                data-testid="coverage-buffer-future"
                style={{
                  left: `${requiredSavingsPosition}%`,
                  width: `${bufferWidth}%`,
                }}
                aria-hidden="true"
              />
            )}
          </div>

          {gapWidth > 0 && (
            <div
              className="pointer-events-none absolute bottom-0 z-20 h-1 bg-red-400/90"
              data-testid="coverage-gap-region-future"
              style={{ left: `${investmentGoalPosition}%`, width: `${gapWidth}%` }}
              aria-hidden="true"
            />
          )}
          <div
            className="pointer-events-none absolute bottom-0 left-0 z-20 h-2 bg-cyan-300/75"
            data-testid="coverage-progress-future"
            style={{ width: `${progressWidth}%` }}
            aria-hidden="true"
          />

          <button
            type="button"
            className="absolute bottom-0 top-0 z-30 w-6 -translate-x-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
            data-testid="coverage-threshold-investment-goal-future"
            data-position={investmentGoalPosition}
            style={{ left: `${investmentGoalPosition}%` }}
            aria-label={tooltipLabel(investmentGoalTooltip)}
            aria-controls={activeTooltipId === 'investment-goal' ? tooltipId : undefined}
            aria-expanded={activeTooltipId === 'investment-goal'}
            onMouseEnter={() => showTooltip('investment-goal')}
            onMouseLeave={() => hideTooltip('investment-goal')}
            onFocus={() => showTooltip('investment-goal')}
            onBlur={() => hideTooltip('investment-goal')}
            onClick={() => showTooltip('investment-goal')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setActiveTooltipId(null);
            }}
          >
            <span
              className="pointer-events-none absolute bottom-0 top-0 border-l-2 border-dashed border-slate-100/95"
              style={{ transform: `translateX(${investmentGoalLineOffset}px)` }}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            className="absolute bottom-0 top-0 z-30 w-7 -translate-x-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200"
            data-testid="coverage-threshold-required-savings-future"
            data-position={requiredSavingsPosition}
            style={{ left: `${requiredSavingsPosition}%` }}
            aria-label={tooltipLabel(requiredSavingsTooltip)}
            aria-controls={activeTooltipId === 'required-savings' ? tooltipId : undefined}
            aria-expanded={activeTooltipId === 'required-savings'}
            onMouseEnter={() => showTooltip('required-savings')}
            onMouseLeave={() => hideTooltip('required-savings')}
            onFocus={() => showTooltip('required-savings')}
            onBlur={() => hideTooltip('required-savings')}
            onClick={() => showTooltip('required-savings')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setActiveTooltipId(null);
            }}
          >
            <span
              className="pointer-events-none absolute bottom-0 top-0 border-l-4 border-amber-200/95"
              style={{ transform: `translateX(${requiredSavingsLineOffset}px)` }}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            className="absolute bottom-0 top-0 z-40 w-6 -translate-x-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-100"
            data-testid="coverage-marker-future"
            style={{ left: `${progressWidth}%` }}
            aria-label={tooltipLabel(currentSavingsTooltip)}
            aria-controls={activeTooltipId === 'current-savings' ? tooltipId : undefined}
            aria-expanded={activeTooltipId === 'current-savings'}
            onMouseEnter={() => showTooltip('current-savings')}
            onMouseLeave={() => hideTooltip('current-savings')}
            onFocus={() => showTooltip('current-savings')}
            onBlur={() => hideTooltip('current-savings')}
            onClick={() => showTooltip('current-savings')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setActiveTooltipId(null);
            }}
          >
            <span className="pointer-events-none absolute bottom-0 top-0 left-1/2 w-0.5 -translate-x-1/2 bg-cyan-100 shadow-[0_0_7px_rgba(165,243,252,0.95)]" />
            <span className="pointer-events-none absolute -top-px left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-100" />
          </button>
        </div>

        <div
          className="mt-1 flex w-full items-start justify-between gap-3 text-[11px] text-muted-foreground sm:text-xs"
          data-testid="coverage-axis-future"
        >
          <span className="whitespace-nowrap">{formatMoney(0, isPrivacyMode)}</span>
          <span className="text-right">
            Scale maximum {formatMoney(scaleMaximum, isPrivacyMode)}{' '}
            <span className="whitespace-nowrap">
              (at-goal costs {formatMonthly(totalFutureCosts, isPrivacyMode)})
            </span>
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 border-l-2 border-dashed border-slate-100" aria-hidden="true" />
            Investment goal
          </span>
          <span
            className="inline-flex items-center gap-2"
            data-testid="coverage-threshold-label-required-savings-future"
          >
            <span className="h-4 border-l-4 border-amber-200" aria-hidden="true" />
            Required savings <strong className="text-foreground">{requiredSavingsText}</strong>
          </span>
        </div>

        <div className="mt-2 min-h-[2rem]" aria-live="polite">
          {activeTooltip ? (
            <div
              id={tooltipId}
              role="tooltip"
              className="rounded-md border border-slate-500/80 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-lg"
              data-testid="coverage-tooltip"
            >
              <div className="flex items-center gap-2 font-semibold">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/40"
                  style={{ backgroundColor: activeTooltip.color }}
                  aria-hidden="true"
                />
                {activeTooltip.heading}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-slate-300">
                {activeTooltip.details.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
            </div>
          ) : (
            <p className="px-1 pt-1 text-xs text-muted-foreground">
              {isPrivacyMode
                ? 'Hover, focus, or tap a savings or threshold marker for masked details.'
                : 'Hover, focus, or tap a cost section, savings marker, or threshold line for details.'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap gap-2">
        <CoverageStatus
          context="At investment goal date"
          value={goalBufferOrGap}
          isPrivacyMode={isPrivacyMode}
        />
      </div>
    </section>
  );
}

/**
 * Compares projected portfolio savings with the investment goal and the
 * principal required to fund ordered after-goal monthly costs.
 */
export function RetirementCoverageChart({
  result,
  title = 'Retirement monthly cost coverage',
}: RetirementCoverageChartProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();

  return (
    <Card className="w-full border-gray-600" data-testid="retirement-coverage-card">
      <CardHeader className="px-3 pb-3 pt-5 sm:px-6 sm:pt-6">
        <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
        <CardDescription>
          Projected portfolio savings and after-tax income compared with after-goal living costs.
        </CardDescription>
        <div
          className="mt-2 space-y-1 text-xs text-muted-foreground sm:text-sm"
          data-testid="coverage-notes"
        >
          <p>
            Coverage projects today’s estimated portfolio using the configured near-term and long-term growth rates; future contributions are not included.
          </p>
          <p>
            {isPrivacyMode
              ? 'Some personal expenses are not included'
              : 'Office, spa renovations and time with kids when young, are not included'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-5 sm:px-6 sm:pb-6">
        <CoverageRow result={result} isPrivacyMode={isPrivacyMode} />
      </CardContent>
    </Card>
  );
}
