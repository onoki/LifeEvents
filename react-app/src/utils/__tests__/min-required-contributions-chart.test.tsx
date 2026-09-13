import { render, screen, within } from '@testing-library/react';
import { MinRequiredContributionsChart } from '../../components/charts/MinRequiredContributionsChart';
import type { ChartDataPoint, Config } from '../../types';
import { PRIVACY_VALUE_MASK } from '../privacy-utils';

const config: Config = {
  investment_goal: '500000',
  annual_growth_rate_near_term: '0.05',
  annual_growth_rate_long_term: '0.04',
  planned_monthly_contribution: '750',
};

const chartData: ChartDataPoint[] = [
  {
    investment_date: new Date(2026, 0, 1),
    dateFormatted: 'Jan 26',
    stocks_in_eur: 100000,
    minRequiredContribution: 1500,
    minRequiredContributionAdjustedForEUNLTrend: 1400,
  },
  {
    investment_date: new Date(2026, 1, 1),
    dateFormatted: 'Feb 26',
    stocks_in_eur: 110000,
    minRequiredContribution: 1200,
    minRequiredContributionAdjustedForEUNLTrend: 1100,
  },
  {
    investment_date: new Date(2026, 2, 1),
    dateFormatted: 'Mar 26',
    minRequiredContribution: 50,
    minRequiredContributionAdjustedForEUNLTrend: 40,
  },
];

describe('MinRequiredContributionsChart latest contribution summary', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('shows the two hover-equivalent values from the latest recorded month below the chart', () => {
    render(
      <MinRequiredContributionsChart
        title="Minimum required contributions"
        data={chartData}
        fullData={chartData}
        config={config}
      />
    );

    const summary = screen.getByTestId('latest-contribution-summary');
    expect(within(summary).getByText('Latest recorded values')).toBeInTheDocument();
    expect(within(summary).getByText('Contribution (index trend)')).toBeInTheDocument();
    expect(within(summary).getByText('1 100 €')).toBeInTheDocument();
    expect(within(summary).getByText('Min required contribution')).toBeInTheDocument();
    expect(within(summary).getByText('1 200 €')).toBeInTheDocument();
    expect(summary).not.toHaveTextContent('40 €');
    expect(summary).not.toHaveTextContent('50 €');
  });

  it('masks both latest values in privacy mode while retaining their units', () => {
    window.history.replaceState({}, '', '/?privacy=true');

    const { container } = render(
      <MinRequiredContributionsChart
        title="Minimum required contributions"
        data={chartData}
        fullData={chartData}
        config={config}
      />
    );

    const summary = screen.getByTestId('latest-contribution-summary');
    expect(within(summary).getAllByText(`${PRIVACY_VALUE_MASK} €`)).toHaveLength(2);
    expect(summary).not.toHaveTextContent('1 100 €');
    expect(summary).not.toHaveTextContent('1 200 €');

    const accessibilityText = Array.from(container.querySelectorAll('[aria-label], [title]'))
      .flatMap((element) => [element.getAttribute('aria-label'), element.getAttribute('title')])
      .filter((value): value is string => value !== null)
      .join(' ');
    expect(accessibilityText).not.toMatch(/(?:1 100|1100|1 200|1200)/);
  });

  it('keeps valid zero contribution values visible', () => {
    const zeroContributionData: ChartDataPoint[] = chartData.map((point, index) => (
      index === 1
        ? {
            ...point,
            minRequiredContribution: 0,
            minRequiredContributionAdjustedForEUNLTrend: 0,
          }
        : point
    ));

    render(
      <MinRequiredContributionsChart
        title="Minimum required contributions"
        data={zeroContributionData}
        fullData={zeroContributionData}
        config={config}
      />
    );

    const summary = screen.getByTestId('latest-contribution-summary');
    expect(within(summary).getAllByText('0 €')).toHaveLength(2);
  });

  it('does not render a summary when there is no positive recorded portfolio value', () => {
    const projectionOnlyData: ChartDataPoint[] = chartData.map((point, index) => ({
      ...point,
      stocks_in_eur: index === 0 ? 0 : null,
    }));

    render(
      <MinRequiredContributionsChart
        title="Minimum required contributions"
        data={projectionOnlyData}
        fullData={projectionOnlyData}
        config={config}
      />
    );

    expect(screen.queryByTestId('latest-contribution-summary')).not.toBeInTheDocument();
  });
});
