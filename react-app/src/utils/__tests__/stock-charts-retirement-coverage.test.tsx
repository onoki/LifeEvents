import { render, screen } from '@testing-library/react';
import { StockCharts } from '../../components/charts/StockCharts';
import { calculateCurrentStockEstimate } from '../financial-utils';
import type { Event } from '../../types';

jest.mock('../../hooks/use-financial-calculations', () => ({
  useFinancialCalculations: (data: Event[]) => ({
    fullChartData: data.map((item) => ({
      ...item,
      dateFormatted: item.investment_date.toISOString().slice(0, 10),
    })),
    filteredData: data,
    milestoneMarkers: [],
  }),
}));

jest.mock('../../hooks/use-kpi-calculations', () => ({
  useKPICalculations: () => ({ currentTime: new Date(2026, 0, 1) }),
}));

jest.mock('../financial-utils', () => ({
  calculateCurrentStockEstimate: jest.fn(() => ({
    currentEstimate: 100_000,
    uncorrectedEstimate: 90_000,
    changePerDay: 0,
    growthPerDay: 0,
    contributionPerDay: 0,
  })),
}));

jest.mock('../../components/charts/ViewModeToggle', () => ({ ViewModeToggle: () => null }));
jest.mock('../../components/charts/StockChart', () => ({ StockChart: () => null }));
jest.mock('../../components/charts/MinRequiredContributionsChart', () => ({
  MinRequiredContributionsChart: () => null,
}));
jest.mock('../../components/charts/IndexHistoryChart', () => ({ IndexHistoryChart: () => null }));
jest.mock('../../components/charts/ConditionsTable', () => ({ ConditionsTable: () => null }));
jest.mock('../../components/charts/RetirementCoverageChart', () => ({
  RetirementCoverageChart: ({ result, goalDate }: {
    result: {
      todayEstimate: { today: number; atGoal: { future: number } };
      existingSavingsMonthlyIncome: { future: number };
      goalMonthlyIncome: { future: number };
      totalMonthlyCosts: { future: number };
    };
    goalDate: Date;
  }) => (
    <div
      data-testid="wired-retirement-coverage"
      data-goal-date={`${goalDate.getFullYear()}-${String(goalDate.getMonth() + 1).padStart(2, '0')}-${String(goalDate.getDate()).padStart(2, '0')}`}
      data-today-estimate={result.todayEstimate.today}
      data-projected-balance={result.todayEstimate.atGoal.future}
      data-existing-income={result.existingSavingsMonthlyIncome.future}
      data-goal-income={result.goalMonthlyIncome.future}
      data-costs={result.totalMonthlyCosts.future}
    />
  ),
}));

describe('StockCharts retirement coverage wiring', () => {
  it('uses the Owned-stocks estimate and the final investment_date with configured assumptions', () => {
    const data: Event[] = [
      { investment_date: new Date(2028, 0, 1) },
      { investment_date: new Date(2026, 0, 1), stocks_in_eur: '100000' },
      { investment_date: new Date(2027, 0, 1) },
    ];

    render(
      <StockCharts
        data={data}
        config={{
          investment_goal: '200000',
          annual_growth_rate_near_term: '0.24',
          annual_growth_rate_long_term: '0.12',
          planned_monthly_contributions_until: '2026-12-01',
          annual_inflation_rate: '0',
          effective_capital_income_tax_rate: '0.25',
          planned_monthly_contribution: '99999',
        }}
        conditions={[]}
        afterGoalMonthlyCosts={[
          { category: 'Living', monthlySum: 120, skipInflation: false },
        ]}
        indexDataBySymbol={{}}
        indexTrendStatsBySymbol={{}}
        onFetchIndexData={async () => undefined}
        loading={false}
        viewMode="next2years"
        onViewModeChange={() => undefined}
      />
    );

    const coverage = screen.getByTestId('wired-retirement-coverage');
    const projectedBalance = 100_000 * Math.pow(1.02, 12) * Math.pow(1.01, 12);

    expect(calculateCurrentStockEstimate).toHaveBeenCalled();
    expect(coverage).toHaveAttribute('data-goal-date', '2028-01-01');
    expect(Number(coverage.getAttribute('data-today-estimate'))).toBe(100_000);
    expect(Number(coverage.getAttribute('data-projected-balance'))).toBeCloseTo(projectedBalance, 6);
    expect(Number(coverage.getAttribute('data-existing-income'))).toBeCloseTo(
      projectedBalance * 0.01 * 0.75,
      6
    );
    expect(Number(coverage.getAttribute('data-goal-income'))).toBe(1_500);
    expect(Number(coverage.getAttribute('data-costs'))).toBe(120);
  });
});
