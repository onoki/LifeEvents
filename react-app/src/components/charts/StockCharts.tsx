import React from 'react';
import { ViewModeToggle } from './ViewModeToggle';
import { StockChart } from './StockChart';
import { MinRequiredContributionsChart } from './MinRequiredContributionsChart';
import { IndexHistoryChart } from './IndexHistoryChart';
import { ConditionsTable } from './ConditionsTable';
import { useFinancialCalculations } from '../../hooks/use-financial-calculations';
import type { StockChartsProps } from '../../types';

/**
 * Stock Charts Container Component
 * Displays stock-related charts with view mode controls
 */
export function StockCharts({ 
  data, 
  config, 
  conditions, 
  indexDataBySymbol,
  indexTrendStatsBySymbol,
  onFetchIndexData,
  loading,
  viewMode,
  onViewModeChange,
  averageIndexTrendStats,
  indexError
}: StockChartsProps): React.JSX.Element {

  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-6 mb-8">
        <div className="text-center py-8 text-muted-foreground">
          No stock data available
        </div>
      </div>
    );
  }

  const {
    fullChartData,
    filteredData,
    milestoneMarkers
  } = useFinancialCalculations(
    data,
    config,
    conditions,
    viewMode,
    averageIndexTrendStats?.annualGrowthRate
  );

  const handleFetchIndexData = async (): Promise<void> => {
    if (onFetchIndexData) {
      await onFetchIndexData();
    }
  };

  const filteredTimestamps = new Set(filteredData.map((item) => item.date.getTime()));
  const filteredChartData = fullChartData.filter((item) => filteredTimestamps.has(item.date.getTime()));

  return (
    <div className="space-y-6">
      {/* View Mode Toggle Control */}
      <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />

      {/* Owned stocks chart - full width */}
      <div className="mb-8">
        <StockChart 
          title="Owned stocks" 
          data={filteredChartData}
          progressAxisData={fullChartData}
          dataKey="stocks_in_eur"
          config={config}
          milestoneMarkers={milestoneMarkers}
          trendAnnualGrowthRate={averageIndexTrendStats?.annualGrowthRate ?? null}
          rawData={data}
        />
        
        {/* Conditions table below the chart */}
        <ConditionsTable conditions={conditions} events={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-6 mb-8">
        {/* Minimum Required Contributions Chart */}
        <MinRequiredContributionsChart 
          title="Minimum required monthly contributions to reach the goal" 
          data={filteredChartData}
          fullData={fullChartData}
          config={config}
        />
        
        <IndexHistoryChart
          title="Index history"
          indexDataBySymbol={indexDataBySymbol}
          indexTrendStatsBySymbol={indexTrendStatsBySymbol}
          onFetchIndexData={handleFetchIndexData}
          loading={loading}
          showOnlyDataWithStocks={viewMode === 'recorded'}
          stocksData={filteredData}
          viewMode={viewMode}
          indexError={indexError}
        />
      </div>
    </div>
  );
}
