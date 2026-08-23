import { fireEvent, render, screen } from '@testing-library/react';
import { calculateStockChartDomain, StockChart } from '../../components/charts/StockChart';
import { MinRequiredContributionsChart } from '../../components/charts/MinRequiredContributionsChart';
import type { ChartDataPoint, Config, MilestoneMarker } from '../../types';
import { PRIVACY_DATE_MASK, PRIVACY_RATE_MASK, PRIVACY_VALUE_MASK } from '../privacy-utils';

jest.mock('../../hooks/use-privacy-mode', () => ({
  usePrivacyMode: () => ({ isPrivacyMode: true }),
}));

const privateConfig: Config = {
  investment_goal: '987654',
  annual_growth_rate_near_term: '0.073',
  annual_growth_rate_long_term: '0.041',
  planned_monthly_contribution: '1234',
  planned_monthly_contributions_until: '2042-06-15',
};

const chartData: ChartDataPoint[] = [
  {
    investment_date: new Date('2042-01-01'),
    dateFormatted: 'Jan 42',
    stocks_in_eur: 100000,
    stocks_in_eur_adjusted_for_eunl_trend: 110000,
    targetWithFixedContribution: 100000,
    targetWithMinimumContribution: 110000,
    lineWithMinusOnePercentGrowth: 110000,
    lineWithPlusOnePercentGrowth: 110000,
    lineWithTrendGrowth: 110000,
    lineWithTrendGrowthAndPlannedContribution: 110000,
    plannedContributionLine: 100000,
    plannedMinRequiredContribution: 2000,
    expectedMinRequiredContribution: 1900,
    minRequiredContribution: 2100,
    minRequiredContributionAdjustedForEUNLTrend: 2000,
  },
  {
    investment_date: new Date('2042-06-01'),
    dateFormatted: 'Jun 42',
    targetWithFixedContribution: 150000,
    targetWithMinimumContribution: 160000,
    lineWithMinusOnePercentGrowth: 155000,
    lineWithPlusOnePercentGrowth: 165000,
    lineWithTrendGrowth: 170000,
    lineWithTrendGrowthAndPlannedContribution: 180000,
    plannedContributionLine: 175000,
    plannedMinRequiredContribution: 1500,
    expectedMinRequiredContribution: 1400,
    minRequiredContribution: 2100,
    minRequiredContributionAdjustedForEUNLTrend: 2000,
  },
  {
    investment_date: new Date('2042-12-01'),
    dateFormatted: 'Dec 42',
    targetWithFixedContribution: 200000,
    targetWithMinimumContribution: 210000,
    lineWithMinusOnePercentGrowth: 205000,
    lineWithPlusOnePercentGrowth: 215000,
    lineWithTrendGrowth: 220000,
    lineWithTrendGrowthAndPlannedContribution: 230000,
    plannedContributionLine: 225000,
    growthOnlyGoalLine: 190000,
    plannedMinRequiredContribution: 1500,
    expectedMinRequiredContribution: 1400,
    minRequiredContribution: 2100,
    minRequiredContributionAdjustedForEUNLTrend: 2000,
  },
];

const expectSensitiveSentinelsToBeHidden = (container: HTMLElement) => {
  expect(container).toHaveTextContent(PRIVACY_RATE_MASK);
  expect(container).toHaveTextContent(PRIVACY_DATE_MASK);
  expect(container).toHaveTextContent(PRIVACY_VALUE_MASK);
  expect(container).not.toHaveTextContent('7.3 %');
  expect(container).not.toHaveTextContent('4.1 %');
  expect(container).not.toHaveTextContent('12.6 %');
  expect(container).not.toHaveTextContent('2042-06-15');
  expect(container).not.toHaveTextContent('1234');
};

describe('chart privacy legends', () => {
  it('masks configured and fetched values in the owned-stocks legend', () => {
    const { container } = render(
      <StockChart
        title="Owned stocks"
        data={chartData}
        dataKey="stocks_in_eur"
        config={privateConfig}
        trendAnnualGrowthRate={0.126}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show legend' }));

    expectSensitiveSentinelsToBeHidden(container);
  });

  it('masks configured values and scenario labels in the minimum-contribution chart', () => {
    const { container } = render(
      <MinRequiredContributionsChart
        title="Minimum required contributions"
        data={chartData}
        fullData={chartData}
        config={privateConfig}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show legend' }));

    expectSensitiveSentinelsToBeHidden(container);
    expect(container).not.toHaveTextContent('Jun 42');
    expect(container).not.toHaveTextContent('-500');
    expect(container).not.toHaveTextContent('10 000');
  });
});

describe('owned-stocks chart domain', () => {
  const milestones: MilestoneMarker[] = [
    {
      x: 'Jun 42',
      y: 500000,
      label: 'Visible reward',
      condition: 500000,
    },
    {
      x: 'Jan 50',
      y: 900000,
      label: 'Outside range',
      condition: 900000,
    },
  ];

  it('includes visible-X milestones with padding and ignores milestones outside the displayed X range', () => {
    const result = calculateStockChartDomain(chartData, milestones);

    expect(result.visibleMilestoneMarkers).toEqual([milestones[0]]);
    expect(result.domain[1]).toBeGreaterThan(500000);
    expect(result.domain[1]).toBeLessThan(900000);
  });
});
