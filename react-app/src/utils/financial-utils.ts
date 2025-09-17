import { APP_CONFIG } from '../config/app-config';
import type { Event, Config, ChartDataPoint } from '../types';

/**
 * Calculate target value with fixed monthly contribution
 */
export function calculateTargetWithFixedContribution(data: Event[], config: Config): ChartDataPoint[] {
  if (!data || data.length === 0) return [];
  
  // Get parameters
  const investmentGoal = parseFloat(config.investment_goal || APP_CONFIG.DEFAULTS.INVESTMENT_GOAL.toString());
  const annualGrowthRate = parseFloat(config.annual_growth_rate || APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE.toString());
  const monthlyGrowthRate = annualGrowthRate / 12;
  
  // Sort data by date to ensure proper order
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Get first and last dates from the raw data (including rows without stocks data)
  const firstDate = sortedData[0].date;
  const lastDate = sortedData[sortedData.length - 1].date;
  
  // Find the first row that actually has stocks data
  const firstStocksData = sortedData.find(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0);
  if (!firstStocksData) return [];
  
  const firstValue = parseFloat(firstStocksData.stocks_in_eur.toString());
  
  // Calculate total number of months from first to last date
  const totalMonths = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth()) + 1;
  
  // Calculate required monthly contribution using future value of annuity formula
  // FV = PMT * [((1 + r)^n - 1) / r] + PV * (1 + r)^n
  // Where: FV = investment goal, PV = present value, r = monthly rate, n = months, PMT = monthly payment
  const futureValueOfPresentValue = firstValue * Math.pow(1 + monthlyGrowthRate, totalMonths - 1);
  const remainingToAchieve = investmentGoal - futureValueOfPresentValue;
  
  let monthlyContribution = 0;
  if (totalMonths > 0 && monthlyGrowthRate > 0) {
    monthlyContribution = remainingToAchieve / ((Math.pow(1 + monthlyGrowthRate, totalMonths - 1) - 1) / monthlyGrowthRate);
  } else if (totalMonths > 0) {
    monthlyContribution = remainingToAchieve / (totalMonths - 1);
  }
  
  // Find the latest data point that has actual stock values
  const latestDataPoint = sortedData
    .filter(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0)
    .pop();
  
  // Calculate minimum required contribution at the latest known data point
  let latestMinRequiredContribution = 0;
  let latestDataPointIndex = -1;
  if (latestDataPoint) {
    latestDataPointIndex = sortedData.findIndex(item => 
      item.date.getTime() === latestDataPoint.date.getTime()
    );
    
    const latestMonthsFromStart = (latestDataPoint.date.getFullYear() - firstDate.getFullYear()) * 12 + 
                                 (latestDataPoint.date.getMonth() - firstDate.getMonth());
    const monthsRemaining = totalMonths - latestMonthsFromStart;
    const currentValue = parseFloat(latestDataPoint.stocks_in_eur.toString());
    const futureValueOfCurrent = currentValue * Math.pow(1 + monthlyGrowthRate, monthsRemaining);
    const remainingToAchieve = investmentGoal - futureValueOfCurrent;
    
    if (monthsRemaining > 0 && monthlyGrowthRate > 0) {
      latestMinRequiredContribution = remainingToAchieve / ((Math.pow(1 + monthlyGrowthRate, monthsRemaining) - 1) / monthlyGrowthRate);
    } else if (monthsRemaining > 0) {
      latestMinRequiredContribution = remainingToAchieve / monthsRemaining;
    }
    latestMinRequiredContribution = Math.max(0, latestMinRequiredContribution);
  }
  
  // Process the raw data and add target calculations
  let previousMinContributionLineValue = 0;
  let previousMinusOnePercentValue = 0;
  let previousPlusOnePercentValue = 0;

  const result = sortedData.map((item, index) => {
    const monthsFromStart = (item.date.getFullYear() - firstDate.getFullYear()) * 12 + 
                           (item.date.getMonth() - firstDate.getMonth());
    
    // Calculate target value for this month
    const targetValue = firstValue * Math.pow(1 + monthlyGrowthRate, monthsFromStart) + 
                       monthlyContribution * ((Math.pow(1 + monthlyGrowthRate, monthsFromStart) - 1) / monthlyGrowthRate);
    
    // Calculate minimum required contribution for this month
    let minRequiredContribution = 0;
    if (index <= latestDataPointIndex) {
      // For points up to and including the latest known data point, calculate normally
      const monthsRemaining = totalMonths - monthsFromStart - 1;
      const currentValue = item.stocks_in_eur ? parseFloat(item.stocks_in_eur.toString()) : 0;
      const futureValueOfCurrent = currentValue * Math.pow(1 + monthlyGrowthRate, monthsRemaining);
      const remainingToAchieve = investmentGoal - futureValueOfCurrent;
      
      if (monthsRemaining > 0 && monthlyGrowthRate > 0) {
        minRequiredContribution = remainingToAchieve / ((Math.pow(1 + monthlyGrowthRate, monthsRemaining) - 1) / monthlyGrowthRate);
      } else if (monthsRemaining > 0) {
        minRequiredContribution = remainingToAchieve / monthsRemaining;
      }
        minRequiredContribution = Math.max(0, minRequiredContribution);
        latestMinRequiredContribution = minRequiredContribution;
    } else {
      // For future points (after latest known data point), use the same value as latest
      minRequiredContribution = latestMinRequiredContribution;
    }
    
    // Calculate minimum contribution line value
    let targetWithMinimumContribution = null;
    if (index === latestDataPointIndex) {
      // Only show this line starting from the last stocks data point
      targetWithMinimumContribution = parseFloat(item.stocks_in_eur!.toString());
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
      const currentStocksValue = parseFloat(item.stocks_in_eur!.toString());
      lineWithMinusOnePercentGrowth = currentStocksValue;
      lineWithPlusOnePercentGrowth = currentStocksValue;
    } else if (index > latestDataPointIndex) {
      // Continue calculating for future months
      lineWithMinusOnePercentGrowth = previousMinusOnePercentValue * (1 + monthlyGrowthRateMinusOne) + latestMinRequiredContribution;
      lineWithPlusOnePercentGrowth = previousPlusOnePercentValue * (1 + monthlyGrowthRatePlusOne) + latestMinRequiredContribution;
    }
    // For months before the last stocks data point, keep as null
    
    const resultItem: ChartDataPoint = {
      ...item,
      dateFormatted: item.date.toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS),
      // Tooltip order: 1. 8% growth scenario, 2. Target with minimum contributions, 3. 6% growth scenario, 4. Current value, 5. Target with fixed contributions
      lineWithPlusOnePercentGrowth: lineWithPlusOnePercentGrowth ? Math.max(0, lineWithPlusOnePercentGrowth) : null,
      targetWithMinimumContribution: targetWithMinimumContribution ? Math.max(0, targetWithMinimumContribution) : null,
      lineWithMinusOnePercentGrowth: lineWithMinusOnePercentGrowth ? Math.max(0, lineWithMinusOnePercentGrowth) : null,
      stocks_in_eur: item.stocks_in_eur ? parseFloat(item.stocks_in_eur.toString()) : null,
      targetWithFixedContribution: Math.max(0, targetValue),
      minRequiredContribution: minRequiredContribution
    };

    // Update previous values for next iteration (only from the last stocks data point onwards)
    if (index >= latestDataPointIndex) {
      if (item.stocks_in_eur) {
        // When we have actual stocks data, reset all previous values to this value
        const currentStocksValue = parseFloat(item.stocks_in_eur.toString());
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
      stocks_in_eur: parseFloat(item.stocks_in_eur!.toString()) || 0
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Calculate exponential trend line for EUNL data
 */
export function calculateExponentialTrend(data: any[]): any[] {
  if (!data || data.length < 2) return data;

  // Convert dates to numeric values (days since first date)
  const firstDate = data[0].date;
  const numericData = data.map((item, index) => ({
    ...item,
    x: (item.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24), // days since first date
    y: item.price
  })).filter(item => item.y !== null);

  if (numericData.length < 2) return data;

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

  // Generate trend line data
  return data.map(item => ({
    ...item,
    trend: a * Math.exp(b * ((item.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))
  }));
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
