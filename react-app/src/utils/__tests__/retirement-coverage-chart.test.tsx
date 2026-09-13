import { fireEvent, render, screen, within } from '@testing-library/react';
import { RetirementCoverageChart } from '../../components/charts/RetirementCoverageChart';
import { PRIVACY_VALUE_MASK } from '../privacy-utils';
import type { RetirementCoverageResult } from '../retirement-coverage-utils';

const GOAL_DATE = new Date(2047, 5, 30);

const makeResult = (): RetirementCoverageResult => ({
  asOfYear: 2026,
  projectionMonths: 240,
  projectionYears: 20,
  investmentGrowthFactor: 3,
  inflationFactor: 1.2,
  netMonthlyReturnRate: 0.005,
  categories: [
    {
      category: 'Private home costs',
      skipInflation: false,
      monthlyCost: { currentYear: 1000, future: 1200 },
    },
    {
      category: 'Private food budget',
      skipInflation: false,
      monthlyCost: { currentYear: 500, future: 600 },
    },
    {
      category: 'Private fixed contract',
      skipInflation: true,
      monthlyCost: { currentYear: 250, future: 250 },
    },
  ],
  todayEstimate: {
    today: 100000,
    atGoal: { currentYear: 250000, future: 300000 },
  },
  investmentGoal: { currentYear: 500000, future: 600000 },
  requiredSavings: { currentYear: 350000, future: 410000 },
  existingSavingsMonthlyIncome: { currentYear: 1250, future: 1500 },
  goalMonthlyIncome: { currentYear: 2500, future: 3000 },
  totalMonthlyCosts: { currentYear: 1750, future: 2050 },
  existingSavingsBufferOrGap: { currentYear: -500, future: -550 },
  goalBufferOrGap: { currentYear: 750, future: 950 },
});

const makeGapResult = (): RetirementCoverageResult => ({
  ...makeResult(),
  todayEstimate: {
    today: 40000,
    atGoal: { currentYear: 100000, future: 120000 },
  },
  investmentGoal: { currentYear: 200000, future: 240000 },
  existingSavingsMonthlyIncome: { currentYear: 500, future: 600 },
  goalMonthlyIncome: { currentYear: 1000, future: 1200 },
  existingSavingsBufferOrGap: { currentYear: -1250, future: -1450 },
  goalBufferOrGap: { currentYear: -750, future: -850 },
});

