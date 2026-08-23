import { fireEvent, render, screen } from '@testing-library/react';
import { IndexHistoryChart } from '../../components/charts/IndexHistoryChart';
import type { IndexDataPoint, ViewMode } from '../../types';
import { PRIVACY_DATE_MASK } from '../privacy-utils';

const SIGMA = 0.1;

const makePoint = (date: string, deviation: number): IndexDataPoint => {
  const trend = 100;
  const value = trend * Math.exp(deviation * SIGMA);
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    dateFormatted: date,
    value,
    trend,
    trendUpperBound: trend * Math.exp(SIGMA),
    trendLowerBound: trend * Math.exp(-SIGMA),
    multiplier: trend / value,
  };
};

const eunlPoints = [
  makePoint('2022-01-01', 0),
  makePoint('2023-01-01', 1.5),
  makePoint('2024-01-01', -2),
];

const renderChart = (
  viewMode: ViewMode = 'full',
  averageAnnualGrowthRate = 0.08
) => render(
  <IndexHistoryChart
    title="Index history"
    indexDataBySymbol={{ 'EUNL.DE': eunlPoints }}
    indexTrendStatsBySymbol={{
      'EUNL.DE': { annualGrowthRate: 0.08, standardDeviation: SIGMA },
    }}
    averageIndexTrendStats={{ annualGrowthRate: averageAnnualGrowthRate, standardDeviation: SIGMA }}
    loading={false}
    stocksData={[{ investment_date: new Date('2022-01-15T00:00:00.000Z'), stocks_in_eur: 100 }]}
    config={{}}
    viewMode={viewMode}
  />
);

describe('IndexHistoryChart series labels', () => {
  it.each([
    [0.08, '8.0 %'],
    [0.0876, '8.8 %'],
  ])('shows the shared all-index average %p as %s', (averageRate, expectedLabel) => {
    renderChart('full', averageRate);

    expect(screen.getByTestId('average-index-trend'))
      .toHaveTextContent(`Average of all indexes: ${expectedLabel}`);
  });

  it('uses the same short index name in the expanded legend as in the tooltip', () => {
    render(
      <IndexHistoryChart
        title="Index history"
        indexDataBySymbol={{}}
        indexTrendStatsBySymbol={{}}
        loading={false}
        stocksData={[]}
        config={{}}
        viewMode="full"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show legend' }));

    expect(screen.queryByText('EUNL value')).not.toBeInTheDocument();
    expect(screen.getByText('EUNL ETF. Solid: index value; dashed: fitted historical trend; dotted: ±1σ historical trend band.')).toBeInTheDocument();
    expect(screen.getByText(/The band describes past variation around the fitted trend/)).toBeInTheDocument();
  });
});

describe('IndexHistoryChart sigma status', () => {
  it('shows the latest status and all raw zones in the aligned regime strip', () => {
    renderChart();

    expect(screen.getByLabelText(/EUNL: Below −1σ, -2\.00 σ/)).toBeInTheDocument();
    const regime = screen.getByRole('img', { name: 'EUNL historical sigma zones' });
    expect(regime.querySelectorAll('rect[data-zone="within"]')).toHaveLength(1);
    expect(regime.querySelectorAll('rect[data-zone="above"]')).toHaveLength(1);
    expect(regime.querySelectorAll('rect[data-zone="below"]')).toHaveLength(1);
  });

  it('derives latest status from the full fetched series instead of the cropped viewport', () => {
    renderChart('recorded');

    const badge = screen.getByTestId('sigma-badge-EUNL.DE');
    expect(badge).toHaveTextContent('Below −1σ');
    expect(badge).toHaveTextContent('-2.00 σ');
    expect(badge).toHaveAttribute('title', 'Latest observation: 2024-01-01');
  });

  it('masks dates that would reveal a user-derived index viewport in privacy mode', () => {
    window.history.replaceState({}, '', '/?privacy=true');
    const { container } = renderChart('next2years');

    // The aggregate is calculated only from public index history, so it remains visible.
    expect(screen.getByTestId('average-index-trend'))
      .toHaveTextContent('Average of all indexes: 8.0 %');

    const regimeTitles = Array.from(container.querySelectorAll('[data-zone] title'));
    expect(regimeTitles.length).toBeGreaterThan(0);
    regimeTitles.forEach((title) => {
      expect(title).toHaveTextContent(PRIVACY_DATE_MASK);
      expect(title).not.toHaveTextContent('2022-01-01');
    });

    window.history.replaceState({}, '', '/');
  });

  it('renders automatic failures as a subdued notice', () => {
    render(
      <IndexHistoryChart
        title="Index history"
        indexDataBySymbol={{}}
        indexTrendStatsBySymbol={{}}
        loading={false}
        stocksData={[]}
        config={{}}
        viewMode="full"
        indexNotice="Index data is temporarily unavailable."
      />
    );

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Notice: Index data is temporarily unavailable.');
    expect(notice).toHaveClass('bg-slate-800/90', 'text-white');
  });
});
