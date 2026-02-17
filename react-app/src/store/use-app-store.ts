import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Event, Config, Condition, EUNLDataPoint, MiniReward } from '../types';

interface AppState {
  // Data state
  data: Event[];
  config: Config;
  conditions: Condition[];
  miniRewards: MiniReward[];
  eunlData: EUNLDataPoint[];
  eunlTrendStats: { annualGrowthRate: number, standardDeviation: number } | null;
  eunlError: string | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  status: string;
  sheetsUrl: string;
  
  // Actions
  setData: (data: Event[]) => void;
  setConfig: (config: Config) => void;
  setConditions: (conditions: Condition[]) => void;
  setMiniRewards: (miniRewards: MiniReward[]) => void;
  setEunlData: (data: EUNLDataPoint[]) => void;
  setEunlTrendStats: (stats: { annualGrowthRate: number, standardDeviation: number } | null) => void;
  setEunlError: (error: string | null) => void;
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
  miniRewards: [],
  eunlData: [],
  eunlTrendStats: null,
  eunlError: null,
  loading: false,
  error: null,
  status: '',
  sheetsUrl: '',
};

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      ...initialState,

      // Simple setters
      setData: (data) => set({ data }),
      setConfig: (config) => set({ config }),
      setConditions: (conditions) => set({ conditions }),
      setMiniRewards: (miniRewards) => set({ miniRewards }),
      setEunlData: (eunlData) => set({ eunlData }),
      setEunlTrendStats: (eunlTrendStats) => set({ eunlTrendStats }),
      setEunlError: (eunlError) => set({ eunlError }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setStatus: (status) => set({ status }),
      setSheetsUrl: (sheetsUrl) => set({ sheetsUrl }),

      // Complex actions
      loadData: async (url: string) => {
        const { APP_CONFIG } = await import('../config/app-config');
        const { parseTSVData } = await import('../utils/data-processing-utils');
        
        set({ loading: true, error: null, eunlError: null, status: 'Fetching data from Google Sheets...' });

        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const tsvData = await response.text();
          const { config: parsedConfig, conditions: parsedConditions, data: parsedData, miniRewards: parsedMiniRewards } = parseTSVData(tsvData);
          
          if (parsedData.length === 0) {
            throw new Error(APP_CONFIG.ERRORS.NO_DATA);
          }

          set({ 
            config: parsedConfig, 
            conditions: parsedConditions, 
            miniRewards: parsedMiniRewards,
            data: parsedData,
            status: `Loaded ${parsedData.length} events, ${parsedConditions.length} conditions, and ${parsedMiniRewards.length} mini rewards successfully`
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
        const { APP_CONFIG } = await import('../config/app-config');
        const { calculateExponentialTrend } = await import('../utils/financial-utils');
        
        set({ loading: true, eunlError: null, status: 'Fetching EUNL data from Yahoo Finance...' });

        try {
          const yahooUrl = `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${APP_CONFIG.API.EUNL_SYMBOL}?period1=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.START}&period2=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.END}&interval=1mo`;
          const sourceUrls = APP_CONFIG.API.CORS_PROXIES.map((proxyUrl) => {
            let sourceName = proxyUrl;
            try {
              sourceName = new URL(proxyUrl).hostname;
            } catch {
              // Keep the raw value if URL parsing fails.
            }

            return {
              sourceName,
              url: `${proxyUrl}${encodeURIComponent(yahooUrl)}`,
            };
          });

          type YahooChartResponse = {
            chart?: {
              result?: Array<{
                timestamp?: number[];
                indicators?: {
                  quote?: Array<{
                    close?: Array<number | null>;
                  }>;
                };
              }>;
            };
          };

          const fetchWithTimeout = async (url: string): Promise<Response> => {
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), APP_CONFIG.API.REQUEST_TIMEOUT_MS);

            try {
              return await fetch(url, { signal: timeoutController.signal });
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error(`Request timed out after ${APP_CONFIG.API.REQUEST_TIMEOUT_MS / 1000} seconds`);
              }
              throw error;
            } finally {
              clearTimeout(timeoutId);
            }
          };

          const fetchAttempt = async (sourceUrl: string): Promise<{ eunlDataWithTrend: EUNLDataPoint[]; trendStats: { annualGrowthRate: number, standardDeviation: number } | null; originalLength: number }> => {
            const response = await fetchWithTimeout(sourceUrl);
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const yahooData = await response.json() as YahooChartResponse;
            const result = yahooData.chart?.result?.[0];
            const timestamps = result?.timestamp;
            const closePrices = result?.indicators?.quote?.[0]?.close;

            if (!timestamps || !closePrices) {
              throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
            }

            const eunlData: EUNLDataPoint[] = timestamps.map((timestamp: number, index: number) => ({
              date: new Date(timestamp * 1000),
              price: closePrices[index] ?? null,
              dateFormatted: new Date(timestamp * 1000).toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY)
            })).filter((item: EUNLDataPoint) => item.price !== null);

            const { data: eunlDataWithTrend, trendStats } = calculateExponentialTrend(eunlData);

            return { eunlDataWithTrend, trendStats, originalLength: eunlData.length };
          };

          const sourceErrors: string[] = [];

          for (const source of sourceUrls) {
            try {
              set({ status: `Fetching EUNL data via ${source.sourceName}...` });
              const { eunlDataWithTrend, trendStats, originalLength } = await fetchAttempt(source.url);
              set({ 
                eunlData: eunlDataWithTrend,
                eunlTrendStats: trendStats,
                status: `Loaded ${originalLength} EUNL data points successfully via ${source.sourceName}`,
                eunlError: null
              });
              return;
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED;
              sourceErrors.push(`${source.sourceName}: ${errorMessage}`);
              console.error(`Source ${source.sourceName} failed to load EUNL data:`, err);
            }
          }

          set({ 
            eunlError: `All EUNL data sources failed. ${sourceErrors.join(' | ')}`,
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