describe('RetirementCoverageChart', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('removes summary boxes and merges monthly context into the single bar', () => {
    render(<RetirementCoverageChart result={makeResult()} goalDate={GOAL_DATE} />);

    expect(screen.getByText('Retirement monthly cost coverage')).toBeInTheDocument();
    expect(screen.queryByText('Today’s corrected estimate')).not.toBeInTheDocument();
    expect(screen.queryByText('Future nominal at 30 Jun 2047')).not.toBeInTheDocument();
    expect(screen.queryByText('After-tax monthly income')).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly costs')).not.toBeInTheDocument();
    expect(screen.queryByText(/^At-goal monthly costs/)).not.toBeInTheDocument();
    expect(screen.getByTestId('coverage-axis-future')).toHaveTextContent(
      'Scale maximum 600 000 € (at-goal costs 2 050 €/month)'
    );
    expect(screen.getByText(/Current savings at goal date:/)).toHaveTextContent(
      'Current savings at goal date: 300 000 € (1 500 €/month after tax)'
    );
    expect(
      screen.getByText(
        'At investment goal date: Full cost coverage plus a 950 €/month buffer.'
      )
    ).toHaveAttribute('data-state', 'buffer');
    expect(screen.getByTestId('coverage-notes')).toHaveTextContent(
      'Coverage projects today’s estimated portfolio using long-term growth only; future contributions are not included.'
    );
    expect(screen.getByTestId('coverage-notes')).toHaveTextContent(
      'Office, spa renovations and time with kids when young, are not included'
    );
  });

  it('uses the requested year-based terminology in the current-savings tooltip', () => {
    render(<RetirementCoverageChart result={makeResult()} goalDate={GOAL_DATE} />);

    const marker = screen.getByTestId('coverage-marker-future');
    expect(marker).not.toHaveAttribute('title');
    fireEvent.click(marker);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Current savings');
    expect(tooltip).toHaveTextContent('Year 2026: 100 000 €');
    expect(tooltip).toHaveTextContent('At goal in year 2026 money: 250 000 €');
    expect(tooltip).toHaveTextContent('At goal nominal money: 300 000 €');
    expect(tooltip).toHaveTextContent('After-tax monthly income at goal: 1 500 €/month');
  });

  it('shows investment-goal information only through its interactive dashed line', () => {
    render(<RetirementCoverageChart result={makeResult()} goalDate={GOAL_DATE} />);

    const goalMarker = screen.getByTestId('coverage-threshold-investment-goal-future');
    expect(goalMarker).toHaveAttribute('data-position', '100');
    expect(goalMarker.querySelector('span')).toHaveClass('border-dashed', 'border-l-2');
    expect(screen.getByText('Investment goal')).toBeInTheDocument();
    expect(screen.queryByText('Investment goal 600 000 €')).not.toBeInTheDocument();

    fireEvent.mouseEnter(goalMarker);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Investment goal');
    expect(tooltip).toHaveTextContent('At goal in year 2026 money: 500 000 €');
    expect(tooltip).toHaveTextContent('At goal nominal money: 600 000 €');
    expect(tooltip).toHaveTextContent('After-tax monthly income at goal: 3 000 €/month');
  });

  it('uses a thick required-savings marker and preserves both threshold positions', () => {
    render(<RetirementCoverageChart result={makeResult()} goalDate={GOAL_DATE} />);

    expect(screen.getByTestId('coverage-threshold-required-savings-future')).toHaveAttribute(
      'data-position',
      '68.3'
    );
    expect(
      screen.getByTestId('coverage-threshold-required-savings-future').querySelector('span')
    ).toHaveClass('border-l-4');
    expect(screen.getByTestId('coverage-threshold-label-required-savings-future')).toHaveTextContent(
      'Required savings 410 000 €'
    );
    expect(screen.getByTestId('coverage-buffer-future')).toHaveStyle({
      left: '68.3%',
      width: '31.7%',
    });
    expect(screen.getByTestId('coverage-progress-future')).toHaveStyle({ width: '50%' });
  });

  it('uses immediate category tooltips and does not wrap the rainbow back to red', () => {
    const result = makeResult();
    result.categories = Array.from({ length: 10 }, (_, index) => ({
      category: `Category ${index + 1}`,
      skipInflation: false,
      monthlyCost: { currentYear: 100, future: 100 },
    }));
    result.totalMonthlyCosts = { currentYear: 1000, future: 1000 };
    result.requiredSavings = { currentYear: 200000, future: 200000 };

    const { container } = render(
      <RetirementCoverageChart result={result} goalDate={GOAL_DATE} />
    );

    const firstCategory = screen.getByTestId('coverage-category-future-0');
    const yellowCategory = screen.getByTestId('coverage-category-future-3');
    const purpleCategory = screen.getByTestId('coverage-category-future-8');
    const finalCategory = screen.getByTestId('coverage-category-future-9');
    expect(firstCategory).toHaveStyle({ backgroundColor: 'rgb(251, 113, 133)' });
    expect(yellowCategory).toHaveStyle({ backgroundColor: 'rgb(234, 179, 8)' });
    expect(purpleCategory).toHaveStyle({ backgroundColor: 'rgb(139, 92, 246)' });
    expect(finalCategory).toHaveStyle({ backgroundColor: 'rgb(30, 41, 59)' });
    expect(container).not.toHaveTextContent('Category 1');

    fireEvent.mouseEnter(firstCategory);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Category 1Current monthly cost 100 €/monthFuture monthly cost 100 €/month'
    );

    fireEvent.mouseEnter(finalCategory);
    expect(finalCategory).toHaveAttribute('data-active', 'true');
    expect(finalCategory).toHaveStyle({
      filter: 'brightness(1.65)',
      boxShadow: 'inset 0 0 0 2px rgba(255, 255, 255, 0.9)',
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Category 10');
  });

  it('places required savings beyond the investment goal without capping the gap', () => {
    render(<RetirementCoverageChart result={makeGapResult()} goalDate={GOAL_DATE} />);

    expect(screen.getByTestId('coverage-threshold-investment-goal-future')).toHaveAttribute(
      'data-position',
      '58.5'
    );
    expect(screen.getByTestId('coverage-threshold-required-savings-future')).toHaveAttribute(
      'data-position',
      '100'
    );
    expect(screen.getByTestId('coverage-gap-region-future')).toHaveStyle({
      left: '58.5%',
      width: '41.5%',
    });
    expect(screen.getByTestId('coverage-progress-future')).toHaveStyle({ width: '29.3%' });

    const row = screen.getByTestId('coverage-row-future');
    expect(
      within(row).getByText(
        'At investment goal date: 850 €/month less than full cost coverage.'
      )
    ).toHaveAttribute('data-state', 'gap');
    expect(screen.getByTestId('coverage-visual-future')).toHaveAccessibleName(
      'Retirement savings coverage. Monthly costs 2 050 €/month. Investment goal 240 000 €. Required savings 410 000 €. Current projected savings 120 000 €. At investment goal date: 850 €/month less than full cost coverage.'
    );
    expect(within(row).queryByText('Current savings: Gap 1 450 €/month')).not.toBeInTheDocument();
  });

  it('masks compact values and every interactive tooltip in privacy mode', () => {
    window.history.replaceState({}, '', '/?privacy=true');
    const { container } = render(
      <RetirementCoverageChart result={makeGapResult()} goalDate={GOAL_DATE} />
    );

    expect(container).toHaveTextContent(PRIVACY_VALUE_MASK);
    expect(screen.getByTestId('coverage-notes')).toHaveTextContent(
      'Some personal expenses are not included'
    );
    expect(screen.getByTestId('coverage-progress-future')).toHaveStyle({ width: '29.3%' });
    expect(screen.getByTestId('coverage-category-future-0').tagName).toBe('DIV');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('coverage-marker-future'));
    expect(screen.getByRole('tooltip')).toHaveTextContent(`Year 2026: ${PRIVACY_VALUE_MASK} €`);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      `At goal in year 2026 money: ${PRIVACY_VALUE_MASK} €`
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      `At goal nominal money: ${PRIVACY_VALUE_MASK} €`
    );

    fireEvent.click(screen.getByTestId('coverage-threshold-investment-goal-future'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Investment goal');
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      `After-tax monthly income at goal: ${PRIVACY_VALUE_MASK} €/month`
    );

    [
      'Private home costs',
      'Private food budget',
      'Private fixed contract',
      'Inflation not applied',
      '30 Jun 2047',
      '100 000 €',
      '120 000 €',
      '240 000 €',
      '410 000 €',
      '850 €/month',
      'Office, spa renovations and time with kids when young, are not included',
    ].forEach((privateText) => {
      expect(container).not.toHaveTextContent(privateText);
      expect(container.innerHTML).not.toContain(privateText);
    });

    const accessibleText = Array.from(container.querySelectorAll('[aria-label], [title]'))
      .map((element) => `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`)
      .join(' ');
    expect(accessibleText).not.toMatch(/Private home|2047|100 000|120 000|240 000|410 000|850|0\.005/);
    expect(screen.getByTestId('coverage-visual-future')).toHaveAccessibleName(
      `Retirement savings coverage. Cost category details are hidden. Investment goal, required savings, and current savings markers shown. At investment goal date: ${PRIVACY_VALUE_MASK} €/month less than full cost coverage.`
    );
  });

  it('renders an empty future scale with both interactive thresholds', () => {
    const result = makeResult();
    result.categories = [];
    result.totalMonthlyCosts = { currentYear: 0, future: 0 };
    result.requiredSavings = { currentYear: 0, future: 0 };
    result.existingSavingsBufferOrGap = { ...result.existingSavingsMonthlyIncome };
    result.goalBufferOrGap = { ...result.goalMonthlyIncome };

    render(<RetirementCoverageChart result={result} goalDate={GOAL_DATE} />);

    expect(screen.getByTestId('coverage-main-scale-future')).toBeInTheDocument();
    expect(screen.queryByTestId(/coverage-category-/)).not.toBeInTheDocument();
    expect(screen.getByTestId('coverage-threshold-investment-goal-future')).toBeInTheDocument();
    expect(screen.getByTestId('coverage-threshold-required-savings-future')).toBeInTheDocument();
  });
});
