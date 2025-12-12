import { APP_CONFIG } from '../config/app-config';
import type { Event, Config, ChartDataPoint } from '../types';

/**
 * Parse a numeric string, handling both comma and dot as decimal separators
 */
function parseNumeric(value: string | number | undefined | null): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  // Replace comma with dot for decimal separator, remove any thousand separators
  const normalized = value.toString().trim().replace(/,/g, '.').replace(/\s/g, '');
  return parseFloat(normalized);
}

/**
 * Calculate target value with fixed monthly contribution
 */
export function calculateTargetWithFixedContribution(data: Event[], config: Config): ChartDataPoint[] {
  if (!data || data.length === 0) return [];
  
  // Get parameters
  const investmentGoal = parseNumeric(config.investment_goal || APP_CONFIG.DEFAULTS.INVESTMENT_GOAL.toString());
  const annualGrowthRate = parseNumeric(config.annual_growth_rate || APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE.toString());
  const monthlyGrowthRate = annualGrowthRate / 12;

  // Small helpers to avoid duplication and keep logic centralized
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
  
  // Sort data by date to ensure proper order
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Get first and last dates from the raw data (including rows without stocks data)
  const firstDate = sortedData[0].date;
  const lastDate = sortedData[sortedData.length - 1].date;
  
  // Find the first row that actually has stocks data
  const firstStocksData = sortedData.find(item => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0);
  if (!firstStocksData) return [];
  
  const firstValue = parseNumeric(firstStocksData.stocks_in_eur!);
  
  // Find the first row that has both stocks_in_eur and eunl_rate_to_trend for adjusted calculations
  const firstAdjustedStocksData = sortedData.find(item => 
    item.stocks_in_eur && 
    parseNumeric(item.stocks_in_eur) > 0 &&
    item.eunl_rate_to_trend && 
    !isNaN(parseNumeric(item.eunl_rate_to_trend))
  );
  const firstAdjustedValue = firstAdjustedStocksData 
    ? parseNumeric(firstAdjustedStocksData.stocks_in_eur!) * parseNumeric(firstAdjustedStocksData.eunl_rate_to_trend!)
    : null;
  
  // Calculate total number of months from first to last date
  const totalMonths = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth()) + 1;
  
  // Calculate required monthly contribution using future value of annuity formula
  // FV = PMT * [((1 + r)^n - 1) / r] + PV * (1 + r)^n
  // Where: FV = investment goal, PV = present value, r = monthly rate, n = months, PMT = monthly payment
  const futureValueOfPresentValue = firstValue * pow1p(monthlyGrowthRate, totalMonths - 1);
  const remainingToAchieve = investmentGoal - futureValueOfPresentValue;
  const monthlyContribution = requiredPayment(remainingToAchieve, monthlyGrowthRate, Math.max(0, totalMonths - 1));
  
  // Find the latest data point that has actual stock values
  const latestDataPoint = sortedData
    .filter(item => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0)
    .pop();
  
  // Track minimum required contribution derived at the latest known data point
  // Compute its value within the main loop to avoid duplication/off-by-one.
  let latestMinRequiredContribution = 0;
  let latestMinRequiredContributionAdjusted = 0;
  let latestDataPointIndex = -1;
  if (latestDataPoint) {
    latestDataPointIndex = sortedData.findIndex(item => 
      item.date.getTime() === latestDataPoint.date.getTime()
    );
  }
  
  // Process the raw data and add target calculations
  let previousMinContributionLineValue = 0;
  let previousMinusOnePercentValue = 0;
  let previousPlusOnePercentValue = 0;

  const result = sortedData.map((item, index) => {
    const monthsFromStart = (item.date.getFullYear() - firstDate.getFullYear()) * 12 + 
                           (item.date.getMonth() - firstDate.getMonth());
    
    // Calculate target value for this month
    const targetValue = firstValue * pow1p(monthlyGrowthRate, monthsFromStart) + 
                       monthlyContribution * annuityFactor(monthlyGrowthRate, monthsFromStart);
    
    // Calculate minimum required contribution for this month
    let minRequiredContribution = 0;
    let minRequiredContributionAdjusted = 0;
    if (index <= latestDataPointIndex) {
      // For points up to and including the latest known data point, calculate normally
      const monthsRemaining = totalMonths - monthsFromStart - 1;
      const currentValue = item.stocks_in_eur ? parseNumeric(item.stocks_in_eur) : 0;
      const futureValueOfCurrent = currentValue * pow1p(monthlyGrowthRate, monthsRemaining);
      const remainingToGoal = investmentGoal - futureValueOfCurrent;
      minRequiredContribution = Math.max(0, requiredPayment(remainingToGoal, monthlyGrowthRate, monthsRemaining));
      latestMinRequiredContribution = minRequiredContribution;
      
      // Calculate adjusted minimum required contribution using adjusted stock value
      if (item.stocks_in_eur && item.eunl_rate_to_trend) {
        const adjustedValue = parseNumeric(item.stocks_in_eur) * parseNumeric(item.eunl_rate_to_trend);
        if (!isNaN(adjustedValue)) {
          const futureValueOfAdjusted = adjustedValue * pow1p(monthlyGrowthRate, monthsRemaining);
          const remainingToGoalAdjusted = investmentGoal - futureValueOfAdjusted;
          minRequiredContributionAdjusted = Math.max(0, requiredPayment(remainingToGoalAdjusted, monthlyGrowthRate, monthsRemaining));
          latestMinRequiredContributionAdjusted = minRequiredContributionAdjusted;
        }
      }
    } else {
      // For future points (after latest known data point), use the same value as latest
      minRequiredContribution = latestMinRequiredContribution;
      minRequiredContributionAdjusted = latestMinRequiredContributionAdjusted;
    }
    
    // Calculate minimum contribution line value
    let targetWithMinimumContribution = null;
    if (index === latestDataPointIndex) {
      // Only show this line starting from the last stocks data point
      targetWithMinimumContribution = parseNumeric(item.stocks_in_eur!);
    } else if (index > latestDataPointIndex) {
      // Continue calculating for future months
      targetWithMinimumContribution = previousMinContributionLineValue * (1 + monthlyGrowthRate) + latestMinRequiredContribution;
    }
    // For months before the last stocks data point, keep as null
    
    // Calculate alternative growth scenarios (annual_growth_rate ± 1%)
    const monthlyGrowthRateMinusOne = (annualGrowthRate - 0.01) / 12;
    const monthlyGrowthRatePlusOne = (annualGrowthRate + 0.01) / 12;
    
    let lineWithMinusOnePercentGrowth = null;
    let lineWithPlusOnePercentGrowth = null;
    
    if (index === latestDataPointIndex) {
      // Only show these lines starting from the last stocks data point
      const currentStocksValue = parseNumeric(item.stocks_in_eur!);
      lineWithMinusOnePercentGrowth = currentStocksValue;
      lineWithPlusOnePercentGrowth = currentStocksValue;
    } else if (index > latestDataPointIndex) {
      // Continue calculating for future months
      lineWithMinusOnePercentGrowth = previousMinusOnePercentValue * (1 + monthlyGrowthRateMinusOne) + latestMinRequiredContribution;
      lineWithPlusOnePercentGrowth = previousPlusOnePercentValue * (1 + monthlyGrowthRatePlusOne) + latestMinRequiredContribution;
    }
    // For months before the last stocks data point, keep as null
    
    // Calculate adjusted stock value (stocks_in_eur * eunl_rate_to_trend)
    // Calculate whenever stocks_in_eur exists and eunl_rate_to_trend is available
    let stocksInEurAdjusted: number | null = null;
    if (item.stocks_in_eur && item.eunl_rate_to_trend) {
      const stocksValue = parseNumeric(item.stocks_in_eur);
      const eunlRate = parseNumeric(item.eunl_rate_to_trend);
      if (!isNaN(stocksValue) && !isNaN(eunlRate) && stocksValue > 0) {
        stocksInEurAdjusted = stocksValue * eunlRate;
      }
    }
    
    const resultItem: ChartDataPoint = {
      ...item,
      dateFormatted: item.date.toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS),
      // Tooltip order: 1. 8% growth scenario, 2. Target with minimum contributions, 3. 6% growth scenario, 4. Current value, 5. Target with fixed contributions
      lineWithPlusOnePercentGrowth: lineWithPlusOnePercentGrowth ? Math.max(0, lineWithPlusOnePercentGrowth) : null,
      targetWithMinimumContribution: targetWithMinimumContribution ? Math.max(0, targetWithMinimumContribution) : null,
      lineWithMinusOnePercentGrowth: lineWithMinusOnePercentGrowth ? Math.max(0, lineWithMinusOnePercentGrowth) : null,
      stocks_in_eur: item.stocks_in_eur ? parseNumeric(item.stocks_in_eur) : null,
      stocks_in_eur_adjusted_for_eunl_trend: stocksInEurAdjusted,
      targetWithFixedContribution: Math.max(0, targetValue),
      minRequiredContribution: minRequiredContribution,
      minRequiredContributionAdjustedForEUNLTrend: minRequiredContributionAdjusted
    };

    // Update previous values for next iteration (only from the last stocks data point onwards)
    if (index >= latestDataPointIndex) {
      if (item.stocks_in_eur) {
        // When we have actual stocks data, reset all previous values to this value
        const currentStocksValue = parseNumeric(item.stocks_in_eur);
        previousMinContributionLineValue = currentStocksValue;
        previousMinusOnePercentValue = currentStocksValue;
        previousPlusOnePercentValue = currentStocksValue;
      } else {
        // When we don't have stocks data, update each line's previous value with its own calculated value
        if (targetWithMinimumContribution !== null) {
          previousMinContributionLineValue = targetWithMinimumContribution;
        }
        if (lineWithMinusOnePercentGrowth !== null) {
          previousMinusOnePercentValue = lineWithMinusOnePercentGrowth;
        }
        if (lineWithPlusOnePercentGrowth !== null) {
          previousPlusOnePercentValue = lineWithPlusOnePercentGrowth;
        }
      }
    }
    
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
): { currentEstimate: number; changePerDay: number; growthPerDay: number; contributionPerDay: number } {
  if (!data || data.length === 0) {
    return { currentEstimate: 0, changePerDay: 0, growthPerDay: 0, contributionPerDay: 0 };
  }

  // Get the last recorded stock value
  const sortedData = [...data]
    .filter(item => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (sortedData.length === 0) {
    return { currentEstimate: 0, changePerDay: 0, growthPerDay: 0, contributionPerDay: 0 };
  }

  const lastRecord = sortedData[0];
  const lastDate = lastRecord.date;
  
  // Use adjusted value (stocks_in_eur * eunl_rate_to_trend) if available, otherwise use stocks_in_eur
  let lastValue = parseNumeric(lastRecord.stocks_in_eur!);
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

  // Calculate separate components for daily changes
  const growthPerDay = valueFromGrowth * dailyGrowthRate;
  const contributionPerDay = effectiveMonthlyContribution / 30;
  const totalChangePerDay = growthPerDay + contributionPerDay;

  return {
    currentEstimate,
    changePerDay: totalChangePerDay,
    growthPerDay,
    contributionPerDay
  };
}
