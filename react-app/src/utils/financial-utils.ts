import { APP_CONFIG } from '../config/app-config';
import type { Event, Config, ChartDataPoint } from '../types';
import { parseNumeric } from './number-utils';

const monthsBetween = (start: Date, end: Date) =>
  (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();

export const isDateInOrBeforeMonth = (date: Date, cutoff: Date): boolean =>
  monthIndex(date) <= monthIndex(cutoff);

export const isDateAfterMonth = (date: Date, cutoff: Date): boolean =>
  monthIndex(date) > monthIndex(cutoff);

const parseGrowthRate = (value: string | undefined, fallback: number): number => {
  const parsed = parseNumeric(value || fallback.toString());
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function getAnnualGrowthRateForDate(config: Config, date: Date): number {
  const nearTermRate = parseGrowthRate(
    config.annual_growth_rate_near_term,
    APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE_NEAR_TERM
  );
  const longTermRate = parseGrowthRate(
    config.annual_growth_rate_long_term,
    APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE_LONG_TERM
  );
  const plannedUntil = config.planned_monthly_contributions_until
    ? new Date(config.planned_monthly_contributions_until)
    : null;
  if (!plannedUntil || Number.isNaN(plannedUntil.getTime())) return nearTermRate;
  return isDateInOrBeforeMonth(date, plannedUntil) ? nearTermRate : longTermRate;
}

const getMonthlyRatesBetween = (
  start: Date,
  end: Date,
  config: Config,
  annualRateDelta = 0
): number[] => {
  const monthCount = Math.max(0, monthsBetween(start, end));
  return Array.from({ length: monthCount }, (_, index) => {
    const destinationMonth = new Date(start.getFullYear(), start.getMonth() + index + 1, 1);
    return (getAnnualGrowthRateForDate(config, destinationMonth) + annualRateDelta) / 12;
  });
};

const calculateGrowthAndContributionFactors = (monthlyRates: number[]) => {
  let growthFactor = 1;
  let contributionFactor = 0;
  monthlyRates.forEach((monthlyRate) => {
    growthFactor *= 1 + monthlyRate;
    contributionFactor = contributionFactor * (1 + monthlyRate) + 1;
  });
  return { growthFactor, contributionFactor };
};

export function calculateRequiredMonthlyContributionForDatesRaw(
  currentValue: number,
  goal: number,
  config: Config,
  start: Date,
  end: Date
): number {
  if (!Number.isFinite(currentValue) || !Number.isFinite(goal) || end <= start) return 0;
  const { growthFactor, contributionFactor } = calculateGrowthAndContributionFactors(
    getMonthlyRatesBetween(start, end, config)
  );
  if (contributionFactor === 0) return 0;
  return (goal - currentValue * growthFactor) / contributionFactor;
}

export function calculateRequiredMonthlyContributionForDates(
  currentValue: number,
  goal: number,
  config: Config,
  start: Date,
  end: Date
): number {
  return Math.max(0, calculateRequiredMonthlyContributionForDatesRaw(
    currentValue,
    goal,
    config,
    start,
    end
  ));
}

export function calculateGrowthFactorForDates(config: Config, start: Date, end: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  if (end.getTime() === start.getTime()) return 1;
  const plannedUntil = config.planned_monthly_contributions_until
    ? new Date(config.planned_monthly_contributions_until)
    : null;
  const validCutoff = plannedUntil && !Number.isNaN(plannedUntil.getTime()) ? plannedUntil : null;
  const growForDays = (rate: number, days: number) => Math.pow(1 + rate / 365, days);

  const longTermStarts = validCutoff
    ? new Date(validCutoff.getFullYear(), validCutoff.getMonth() + 1, 1)
    : null;

  if (!validCutoff || !longTermStarts) {
    const days = (end.getTime() - start.getTime()) / millisecondsPerDay;
    return growForDays(getAnnualGrowthRateForDate(config, end), days);
  }
  if (end <= longTermStarts) {
    const days = (end.getTime() - start.getTime()) / millisecondsPerDay;
    return growForDays(getAnnualGrowthRateForDate(config, validCutoff), days);
  }
  if (start >= longTermStarts) {
    const days = (end.getTime() - start.getTime()) / millisecondsPerDay;
    return growForDays(getAnnualGrowthRateForDate(config, end), days);
  }

  const nearTermDays = (longTermStarts.getTime() - start.getTime()) / millisecondsPerDay;
  const longTermDays = (end.getTime() - longTermStarts.getTime()) / millisecondsPerDay;
  return growForDays(getAnnualGrowthRateForDate(config, validCutoff), nearTermDays)
    * growForDays(getAnnualGrowthRateForDate(config, end), longTermDays);
}

export function calculateTargetWithFixedContribution(
  data: Event[],
  config: Config,
  trendAnnualGrowthRate?: number | null
): ChartDataPoint[] {
  if (!data || data.length === 0) return [];
  
  // Financial calculation helpers
  // annuity factor means “how much 1 € per month turns into after N months at rate r"
  const calculateMinRequiredContribution = (
    currentValue: number,
    goal: number,
    start: Date,
    end: Date
  ): number => {
    const { growthFactor, contributionFactor } = calculateGrowthAndContributionFactors(
      getMonthlyRatesBetween(start, end, config)
    );
    if (contributionFactor === 0) return 0;
    return (goal - currentValue * growthFactor) / contributionFactor;
  };
  const getAdjustedValue = (
    rawValue: number | null,
    trendRate: string | number | undefined | null
  ): number | null => {
    if (rawValue === null) return null;
    if (!trendRate) return rawValue;
    const adjusted = rawValue * parseNumeric(trendRate);
    return Number.isNaN(adjusted) ? null : adjusted;
  };
  
  // Configuration parameters
  const investmentGoal = parseNumeric(config.investment_goal || APP_CONFIG.DEFAULTS.INVESTMENT_GOAL.toString());
  const plannedMonthlyContribution = parseNumeric(config.planned_monthly_contribution || '0');
  const plannedUntilDate = config.planned_monthly_contributions_until 
    ? new Date(config.planned_monthly_contributions_until) 
    : null;
  const hasValidPlannedUntil = plannedUntilDate !== null && !Number.isNaN(plannedUntilDate.getTime());
  const hasTrendGrowth = trendAnnualGrowthRate !== undefined && trendAnnualGrowthRate !== null;
  const shouldApplyPlannedContribution = (date: Date) =>
    plannedMonthlyContribution > 0
    && (!hasValidPlannedUntil || isDateInOrBeforeMonth(date, plannedUntilDate!));
  
  // Prepare data
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sortedData[0].date;
  const lastDate = sortedData[sortedData.length - 1].date;
  
  // Find first stocks data point
  const firstStocksData = sortedData.find(item => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0);
  if (!firstStocksData) return [];
  
  const firstStocksValue = parseNumeric(firstStocksData.stocks_in_eur!);
  const firstAdjustedValue = firstStocksData.eunl_rate_to_trend
    ? firstStocksValue * parseNumeric(firstStocksData.eunl_rate_to_trend)
    : firstStocksValue;
  
  // Calculate baseline monthly contribution needed
  const fullPeriodFactors = calculateGrowthAndContributionFactors(
    getMonthlyRatesBetween(firstDate, lastDate, config)
  );
  const futureValueOfFirst = firstStocksValue * fullPeriodFactors.growthFactor;
  const remainingToGoal = investmentGoal - futureValueOfFirst;
  const baselineMonthlyContribution = fullPeriodFactors.contributionFactor === 0
    ? 0
    : remainingToGoal / fullPeriodFactors.contributionFactor;
  
  // Find latest data point with stocks data
  const latestDataPoint = sortedData
    .filter(item => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0)
    .pop();
  const latestDataPointIndex = latestDataPoint 
    ? sortedData.findIndex(item => item.date.getTime() === latestDataPoint.date.getTime())
    : -1;
  const useAdjustedMinContribution = Boolean(
    latestDataPoint?.stocks_in_eur && latestDataPoint?.eunl_rate_to_trend
  );
  
  // State tracking for projection lines (initialized before loop)
  const projectionState = {
    minContributionLine: 0,
    minusOnePercentLine: 0,
    plusOnePercentLine: 0,
    trendGrowthLine: 0,
    trendGrowthWithPlannedContributionLine: 0,
    plannedContributionLine: firstAdjustedValue,
    plannedProjectionValue: firstAdjustedValue,
    plannedMinRequired: 0,
    latestMinRequired: 0,
    latestMinRequiredAdjusted: 0,
    expectedProjectionValue: 0,
    expectedMinRequired: 0,
    fixedContributionLine: firstAdjustedValue,
  };
  
  // Initialize planned min required contribution for first month
  projectionState.plannedMinRequired = calculateMinRequiredContribution(
    firstAdjustedValue,
    investmentGoal,
    firstDate,
    lastDate
  );
  
  const result = sortedData.map((item, index) => {
    const rawStocksValue = item.stocks_in_eur ? parseNumeric(item.stocks_in_eur) : null;
    const currentValue = rawStocksValue ?? 0;
    const adjustedValue = getAdjustedValue(rawStocksValue, item.eunl_rate_to_trend);
    const projectionStartValue = adjustedValue ?? currentValue;
    const contributesThisMonth = shouldApplyPlannedContribution(item.date);
    const isLatestDataPoint = index === latestDataPointIndex;
    const isFuturePoint = index > latestDataPointIndex;
    const monthlyGrowthRate = getAnnualGrowthRateForDate(config, item.date) / 12;
    const monthlyRateMinusOne = (getAnnualGrowthRateForDate(config, item.date) - 0.01) / 12;
    const monthlyRatePlusOne = (getAnnualGrowthRateForDate(config, item.date) + 0.01) / 12;
    const monthlyTrendRate = hasTrendGrowth
      ? (hasValidPlannedUntil && isDateAfterMonth(item.date, plannedUntilDate!)
          ? monthlyGrowthRate
          : trendAnnualGrowthRate / 12)
      : 0;

    // Capital required at/after the planned-contribution cutoff for growth alone
    // to reach the investment goal at the end of the shared chart horizon.
    const isAtOrAfterPlannedUntil = hasValidPlannedUntil
      && monthsBetween(plannedUntilDate!, item.date) >= 0;
    const futureGrowthFactor = calculateGrowthAndContributionFactors(
      getMonthlyRatesBetween(item.date, lastDate, config)
    ).growthFactor;
    const growthOnlyGoalLine = isAtOrAfterPlannedUntil
      ? investmentGoal / futureGrowthFactor
      : null;
    
    // Calculate target value with fixed contribution
    let targetValue = projectionState.fixedContributionLine;
    if (index > 0) {
      getMonthlyRatesBetween(sortedData[index - 1].date, item.date, config).forEach((rate) => {
        targetValue = targetValue * (1 + rate) + baselineMonthlyContribution;
      });
      projectionState.fixedContributionLine = targetValue;
    }
    
    // Calculate minimum required contributions
    let minRequiredContribution = 0;
    let minRequiredContributionAdjusted = 0;
    
    if (index <= latestDataPointIndex) {
      // For historical points, calculate from actual data
      minRequiredContribution = calculateMinRequiredContribution(
        currentValue,
        investmentGoal,
        item.date,
        lastDate
      );
      projectionState.latestMinRequired = minRequiredContribution;
      
      if (adjustedValue !== null) {
        minRequiredContributionAdjusted = calculateMinRequiredContribution(
          adjustedValue,
          investmentGoal,
          item.date,
          lastDate
        );
        projectionState.latestMinRequiredAdjusted = minRequiredContributionAdjusted;
      }
    } else {
      // For future points, use latest calculated values
      minRequiredContribution = projectionState.latestMinRequired;
      minRequiredContributionAdjusted = projectionState.latestMinRequiredAdjusted;
    }
    
    const effectiveMinContribution = useAdjustedMinContribution
      ? minRequiredContributionAdjusted
      : minRequiredContribution;
    
    // Calculate projection lines (only from latest data point onwards)
    let targetWithMinimumContribution: number | null = null;
    let lineWithMinusOnePercentGrowth: number | null = null;
    let lineWithPlusOnePercentGrowth: number | null = null;
    let lineWithTrendGrowth: number | null = null;
    let lineWithTrendGrowthAndPlannedContribution: number | null = null;
    
    if (isLatestDataPoint) {
      // Initialize projection lines at latest data point
      targetWithMinimumContribution = projectionStartValue;
      lineWithMinusOnePercentGrowth = projectionStartValue;
      lineWithPlusOnePercentGrowth = projectionStartValue;
      if (hasTrendGrowth) {
        lineWithTrendGrowth = projectionStartValue;
        lineWithTrendGrowthAndPlannedContribution = projectionStartValue;
      }
      
      // Reset state to current values
      projectionState.minContributionLine = projectionStartValue;
      projectionState.minusOnePercentLine = projectionStartValue;
      projectionState.plusOnePercentLine = projectionStartValue;
      if (hasTrendGrowth) {
        projectionState.trendGrowthLine = projectionStartValue;
        projectionState.trendGrowthWithPlannedContributionLine = projectionStartValue;
      }
    } else if (isFuturePoint) {
      // Continue projections for future months
      targetWithMinimumContribution = projectionState.minContributionLine * (1 + monthlyGrowthRate) + effectiveMinContribution;
      lineWithMinusOnePercentGrowth = projectionState.minusOnePercentLine * (1 + monthlyRateMinusOne) + effectiveMinContribution;
      lineWithPlusOnePercentGrowth = projectionState.plusOnePercentLine * (1 + monthlyRatePlusOne) + effectiveMinContribution;
      
      if (hasTrendGrowth) {
        lineWithTrendGrowth = projectionState.trendGrowthLine * (1 + monthlyTrendRate) + effectiveMinContribution;
        const plannedContributionForTrend = contributesThisMonth ? plannedMonthlyContribution : 0;
        lineWithTrendGrowthAndPlannedContribution =
          projectionState.trendGrowthWithPlannedContributionLine * (1 + monthlyTrendRate) + plannedContributionForTrend;
      }
      
      // Update state for next iteration
      projectionState.minContributionLine = targetWithMinimumContribution;
      projectionState.minusOnePercentLine = lineWithMinusOnePercentGrowth;
      projectionState.plusOnePercentLine = lineWithPlusOnePercentGrowth;
      if (lineWithTrendGrowth !== null) {
        projectionState.trendGrowthLine = lineWithTrendGrowth;
      }
      if (lineWithTrendGrowthAndPlannedContribution !== null) {
        projectionState.trendGrowthWithPlannedContributionLine = lineWithTrendGrowthAndPlannedContribution;
      }
    }
    
    // Reset projection state when encountering actual stocks data
    if (index >= latestDataPointIndex && item.stocks_in_eur) {
      const resetValue = projectionStartValue;
      projectionState.minContributionLine = resetValue;
      projectionState.minusOnePercentLine = resetValue;
      projectionState.plusOnePercentLine = resetValue;
      if (hasTrendGrowth) {
        projectionState.trendGrowthLine = resetValue;
        projectionState.trendGrowthWithPlannedContributionLine = resetValue;
      }
    }
    
    // Calculate planned contribution line
    let plannedContributionLine: number | null = null;
    if (index === 0) {
      plannedContributionLine = projectionState.plannedContributionLine;
    } else {
      const baseValue = projectionState.plannedContributionLine * (1 + monthlyGrowthRate);
      const contribution = contributesThisMonth
        ? plannedMonthlyContribution
        : calculateMinRequiredContribution(
            baseValue,
            investmentGoal,
            item.date,
            lastDate
          );
      
      plannedContributionLine = baseValue + contribution;
      projectionState.plannedContributionLine = plannedContributionLine;
    }
    
    // Calculate planned minimum required contribution
    let plannedMinRequiredContribution: number | null = null;
    if (index === 0) {
      plannedMinRequiredContribution = projectionState.plannedMinRequired;
    } else {
      projectionState.plannedProjectionValue = projectionState.plannedProjectionValue * (1 + monthlyGrowthRate)
        + (contributesThisMonth ? plannedMonthlyContribution : 0);
      
      if (hasValidPlannedUntil && isDateAfterMonth(item.date, plannedUntilDate!)) {
        plannedMinRequiredContribution = projectionState.plannedMinRequired;
      } else {
        plannedMinRequiredContribution = calculateMinRequiredContribution(
          projectionState.plannedProjectionValue,
          investmentGoal,
          item.date,
          lastDate
        );
        projectionState.plannedMinRequired = plannedMinRequiredContribution;
      }
    }
    
    // Calculate expected minimum required contribution based on current savings
    let expectedMinRequiredContribution: number | null = null;
    if (latestDataPointIndex >= 0) {
      if (isLatestDataPoint) {
        projectionState.expectedProjectionValue = projectionStartValue;
        expectedMinRequiredContribution = calculateMinRequiredContribution(
          projectionState.expectedProjectionValue,
          investmentGoal,
          item.date,
          lastDate
        );
        projectionState.expectedMinRequired = expectedMinRequiredContribution;
      } else if (isFuturePoint) {
        projectionState.expectedProjectionValue = projectionState.expectedProjectionValue * (1 + monthlyGrowthRate)
          + (contributesThisMonth ? plannedMonthlyContribution : 0);

        if (hasValidPlannedUntil && isDateAfterMonth(item.date, plannedUntilDate!)) {
          expectedMinRequiredContribution = projectionState.expectedMinRequired;
        } else {
          expectedMinRequiredContribution = calculateMinRequiredContribution(
            projectionState.expectedProjectionValue,
            investmentGoal,
            item.date,
            lastDate
          );
          projectionState.expectedMinRequired = expectedMinRequiredContribution;
        }
      }
    }

    // Calculate adjusted stock value
    const stocksInEurAdjusted = adjustedValue;
    
    const resultItem: ChartDataPoint = {
      ...item,
      dateFormatted: item.date.toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS),
      // Tooltip order: 1. 8% growth scenario, 2. Target with minimum contributions, 3. Calculated trend, 4. 6% growth scenario, 5. Current value, 6. Target with fixed contributions
      lineWithPlusOnePercentGrowth: lineWithPlusOnePercentGrowth ? Math.max(0, lineWithPlusOnePercentGrowth) : null,
      lineWithTrendGrowth: lineWithTrendGrowth ? Math.max(0, lineWithTrendGrowth) : null,
      lineWithTrendGrowthAndPlannedContribution: lineWithTrendGrowthAndPlannedContribution
        ? Math.max(0, lineWithTrendGrowthAndPlannedContribution)
        : null,
      growthOnlyGoalLine: growthOnlyGoalLine !== null && Number.isFinite(growthOnlyGoalLine)
        ? Math.max(0, growthOnlyGoalLine)
        : null,
      targetWithMinimumContribution: targetWithMinimumContribution ? Math.max(0, targetWithMinimumContribution) : null,
      plannedContributionLine: plannedContributionLine !== null ? Math.max(0, plannedContributionLine) : null,
      plannedMinRequiredContribution: plannedMinRequiredContribution !== null ? Math.max(0, plannedMinRequiredContribution) : null,
      lineWithMinusOnePercentGrowth: lineWithMinusOnePercentGrowth ? Math.max(0, lineWithMinusOnePercentGrowth) : null,
      stocks_in_eur: rawStocksValue !== null ? rawStocksValue : null,
      stocks_in_eur_adjusted_for_eunl_trend: stocksInEurAdjusted,
      targetWithFixedContribution: Math.max(0, targetValue),
      minRequiredContribution: minRequiredContribution,
      minRequiredContributionAdjustedForEUNLTrend: minRequiredContributionAdjusted,
      expectedMinRequiredContribution: expectedMinRequiredContribution !== null ? Math.max(0, expectedMinRequiredContribution) : null
    };
    
    return resultItem;
  });
  
  return result;
}

/**
 * Process stocks data for chart display
 */
export function processStocksData(data: Event[]): ChartDataPoint[] {
  return data
    .filter(item => item.date && item.stocks_in_eur)
    .map(item => ({
      ...item,
      dateFormatted: item.date.toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS),
      stocks_in_eur: parseNumeric(item.stocks_in_eur!) || 0
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Calculate exponential trend line for index data with confidence intervals.
 * Supports both `value` and legacy `price` fields.
 */
export function calculateExponentialTrend(data: any[]): { data: any[], trendStats: { annualGrowthRate: number, standardDeviation: number } | null } {
  if (!data || data.length < 2) return { data, trendStats: null };

  // Convert dates to numeric values (days since first date)
  const firstDate = data[0].date;
  const numericData = data.map((item) => ({
    ...item,
    x: (item.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24), // days since first date
    y: item.value ?? item.price
  })).filter(item => item.y !== null);

  if (numericData.length < 2) return { data, trendStats: null };

  // Calculate exponential regression: y = a * e^(b * x)
  // Using linear regression on ln(y) = ln(a) + b * x
  const n = numericData.length;
  const sumX = numericData.reduce((sum, item) => sum + item.x, 0);
  const sumY = numericData.reduce((sum, item) => sum + Math.log(item.y), 0);
  const sumXY = numericData.reduce((sum, item) => sum + item.x * Math.log(item.y), 0);
  const sumXX = numericData.reduce((sum, item) => sum + item.x * item.x, 0);

  const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const lnA = (sumY - b * sumX) / n;
  const a = Math.exp(lnA);

  // Calculate residuals for standard deviation
  const residuals = numericData.map(item => {
    const predicted = Math.log(a * Math.exp(b * item.x));
    const actual = Math.log(item.y);
    return Math.pow(actual - predicted, 2);
  });

  // Calculate standard deviation of residuals
  const sumSquaredResiduals = residuals.reduce((sum, residual) => sum + residual, 0);
  const standardDeviation = Math.sqrt(sumSquaredResiduals / (n - 2)); // n-2 for degrees of freedom

  // Calculate annual growth rate from daily growth rate (b)
  const annualGrowthRate = b * 365; // Convert daily growth rate to annual

  // Generate trend line data with confidence intervals
  const enhancedData = data.map(item => {
    const x = (item.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    const trend = a * Math.exp(b * x);
    
    // Calculate confidence intervals (±1 standard deviation)
    const confidenceInterval = standardDeviation * trend;
    const upperBound = trend + confidenceInterval;
    const lowerBound = Math.max(0, trend - confidenceInterval); // Don't go below 0 for prices
    const observedValue = item.value ?? item.price;
    const multiplier = observedValue ? trend / observedValue : null;
    
    return {
      ...item,
      value: observedValue,
      trend,
      trendUpperBound: upperBound,
      trendLowerBound: lowerBound,
      multiplier,
      // Add indicators for when price is outside confidence interval
      isAboveUpperBound: observedValue !== null && observedValue > upperBound,
      isBelowLowerBound: observedValue !== null && observedValue < lowerBound
    };
  });

  return {
    data: enhancedData,
    trendStats: {
      annualGrowthRate,
      standardDeviation
    }
  };
}

/**
 * Format currency values for display
 */
export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('en-US').replace(/,/g, ' ')} €`;
}

/**
 * Format percentage values for display
 */
export function formatPercentage(value: number, decimals: number = 3): string {
  return `${value.toFixed(decimals)} %`;
}

/**
 * Calculate current stock value estimate based on last recorded value and growth
 */
export function calculateCurrentStockEstimate(
  data: Event[], 
  config: Config, 
  currentTime: Date = new Date(),
  chartData?: any[] // Optional chart data with pre-calculated minRequiredContribution
): {
  currentEstimate: number;
  uncorrectedEstimate: number;
  changePerDay: number;
  growthPerDay: number;
  contributionPerDay: number;
} {
  if (!data || data.length === 0) {
    return { currentEstimate: 0, uncorrectedEstimate: 0, changePerDay: 0, growthPerDay: 0, contributionPerDay: 0 };
  }

  // Get the last recorded stock value
  const sortedData = [...data]
    .filter(item => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (sortedData.length === 0) {
    return { currentEstimate: 0, uncorrectedEstimate: 0, changePerDay: 0, growthPerDay: 0, contributionPerDay: 0 };
  }

  const lastRecord = sortedData[0];
  const lastDate = lastRecord.date;
  
  const baseStocksValue = parseNumeric(lastRecord.stocks_in_eur!);
  // Use adjusted value (stocks_in_eur * eunl_rate_to_trend) if available, otherwise use stocks_in_eur
  let lastValue = baseStocksValue;
  if (lastRecord.eunl_rate_to_trend) {
    const eunlRate = parseNumeric(lastRecord.eunl_rate_to_trend);
    if (!isNaN(eunlRate)) {
      lastValue = lastValue * eunlRate;
    }
  }

  // Calculate time difference
  const timeDiffMs = currentTime.getTime() - lastDate.getTime();
  const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

  // Calculate growth from last recorded value (using adjusted value if available)
  const growthFactor = calculateGrowthFactorForDates(config, lastDate, currentTime);
  const valueFromGrowth = lastValue * growthFactor;
  const uncorrectedValueFromGrowth = baseStocksValue * growthFactor;

  // Calculate minimum contribution effect
  // Scale from 0% to 100% over 1 month (30 days)
  const contributionScale = Math.min(timeDiffDays / 30, 1);
  
  // Get minimum contribution from the pre-calculated chart data
  let minimumContribution = 0;
  if (chartData && chartData.length > 0) {
    // Find the latest data point with minimum contribution
    const latestChartData = chartData
      .filter(item => item.minRequiredContribution !== undefined && item.minRequiredContribution !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    
    if (latestChartData) {
      minimumContribution = latestChartData.minRequiredContribution;
    }
  }
  
  // Get planned monthly contribution or fallback to minimum contribution
  const plannedMonthlyContribution = parseNumeric(config.planned_monthly_contribution || '0');
  const plannedUntil = config.planned_monthly_contributions_until
    ? new Date(config.planned_monthly_contributions_until)
    : null;
  const plannedContributionIsActive = plannedMonthlyContribution > 0
    && (!plannedUntil
      || Number.isNaN(plannedUntil.getTime())
      || isDateInOrBeforeMonth(currentTime, plannedUntil));
  const effectiveMonthlyContribution = plannedContributionIsActive
    ? plannedMonthlyContribution
    : minimumContribution;
  const contributionEffect = effectiveMonthlyContribution * contributionScale;
  const currentEstimate = valueFromGrowth + contributionEffect;
  const uncorrectedEstimate = uncorrectedValueFromGrowth + contributionEffect;

  // Calculate separate components for daily changes
  const dailyGrowthRate = getAnnualGrowthRateForDate(config, currentTime) / 365;
  const growthPerDay = valueFromGrowth * dailyGrowthRate;
  const contributionPerDay = effectiveMonthlyContribution / 30;
  const totalChangePerDay = growthPerDay + contributionPerDay;

  return {
    currentEstimate,
    uncorrectedEstimate,
    changePerDay: totalChangePerDay,
    growthPerDay,
    contributionPerDay
  };
}
