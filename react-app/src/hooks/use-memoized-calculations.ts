import { useMemo } from 'react';
import { useKPICalculations } from './use-kpi-calculations';
import { useFinancialCalculations } from './use-financial-calculations';
import type { Event, Config, Condition, EUNLDataPoint, ViewMode } from '../types';

/**
 * Memoized calculations hook for performance optimization
 * Combines multiple calculation hooks with memoization
 */
export function useMemoizedCalculations(
  data: Event[],
  config: Config,
  conditions: Condition[],
  eunlData: EUNLDataPoint[],
  viewMode: ViewMode
) {
  // Memoize KPI calculations
  const kpiCalculations = useKPICalculations();

  // Memoize financial calculations
  const financialCalculations = useFinancialCalculations(data, config, conditions, eunlData, viewMode);

  // Memoize expensive computations
  const memoizedData = useMemo(() => {
    return {
      dataLength: data.length,
      conditionsLength: conditions.length,
      eunlDataLength: eunlData.length,
      hasData: data.length > 0,
      hasConditions: conditions.length > 0,
      hasEunlData: eunlData.length > 0,
    };
  }, [data.length, conditions.length, eunlData.length]);

  // Memoize chart data processing
  const chartData = useMemo(() => {
    if (!financialCalculations.fullChartData.length) {
      return {
        hasChartData: false,
        chartDataCount: 0,
      };
    }

    return {
      hasChartData: true,
      chartDataCount: financialCalculations.fullChartData.length,
      latestDataPoint: financialCalculations.fullChartData[financialCalculations.fullChartData.length - 1],
      firstDataPoint: financialCalculations.fullChartData[0],
    };
  }, [financialCalculations.fullChartData]);

  // Memoize milestone calculations
  const milestones = useMemo(() => {
    if (!financialCalculations.milestoneMarkers.length) {
      return {
        hasMilestones: false,
        milestoneCount: 0,
      };
    }

    return {
      hasMilestones: true,
      milestoneCount: financialCalculations.milestoneMarkers.length,
      milestones: financialCalculations.milestoneMarkers,
    };
  }, [financialCalculations.milestoneMarkers]);

  return {
    kpiCalculations,
    financialCalculations,
    memoizedData,
    chartData,
    milestones,
  };
}
