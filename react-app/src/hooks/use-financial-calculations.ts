import { useMemo } from 'react';
import { calculateTargetWithFixedContribution, processStocksData, calculateExponentialTrend } from '../utils/financial-utils';
import { filterDataByViewMode, calculateMilestoneMarkers } from '../utils/data-processing-utils';
import type { Event, Config, Condition, ChartDataPoint, EUNLDataPoint, ViewMode } from '../types';

export interface FinancialCalculations {
  // Chart data
  fullChartData: ChartDataPoint[];
  fullStocksData: ChartDataPoint[];
  filteredData: Event[];
  stocksData: ChartDataPoint[];
  
  // EUNL data
  eunlChartData: EUNLDataPoint[];
  
  // Milestone markers
  milestoneMarkers: Array<{ x: string; y: number; label: string; condition: number }>;
}

/**
 * Custom hook for financial calculations
 */
export function useFinancialCalculations(
  data: Event[],
  config: Config,
  conditions: Condition[],
  eunlData: EUNLDataPoint[],
  viewMode: ViewMode,
  trendAnnualGrowthRate?: number | null
): FinancialCalculations {
  
  const calculations = useMemo((): FinancialCalculations => {
    // Always calculate with full data range for consistent target lines
    const fullChartData = calculateTargetWithFixedContribution(data, config, trendAnnualGrowthRate);
    const fullStocksData = processStocksData(data);
    
    // Filter data based on view mode (only for display)
    const filteredData = filterDataByViewMode(data, viewMode);
    const stocksData = processStocksData(filteredData);
    
    // Calculate EUNL chart data with trend
    const { data: eunlChartData } = calculateExponentialTrend(eunlData);
    
    // Calculate milestone markers
    const milestoneMarkers = calculateMilestoneMarkers(fullChartData, conditions);
    
    return {
      fullChartData,
      fullStocksData,
      filteredData,
      stocksData,
      eunlChartData,
      milestoneMarkers,
    };
  }, [data, config, conditions, eunlData, viewMode, trendAnnualGrowthRate]);

  return calculations;
}
