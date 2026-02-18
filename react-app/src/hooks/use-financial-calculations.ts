import { useMemo } from 'react';
import { calculateTargetWithFixedContribution, processStocksData } from '../utils/financial-utils';
import { filterDataByViewMode, calculateMilestoneMarkers } from '../utils/data-processing-utils';
import type { Event, Config, Condition, ChartDataPoint, ViewMode, MilestoneMarker } from '../types';

export interface FinancialCalculations {
  // Chart data
  fullChartData: ChartDataPoint[];
  fullStocksData: ChartDataPoint[];
  filteredData: Event[];
  stocksData: ChartDataPoint[];

  // Milestone markers
  milestoneMarkers: MilestoneMarker[];
}

/**
 * Custom hook for financial calculations
 */
export function useFinancialCalculations(
  data: Event[],
  config: Config,
  conditions: Condition[],
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

    // Calculate milestone markers
    const milestoneMarkers = calculateMilestoneMarkers(fullChartData, conditions);
    
    return {
      fullChartData,
      fullStocksData,
      filteredData,
      stocksData,
      milestoneMarkers,
    };
  }, [data, config, conditions, viewMode, trendAnnualGrowthRate]);

  return calculations;
}
