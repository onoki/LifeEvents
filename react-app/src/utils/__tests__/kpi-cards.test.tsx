import React from 'react';
import { render } from '@testing-library/react';
import { KPICards } from '../../components/kpi/KPICards';
import { APP_CONFIG } from '../../config/app-config';

jest.mock('../../components/kpi/WorkProgressCard', () => ({
  WorkProgressCard: () => <div data-testid="kpi-work">Work</div>,
}));

jest.mock('../../components/kpi/MiniRewardsCard', () => ({
  MiniRewardsCard: () => <div data-testid="kpi-mini-rewards">Mini rewards</div>,
}));

jest.mock('../../components/kpi/FocusedSavingsCard', () => ({
  FocusedSavingsCard: () => <div data-testid="kpi-focused-savings">Focused savings</div>,
}));

jest.mock('../../components/kpi/RetirementCard', () => ({
  RetirementCard: () => <div data-testid="kpi-retirement">Retirement</div>,
}));

const featureFlags = APP_CONFIG.FEATURE_FLAGS as {
  SHOW_MINI_REWARDS_CARD: boolean;
};

const renderKpiCards = () => render(
  <KPICards data={[]} config={{}} miniRewards={[]} />
);

const renderedCardOrder = (container: HTMLElement): string[] => (
  Array.from(container.querySelectorAll('[data-testid^="kpi-"]'))
    .map((element) => element.getAttribute('data-testid') ?? '')
);

describe('KPI card feature flags', () => {
  beforeEach(() => {
    featureFlags.SHOW_MINI_REWARDS_CARD = false;
  });

  afterEach(() => {
    featureFlags.SHOW_MINI_REWARDS_CARD = false;
    window.history.replaceState({}, '', '/');
  });

  it.each(['/', '/?privacy=true'])(
    'hides the second Mini Rewards card by default at %s',
    (url) => {
      window.history.replaceState({}, '', url);

      const { container, queryByTestId } = renderKpiCards();

      expect(APP_CONFIG.FEATURE_FLAGS.SHOW_MINI_REWARDS_CARD).toBe(false);
      expect(queryByTestId('kpi-mini-rewards')).not.toBeInTheDocument();
      expect(renderedCardOrder(container)).toEqual([
        'kpi-work',
        'kpi-focused-savings',
        'kpi-retirement',
      ]);
      expect(container.firstElementChild).toHaveClass('lg:grid-cols-3');
    }
  );

  it('restores Mini Rewards in its original second position when enabled', () => {
    featureFlags.SHOW_MINI_REWARDS_CARD = true;

    const { container, getByTestId } = renderKpiCards();

    expect(getByTestId('kpi-mini-rewards')).toBeInTheDocument();
    expect(renderedCardOrder(container)).toEqual([
      'kpi-work',
      'kpi-mini-rewards',
      'kpi-focused-savings',
      'kpi-retirement',
    ]);
    expect(container.firstElementChild).toHaveClass('lg:grid-cols-4');
  });
});
