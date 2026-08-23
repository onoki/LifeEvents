import React from 'react';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FocusedSavingsCard } from '../../components/kpi/FocusedSavingsCard';
import { MiniRewardsCard } from '../../components/kpi/MiniRewardsCard';
import { RetirementCard } from '../../components/kpi/RetirementCard';
import { WorkProgressCard } from '../../components/kpi/WorkProgressCard';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { PRIVACY_DATE_MASK, PRIVACY_RATE_MASK, PRIVACY_VALUE_MASK } from '../privacy-utils';
import type { ChartDataPoint } from '../../types';

const mockKpiCalculations = {
  hoursToWorkEnd: 3.75,
  workProgress: 42.25,
  workTimeFormatted: '3 h 45 m',
  retirementTimeFormatted: '16 y 2 m',
  retirementProgress: 61.75,
  retirementWorkdays: 123456,
  daysToRetirement: 5913,
  currentTime: new Date(2027, 0, 15, 12),
};

jest.mock('../../hooks/use-kpi-calculations', () => ({
  useKPICalculations: () => mockKpiCalculations,
}));

jest.mock('../financial-utils', () => ({
  calculateTargetWithFixedContribution: (): ChartDataPoint[] => [{
    investment_date: new Date(2027, 0, 1),
    dateFormatted: 'Jan 27',
    minRequiredContributionAdjustedForEUNLTrend: 1000,
  }],
  calculateCurrentStockEstimate: () => ({ currentEstimate: 500000, contributionPerDay: 25 }),
  calculateRequiredMonthlyContributionForDates: () => 0,
  formatPercentage: (value: number, decimals: number) => `${value.toFixed(decimals)} %`,
  getAnnualGrowthRateForDate: () => 0.07,
}));

function PrivacyProbe(): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  return <span>{isPrivacyMode ? 'private' : 'public'}</span>;
}

describe('privacy mode initial render', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('enables privacy mode on the initial render when the URL requests it', () => {
    window.history.replaceState({}, '', '/?privacy=true');

    // Server rendering does not run effects, so this specifically verifies that
    // the very first render reads the URL instead of exposing the public state.
    expect(renderToStaticMarkup(<PrivacyProbe />)).toContain('private');
  });

  it('uses public mode on the initial render without the privacy parameter', () => {
    window.history.replaceState({}, '', '/');

    expect(renderToStaticMarkup(<PrivacyProbe />)).toContain('public');
  });
});

describe('KPI privacy labels', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?privacy=true');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('masks user-specific values in all visible KPI cards', () => {
    const { container } = render(
      <>
        <WorkProgressCard />
        <FocusedSavingsCard config={{ planned_monthly_contributions_until: '2028-12-31' }} />
        <RetirementCard />
        <MiniRewardsCard
          data={[{ investment_date: new Date(2043, 0, 1), stocks_in_eur: 500000 }]}
          config={{ investment_goal: '500000' }}
          miniRewards={[{ percentage: 50, taken: false }]}
        />
      </>
    );

    expect(container).toHaveTextContent(PRIVACY_VALUE_MASK);
    expect(container).toHaveTextContent(PRIVACY_RATE_MASK);
    expect(container).toHaveTextContent(PRIVACY_DATE_MASK);
    expect(container).toHaveTextContent(`${PRIVACY_VALUE_MASK} workdays`);
    expect(container).toHaveTextContent(`${PRIVACY_VALUE_MASK} untaken rewards`);

    [
      '3 h 45 m',
      '42.25 %',
      '8:30',
      '16:30',
      '2026-09-14',
      '2028-12-31',
      '16 y 2 m',
      '61.75 %',
      '123 456 workdays',
      '2013-11-18',
      '2043-02-19',
      '0 d',
      '100.00 %',
      '99 %',
      '1 untaken rewards',
    ].forEach((value) => expect(container).not.toHaveTextContent(value));
  });

  it('keeps the regular work-card labels outside privacy mode', () => {
    window.history.replaceState({}, '', '/');

    const { container } = render(<WorkProgressCard />);

    expect(container).toHaveTextContent('3 h 45 m');
    expect(container).toHaveTextContent('42.25 %');
    expect(container).toHaveTextContent('8:30');
    expect(container).toHaveTextContent('16:30');
  });
});
