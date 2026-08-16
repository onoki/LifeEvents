import { fireEvent, render, screen } from '@testing-library/react';
import { IndexHistoryChart } from '../../components/charts/IndexHistoryChart';

describe('IndexHistoryChart series labels', () => {
  it('uses the same short index name in the expanded legend as in the tooltip', () => {
    render(
      <IndexHistoryChart
        title="Index history"
        indexDataBySymbol={{}}
        indexTrendStatsBySymbol={{}}
        loading={false}
        showOnlyDataWithStocks={false}
        stocksData={[]}
        viewMode="full"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show legend' }));

    expect(screen.queryByText('EUNL value')).not.toBeInTheDocument();
    expect(screen.getByText('EUNL ETF. Solid: index value; dashed: trend; dotted: ±1 σ.')).toBeInTheDocument();
  });
});
