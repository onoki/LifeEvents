import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Event, Config, Condition, EUNLDataPoint } from '../types';

interface AppState {
  // Data state
  data: Event[];
  config: Config;
  conditions: Condition[];
  eunlData: EUNLDataPoint[];
  
  // UI state
  loading: boolean;
  error: string | null;
  status: string;
  sheetsUrl: string;
  
  // Actions
  setData: (data: Event[]) => void;
  setConfig: (config: Config) => void;
  setConditions: (conditions: Condition[]) => void;
  setEunlData: (data: EUNLDataPoint[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
  setSheetsUrl: (url: string) => void;
  
  // Complex actions
  loadData: (url: string) => Promise<void>;
  fetchEUNLData: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  data: [],
  config: {},
  conditions: [],
  eunlData: [],
  loading: false,
  error: null,
  status: '',
  sheetsUrl: '',
};

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Simple setters
      setData: (data) => set({ data }),
      setConfig: (config) => set({ config }),
      setConditions: (conditions) => set({ conditions }),
      setEunlData: (eunlData) => set({ eunlData }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setStatus: (status) => set({ status }),
      setSheetsUrl: (sheetsUrl) => set({ sheetsUrl }),

      // Complex actions
      loadData: async (url: string) => {
        const { APP_CONFIG } = await import('../config/appConfig');
        const { parseTSVData } = await import('../utils/dataProcessingUtils');
        
        set({ loading: true, error: null, status: 'Fetching data from Google Sheets...' });

        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const tsvData = await response.text();
          const { config: parsedConfig, conditions: parsedConditions, data: parsedData } = parseTSVData(tsvData);
          
          if (parsedData.length === 0) {
            throw new Error(APP_CONFIG.ERRORS.NO_DATA);
          }

          set({ 
            config: parsedConfig, 
            conditions: parsedConditions, 
            data: parsedData,
            status: `Loaded ${parsedData.length} events and ${parsedConditions.length} conditions successfully`
          });
          
        } catch (err) {
          console.error('Error loading data:', err);
          set({ 
            error: err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED,
            status: 'Error loading data'
          });
        } finally {
          set({ loading: false });
        }
      },

      fetchEUNLData: async () => {
        const { APP_CONFIG } = await import('../config/appConfig');
        const { calculateExponentialTrend } = await import('../utils/financialUtils');
        
        set({ loading: true, error: null, status: 'Fetching EUNL data from Yahoo Finance...' });

        try {
          const proxyUrl = APP_CONFIG.API.CORS_PROXY;
          const yahooUrl = `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${APP_CONFIG.API.EUNL_SYMBOL}?period1=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.START}&period2=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.END}&interval=1mo`;
          
          const response = await fetch(proxyUrl + encodeURIComponent(yahooUrl));
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const yahooData = await response.json();
          
          if (!yahooData.chart || !yahooData.chart.result || !yahooData.chart.result[0]) {
            throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
          }

          const result = yahooData.chart.result[0];
          const timestamps = result.timestamp;
          const closePrices = result.indicators.quote[0].close;

          const eunlData: EUNLDataPoint[] = timestamps.map((timestamp: number, index: number) => ({
            date: new Date(timestamp * 1000),
            price: closePrices[index] || null,
            dateFormatted: new Date(timestamp * 1000).toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY)
          })).filter((item: EUNLDataPoint) => item.price !== null);

          // Calculate trend and set data
          const eunlDataWithTrend = calculateExponentialTrend(eunlData);
          set({ 
            eunlData: eunlDataWithTrend,
            status: `Loaded ${eunlData.length} EUNL data points successfully`
          });
          
        } catch (err) {
          console.error('Error loading EUNL data:', err);
          set({ 
            error: err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED,
            status: 'Error loading EUNL data'
          });
        } finally {
          set({ loading: false });
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: 'app-store', // unique name for the store
    }
  )
);
