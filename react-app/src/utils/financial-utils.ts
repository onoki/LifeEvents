import { APP_CONFIG } from '../config/app-config';
import type { Event, Config, ChartDataPoint } from '../types';
import { parseNumeric } from './number-utils';

/**
 * Calculate target value with fixed monthly contribution
 */
export function calculateTargetWithFixedContribution(
  data: Event[],
  config: Config,
  trendAnnualGrowthRate?: number | null
): ChartDataPoint[] {
  if (!data || data.length === 0) return [];
  
  // Financial calculation helpers
  const pow1p = (rate: number, n: number) => Math.pow(1 + rate, n);
  const annuityFactor = (rate: number, n: number) => {
    if (n <= 0) return 0;
    if (rate === 0) return n;
    return (pow1p(rate, n) - 1) / rate;
  };
  const requiredPayment = (remaining: number, rate: number, n: number) => {
    if (n <= 0) return 0;
    if (rate === 0) return remaining / n;
    return remaining / annuityFactor(rate, n);
  };
  const calculateMinRequiredContribution = (
    currentValue: number,
    goal: number,
    monthlyRate: number,
    monthsRemaining: number
  ): number => {
    const futureValue = currentValue * pow1p(monthlyRate, monthsRemaining);
    const remaining = goal - futureValue;
    return requiredPayment(remaining, monthlyRate, monthsRemaining);
  };
  const monthsBetween = (start: Date, end: Date) =>
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
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
  const annualGrowthRate = parseNumeric(config.annual_growth_rate || APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE.toString());
  const monthlyGrowthRate = annualGrowthRate / 12;
  const plannedMonthlyContribution = parseNumeric(config.planned_monthly_contribution || '0');
  const plannedUntilDate = config.planned_monthly_contributions_until 
    ? new Date(config.planned_monthly_contributions_until) 
    : null;
  const hasValidPlannedUntil = plannedUntilDate !== null && !Number.isNaN(plannedUntilDate.getTime());
  const hasTrendGrowth = trendAnnualGrowthRate !== undefined && trendAnnualGrowthRate !== null;
  const monthlyRateMinusOne = (annualGrowthRate - 0.01) / 12;
  const monthlyRatePlusOne = (annualGrowthRate + 0.01) / 12;
  const monthlyTrendRate = hasTrendGrowth ? trendAnnualGrowthRate / 12 : 0;
  const shouldApplyPlannedContribution = (date: Date) =>
    plannedMonthlyContribution > 0 && (!hasValidPlannedUntil || date <= plannedUntilDate!);
  
  // Prepare data
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sortedData[0].date;
  const lastDate = sortedData[sortedData.length - 1].date;
  const totalMonths = monthsBetween(firstDate, lastDate) + 1;
  
  // Find first stocks data point
  const firstStocksData = sortedData.find(item => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0);
  if (!firstStocksData) return [];
  
  const firstStocksValue = parseNumeric(firstStocksData.stocks_in_eur!);
  const firstAdjustedValue = firstStocksData.eunl_rate_to_trend
    ? firstStocksValue * parseNumeric(firstStocksData.eunl_rate_to_trend)
    : firstStocksValue;
  
  // Calculate baseline monthly contribution needed
  const futureValueOfFirst = firstStocksValue * pow1p(monthlyGrowthRate, totalMonths - 1);
  const remainingToGoal = investmentGoal - futureValueOfFirst;
  const baselineMonthlyContribution = requiredPayment(remainingToGoal, monthlyGrowthRate, Math.max(0, totalMonths - 1));
  
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
    plannedContributionLine: firstAdjustedValue,
    plannedProjectionValue: firstAdjustedValue,
    plannedMinRequired: 0,
    latestMinRequired: 0,
    latestMinRequiredAdjusted: 0,
  };
  
  // Initialize planned min required contribution for first month
  const firstMonthsRemaining = Math.max(0, totalMonths - 1);
  projectionState.plannedMinRequired = calculateMinRequiredContribution(
    firstAdjustedValue,
    investmentGoal,
    monthlyGrowthRate,
    firstMonthsRemaining
  );
  
  const result = sortedData.map((item, index) => {
    const monthsFromStart = monthsBetween(firstDate, item.date);
    const monthsRemaining = Math.max(0, totalMonths - monthsFromStart - 1);
    const rawStocksValue = item.stocks_in_eur ? parseNumeric(item.stocks_in_eur) : null;
    const currentValue = rawStocksValue ?? 0;
    const adjustedValue = getAdjustedValue(rawStocksValue, item.eunl_rate_to_trend);
    const projectionStartValue = adjustedValue ?? currentValue;
    const contributesThisMonth = shouldApplyPlannedContribution(item.date);
    const isLatestDataPoint = index === latestDataPointIndex;
    const isFuturePoint = index > latestDataPointIndex;
    
    // Calculate target value with fixed contribution
    const targetValue = firstAdjustedValue * pow1p(monthlyGrowthRate, monthsFromStart) + 
                       baselineMonthlyContribution * annuityFactor(monthlyGrowthRate, monthsFromStart);
    
    // Calculate minimum required contributions
    let minRequiredContribution = 0;
    let minRequiredContributionAdjusted = 0;
    
    if (index <= latestDataPointIndex) {
      // For historical points, calculate from actual data
      minRequiredContribution = calculateMinRequiredContribution(
        currentValue,
        investmentGoal,
        monthlyGrowthRate,
        monthsRemaining
      );
      projectionState.latestMinRequired = minRequiredContribution;
      
      if (adjustedValue !== null) {
        minRequiredContributionAdjusted = calculateMinRequiredContribution(
          adjustedValue,
          investmentGoal,
          monthlyGrowthRate,
          monthsRemaining
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
    
    if (isLatestDataPoint) {
      // Initialize projection lines at latest data point
      targetWithMinimumContribution = projectionStartValue;
      lineWithMinusOnePercentGrowth = projectionStartValue;
      lineWithPlusOnePercentGrowth = projectionStartValue;
      if (hasTrendGrowth) {
        lineWithTrendGrowth = projectionStartValue;
      }
      
      // Reset state to current values
      projectionState.minContributionLine = projectionStartValue;
      projectionState.minusOnePercentLine = projectionStartValue;
      projectionState.plusOnePercentLine = projectionStartValue;
      if (hasTrendGrowth) {
        projectionState.trendGrowthLine = projectionStartValue;
      }
    } else if (isFuturePoint) {
      // Continue projections for future months
      targetWithMinimumContribution = projectionState.minContributionLine * (1 + monthlyGrowthRate) + effectiveMinContribution;
      lineWithMinusOnePercentGrowth = projectionState.minusOnePercentLine * (1 + monthlyRateMinusOne) + effectiveMinContribution;
      lineWithPlusOnePercentGrowth = projectionState.plusOnePercentLine * (1 + monthlyRatePlusOne) + effectiveMinContribution;
      
      if (hasTrendGrowth) {
        lineWithTrendGrowth = projectionState.trendGrowthLine * (1 + monthlyTrendRate) + effectiveMinContribution;
      }
      
      // Update state for next iteration
      projectionState.minContributionLine = targetWithMinimumContribution;
      projectionState.minusOnePercentLine = lineWithMinusOnePercentGrowth;
      projectionState.plusOnePercentLine = lineWithPlusOnePercentGrowth;
      if (lineWithTrendGrowth !== null) {
        projectionState.trendGrowthLine = lineWithTrendGrowth;
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
            monthlyGrowthRate,
            monthsRemaining
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
      
      if (hasValidPlannedUntil && item.date > plannedUntilDate!) {
        plannedMinRequiredContribution = projectionState.plannedMinRequired;
      } else {
        plannedMinRequiredContribution = calculateMinRequiredContribution(
          projectionState.plannedProjectionValue,
          investmentGoal,
          monthlyGrowthRate,
          monthsRemaining
        );
        projectionState.plannedMinRequired = plannedMinRequiredContribution;
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
      targetWithMinimumContribution: targetWithMinimumContribution ? Math.max(0, targetWithMinimumContribution) : null,
      plannedContributionLine: plannedContributionLine !== null ? Math.max(0, plannedContributionLine) : null,
      plannedMinRequiredContribution: plannedMinRequiredContribution !== null ? Math.max(0, plannedMinRequiredContribution) : null,
      lineWithMinusOnePercentGrowth: lineWithMinusOnePercentGrowth ? Math.max(0, lineWithMinusOnePercentGrowth) : null,
      stocks_in_eur: rawStocksValue !== null ? rawStocksValue : null,
      stocks_in_eur_adjusted_for_eunl_trend: stocksInEurAdjusted,
      targetWithFixedContribution: Math.max(0, targetValue),
      minRequiredContribution: minRequiredContribution,
      minRequiredContributionAdjustedForEUNLTrend: minRequiredContributionAdjusted
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
 * Calculate exponential trend line for EUNL data with confidence intervals
 * Returns both the enhanced data and trend statistics
 */
export function calculateExponentialTrend(data: any[]): { data: any[], trendStats: { annualGrowthRate: number, standardDeviation: number } | null } {
  if (!data || data.length < 2) return { data, trendStats: null };

  // Convert dates to numeric values (days since first date)
  const firstDate = data[0].date;
  const numericData = data.map((item) => ({
    ...item,
    x: (item.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24), // days since first date
    y: item.price
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
    const multiplier = item.price ? trend / item.price : null;
    
    return {
      ...item,
      trend,
      trendUpperBound: upperBound,
      trendLowerBound: lowerBound,
      multiplier,
      // Add indicators for when price is outside confidence interval
      isAboveUpperBound: item.price !== null && item.price > upperBound,
      isBelowLowerBound: item.price !== null && item.price < lowerBound
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

  // Get configuration values
  const annualGrowthRate = parseNumeric(config.annual_growth_rate || '0.07');
  const dailyGrowthRate = annualGrowthRate / 365;

  // Calculate time difference
  const timeDiffMs = currentTime.getTime() - lastDate.getTime();
  const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

  // Calculate growth from last recorded value (using adjusted value if available)
  const growthFactor = Math.pow(1 + dailyGrowthRate, timeDiffDays);
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
  const effectiveMonthlyContribution = plannedMonthlyContribution > 0 ? plannedMonthlyContribution : minimumContribution;
  const contributionEffect = effectiveMonthlyContribution * contributionScale;
  const currentEstimate = valueFromGrowth + contributionEffect;
  const uncorrectedEstimate = uncorrectedValueFromGrowth + contributionEffect;

  // Calculate separate components for daily changes
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
