import React, { useState } from 'react';
import { ViewModeToggle } from './ViewModeToggle';
import { StockChart } from './StockChart';
import { MinRequiredContributionsChart } from './MinRequiredContributionsChart';
import { EUNLChart } from './EUNLChart';
import { ConditionsTable } from './ConditionsTable';
import { useFinancialCalculations } from '../../hooks/use-financial-calculations';
import type { StockChartsProps, ViewMode } from '../../types';

/**
 * Stock Charts Container Component
 * Displays stock-related charts with view mode controls
 */
export function StockCharts({ 
  data, 
  config, 
  conditions, 
  eunlData, 
  onFetchEUNL, 
  loading,
  eunlTrendStats,
  eunlError
}: StockChartsProps): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('next2years');

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
    eunlChartData,
    milestoneMarkers
  } = useFinancialCalculations(
    data,
    config,
    conditions,
    eunlData,
    viewMode,
    eunlTrendStats?.annualGrowthRate
  );

  // Wrap onFetchEUNL to also set viewMode to 'recorded'
  const handleFetchEUNL = async (): Promise<void> => {
    setViewMode('recorded');
    if (onFetchEUNL) {
      await onFetchEUNL();
    }
  };

  return (
    <div className="space-y-6">
      {/* View Mode Toggle Control */}
      <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* Owned stocks chart - full width */}
      <div className="mb-8">
        <StockChart 
          title="Owned stocks" 
          data={fullChartData.filter(item => filteredData.some(filteredItem => filteredItem.date.getTime() === item.date.getTime()))}
          dataKey="stocks_in_eur"
          config={config}
          conditions={conditions}
          trendAnnualGrowthRate={eunlTrendStats?.annualGrowthRate ?? null}
          rawData={data}
        />
        
        {/* Conditions table below the chart */}
        <ConditionsTable conditions={conditions} events={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-6 mb-8">
        {/* Minimum Required Contributions Chart */}
        <MinRequiredContributionsChart 
          title="Minimum required monthly contributions to reach the goal" 
          data={fullChartData.filter(item => filteredData.some(filteredItem => filteredItem.date.getTime() === item.date.getTime()))}
          config={config}
        />
        
        <EUNLChart 
          title="EUNL ETF history" 
          data={eunlChartData}
          onFetchEUNL={handleFetchEUNL}
          loading={loading}
          showOnlyDataWithStocks={viewMode === 'recorded'}
          stocksData={filteredData}
          viewMode={viewMode}
          trendStats={eunlTrendStats}
          eunlError={eunlError}
        />
      </div>
    </div>
  );
}
