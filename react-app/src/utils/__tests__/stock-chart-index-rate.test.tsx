import { fireEvent, render, screen } from '@testing-library/react';
import { StockChart } from '../../components/charts/StockChart';
import type { ChartDataPoint } from '../../types';

const chartData: ChartDataPoint[] = [{
  investment_date: new Date('2026-01-01T00:00:00.000Z'),
  dateFormatted: 'Jan 26',
  stocks_in_eur: 100_000,
  targetWithFixedContribution: 100_000,
  targetWithMinimumContribution: 100_000,
  lineWithTrendGrowth: 100_000,
  lineWithTrendGrowthAndPlannedContribution: 100_000,
}];

describe('Owned stocks index-average rate label', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it.each([
    [0.08, '8.0 %'],
    [0.0876, '8.8 %'],
  ])('formats the shared average %p as %s', (averageRate, expectedLabel) => {
    render(
      <StockChart
        title="Owned stocks"
        data={chartData}
        dataKey="stocks_in_eur"
        config={{}}
        trendAnnualGrowthRate={averageRate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show legend' }));

    expect(screen.getByText(`${expectedLabel} index + min`)).toBeInTheDocument();
    expect(screen.getByText(`${expectedLabel} index + planned`)).toBeInTheDocument();
  });
});
