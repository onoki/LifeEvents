import React from 'react';
import { ViewModeToggle } from './ViewModeToggle';
import { StockChart } from './StockChart';
import { MinRequiredContributionsChart } from './MinRequiredContributionsChart';
import { IndexHistoryChart } from './IndexHistoryChart';
import { ConditionsTable } from './ConditionsTable';
import { RetirementCoverageChart } from './RetirementCoverageChart';
import { useFinancialCalculations } from '../../hooks/use-financial-calculations';
import { useKPICalculations } from '../../hooks/use-kpi-calculations';
import { APP_CONFIG } from '../../config/app-config';
import { calculateCurrentStockEstimate } from '../../utils/financial-utils';
import { calculateRetirementCoverage } from '../../utils/retirement-coverage-utils';
import { parseNumeric } from '../../utils/number-utils';
import { parseLocalCalendarDate } from '../../utils/date-utils';
import type { StockChartsProps } from '../../types';

const parseConfigNumber = (value: string | undefined, fallback: number): number => {
  const parsed = parseNumeric(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Stock Charts Container Component
 * Displays stock-related charts with view mode controls
 */
export function StockCharts({ 
  data, 
  config, 
  conditions, 
  afterGoalMonthlyCosts,
  indexDataBySymbol,
  indexTrendStatsBySymbol,
  onFetchIndexData,
  loading,
  viewMode,
  onViewModeChange,
  averageIndexTrendStats,
  indexError,
  indexNotice
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
  const { currentTime } = useKPICalculations();

  const retirementCoverage = React.useMemo(() => {
    const goalDate = data.reduce<Date | null>((latest, item) => {
      const candidate = item.investment_date;
      if (!(candidate instanceof Date) || Number.isNaN(candidate.getTime())) return latest;
      return latest === null || candidate > latest ? candidate : latest;
    }, null);
    if (goalDate === null) return null;

    const todayEstimate = calculateCurrentStockEstimate(
      data,
      config,
      currentTime,
      fullChartData
    ).currentEstimate;
    const annualGrowthRateLongTerm = parseConfigNumber(
      config.annual_growth_rate_long_term,
      APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE_LONG_TERM
    );
    const annualGrowthRateNearTerm = parseConfigNumber(
      config.annual_growth_rate_near_term,
      APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE_NEAR_TERM
    );
    const plannedMonthlyContributionsUntil = config.planned_monthly_contributions_until
      ? parseLocalCalendarDate(config.planned_monthly_contributions_until)
      : null;
    const annualInflationRate = parseConfigNumber(
      config.annual_inflation_rate,
      APP_CONFIG.DEFAULTS.ANNUAL_INFLATION_RATE
    );
    const effectiveCapitalIncomeTaxRate = parseConfigNumber(
      config.effective_capital_income_tax_rate,
      APP_CONFIG.DEFAULTS.EFFECTIVE_CAPITAL_INCOME_TAX_RATE
    );
    const investmentGoal = parseConfigNumber(
      config.investment_goal,
      APP_CONFIG.DEFAULTS.INVESTMENT_GOAL
    );

    return {
      goalDate,
      result: calculateRetirementCoverage({
        asOfDate: currentTime,
        goalDate,
        todayEstimate,
        investmentGoal,
        annualGrowthRateNearTerm,
        annualGrowthRateLongTerm,
        plannedMonthlyContributionsUntil,
        annualInflationRate,
        effectiveCapitalIncomeTaxRate,
        costs: afterGoalMonthlyCosts,
      }),
    };
  }, [afterGoalMonthlyCosts, config, currentTime, data, fullChartData]);

  const handleFetchIndexData = async (symbol?: string): Promise<void> => {
    if (onFetchIndexData) {
      await onFetchIndexData(symbol);
    }
  };

  const filteredTimestamps = new Set(filteredData.map((item) => item.investment_date.getTime()));
  const filteredChartData = fullChartData.filter((item) => (
    filteredTimestamps.has(item.investment_date.getTime())
  ));

  return (
    <div className="space-y-6">
      {/* View Mode Toggle Control */}
      <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} config={config} />

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
          averageIndexTrendStats={averageIndexTrendStats}
          onFetchIndexData={handleFetchIndexData}
          loading={loading}
          stocksData={data}
          config={config}
          viewMode={viewMode}
          indexError={indexError}
          indexNotice={indexNotice}
        />
      </div>

      {retirementCoverage && (
        <div className="mb-8">
          <RetirementCoverageChart
            result={retirementCoverage.result}
            goalDate={retirementCoverage.goalDate}
          />
        </div>
      )}
    </div>
  );
}
