import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import App from '../../App';
import { useAppStore } from '../../store/use-app-store';

jest.mock('../../styles/accessibility.css', () => ({}));

jest.mock('../../store/use-app-store', () => ({
  useAppStore: jest.fn(),
}));

const mockedUseAppStore = useAppStore as unknown as jest.Mock;

describe('automatic index loading', () => {
  afterEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('starts one Vercel-only request when Strict Mode replays mount effects', async () => {
    const fetchIndexData = jest.fn().mockResolvedValue(undefined);

    mockedUseAppStore.mockReturnValue({
      data: [],
      config: {},
      conditions: [],
      miniRewards: [],
      loading: false,
      error: null,
      loadData: jest.fn().mockResolvedValue(undefined),
      indexLoading: false,
      indexDataBySymbol: {},
      indexTrendStatsBySymbol: {},
      fetchIndexData,
      averageIndexTrendStats: null,
      indexError: null,
      indexNotice: null,
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    await waitFor(() => {
      expect(fetchIndexData).toHaveBeenCalledTimes(1);
    });
    expect(fetchIndexData).toHaveBeenCalledWith(undefined, 'automatic');
  });
});
