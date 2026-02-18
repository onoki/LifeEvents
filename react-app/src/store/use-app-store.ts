import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Event, Config, Condition, IndexDataPoint, MiniReward, TrendStats } from '../types';

interface AppState {
  // Data state
  data: Event[];
  config: Config;
  conditions: Condition[];
  miniRewards: MiniReward[];
  indexDataBySymbol: Record<string, IndexDataPoint[]>;
  indexTrendStatsBySymbol: Record<string, TrendStats | null>;
  averageIndexTrendStats: TrendStats | null;
  indexError: string | null;
  
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
  setIndexDataBySymbol: (dataBySymbol: Record<string, IndexDataPoint[]>) => void;
  setIndexTrendStatsBySymbol: (statsBySymbol: Record<string, TrendStats | null>) => void;
  setAverageIndexTrendStats: (stats: TrendStats | null) => void;
  setIndexError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
  setSheetsUrl: (url: string) => void;
  
  // Complex actions
  loadData: (url: string) => Promise<void>;
  fetchIndexData: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  data: [],
  config: {},
  conditions: [],
  miniRewards: [],
  indexDataBySymbol: {},
  indexTrendStatsBySymbol: {},
  averageIndexTrendStats: null,
  indexError: null,
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
      setMiniRewards: (miniRewards) => set({ miniRewards }),
      setIndexDataBySymbol: (indexDataBySymbol) => set({ indexDataBySymbol }),
      setIndexTrendStatsBySymbol: (indexTrendStatsBySymbol) => set({ indexTrendStatsBySymbol }),
      setAverageIndexTrendStats: (averageIndexTrendStats) => set({ averageIndexTrendStats }),
      setIndexError: (indexError) => set({ indexError }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setStatus: (status) => set({ status }),
      setSheetsUrl: (sheetsUrl) => set({ sheetsUrl }),

      // Complex actions
      loadData: async (url: string) => {
        const { APP_CONFIG } = await import('../config/app-config');
        const { parseTSVData } = await import('../utils/data-processing-utils');
        
        set({ loading: true, error: null, indexError: null, status: 'Fetching data from Google Sheets...' });

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

      fetchIndexData: async () => {
        const { APP_CONFIG } = await import('../config/app-config');
        const { calculateExponentialTrend } = await import('../utils/financial-utils');

        const existingIndexDataBySymbol = get().indexDataBySymbol;
        const existingIndexTrendStatsBySymbol = get().indexTrendStatsBySymbol;
        const indexDefinitionsToFetch = APP_CONFIG.API.INDEX_SERIES.filter((indexDefinition) => {
          const existingSeries = existingIndexDataBySymbol[indexDefinition.symbol];
          return !Array.isArray(existingSeries) || existingSeries.length === 0;
        });

        if (indexDefinitionsToFetch.length === 0) {
          set({
            indexError: null,
            status: 'Index data already loaded',
          });
          return;
        }

        set({
          loading: true,
          indexError: null,
          status: `Fetching ${indexDefinitionsToFetch.length} missing index series...`,
        });

        try {
          type IndexDefinition = (typeof APP_CONFIG.API.INDEX_SERIES)[number];
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
          type MorningstarSeriesPoint = {
            close?: number | null;
            date?: string;
          };
          type MorningstarResponse = Array<{
            queryKey?: string;
            series?: MorningstarSeriesPoint[];
          }>;

          const buildSameOriginUrl = (pathWithQuery: string): string => {
            const normalizedPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
            return new URL(normalizedPath, window.location.origin).toString();
          };

          const toPathAndQuery = (url: string): string => {
            const parsed = new URL(url);
            return `${parsed.pathname}${parsed.search}`;
          };

          const getProxySourceName = (proxyUrl: string): string => {
            try {
              return new URL(proxyUrl).hostname;
            } catch {
              return proxyUrl;
            }
          };

          const createSourceUrls = ({
            targetUrl,
            sameOriginUrl,
            includeDirect = false,
            includeExternalProxies = true,
          }: {
            targetUrl: string;
            sameOriginUrl?: string;
            includeDirect?: boolean;
            includeExternalProxies?: boolean;
          }): Array<{ sourceName: string; url: string }> => {
            const sources: Array<{ sourceName: string; url: string }> = [];

            if (sameOriginUrl) {
              sources.push({ sourceName: 'same-origin-proxy', url: sameOriginUrl });
            }

            if (includeDirect) {
              sources.push({ sourceName: 'direct', url: targetUrl });
            }

            if (includeExternalProxies) {
              const proxiedUrls = APP_CONFIG.API.CORS_PROXIES.map((proxyUrl) => ({
                sourceName: getProxySourceName(proxyUrl),
                url: `${proxyUrl}${encodeURIComponent(targetUrl)}`,
              }));
              sources.push(...proxiedUrls);
            }

            return sources;
          };

          const fetchWithTimeout = async (url: string, init?: RequestInit): Promise<Response> => {
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), APP_CONFIG.API.REQUEST_TIMEOUT_MS);

            try {
              return await fetch(url, {
                credentials: 'same-origin',
                ...init,
                signal: timeoutController.signal,
              });
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error(`Request timed out after ${APP_CONFIG.API.REQUEST_TIMEOUT_MS / 1000} seconds`);
              }
              throw error;
            } finally {
              clearTimeout(timeoutId);
            }
          };

          const mergeHeaders = (baseHeaders?: HeadersInit, extraHeaders?: HeadersInit): Headers => {
            const mergedHeaders = new Headers(baseHeaders);
            if (extraHeaders) {
              const extra = new Headers(extraHeaders);
              extra.forEach((value, key) => {
                mergedHeaders.set(key, value);
              });
            }
            return mergedHeaders;
          };

          const fetchJsonWithFallback = async <T,>(
            options: {
              targetUrl: string;
              sameOriginUrl?: string;
              headers?: HeadersInit;
              includeDirect?: boolean;
              includeExternalProxies?: boolean;
              requestInit?: RequestInit;
            }
          ): Promise<{ data: T; sourceName: string }> => {
            const {
              targetUrl,
              sameOriginUrl,
              headers,
              includeDirect = false,
              includeExternalProxies = true,
              requestInit,
            } = options;
            const sourceErrors: string[] = [];

            for (const source of createSourceUrls({
              targetUrl,
              sameOriginUrl,
              includeDirect,
              includeExternalProxies,
            })) {
              try {
                const requestHeaders = mergeHeaders(requestInit?.headers, headers);
                const response = await fetchWithTimeout(source.url, {
                  ...requestInit,
                  headers: requestHeaders,
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return {
                  data: await response.json() as T,
                  sourceName: source.sourceName,
                };
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED;
                sourceErrors.push(`${source.sourceName}: ${errorMessage}`);
              }
            }

            throw new Error(sourceErrors.join(' | '));
          };

          const fetchTextWithFallback = async (
            options: {
              targetUrl: string;
              sameOriginUrl?: string;
              headers?: HeadersInit;
              includeDirect?: boolean;
              includeExternalProxies?: boolean;
              requestInit?: RequestInit;
            }
          ): Promise<{ data: string; sourceName: string }> => {
            const {
              targetUrl,
              sameOriginUrl,
              headers,
              includeDirect = false,
              includeExternalProxies = true,
              requestInit,
            } = options;
            const sourceErrors: string[] = [];

            for (const source of createSourceUrls({
              targetUrl,
              sameOriginUrl,
              includeDirect,
              includeExternalProxies,
            })) {
              try {
                const requestHeaders = mergeHeaders(requestInit?.headers, headers);
                const response = await fetchWithTimeout(source.url, {
                  ...requestInit,
                  headers: requestHeaders,
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return {
                  data: await response.text(),
                  sourceName: source.sourceName,
                };
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED;
                sourceErrors.push(`${source.sourceName}: ${errorMessage}`);
              }
            }

            throw new Error(sourceErrors.join(' | '));
          };

          const buildMorningstarUrl = (queryKey: string): string => {
            const params = new URLSearchParams({
              query: `${queryKey}:open,high,low,close,volume,previousClose`,
              frequency: APP_CONFIG.API.MORNINGSTAR.FREQUENCY,
              startDate: APP_CONFIG.API.MORNINGSTAR.START_DATE,
              endDate: new Date().toISOString().slice(0, 10),
              trackMarketData: APP_CONFIG.API.MORNINGSTAR.TRACK_MARKET_DATA,
              instid: APP_CONFIG.API.MORNINGSTAR.INST_ID,
            });
            return `${APP_CONFIG.API.MORNINGSTAR.TIMESERIES_BASE}?${params.toString()}`;
          };

          const isLikelyJwt = (token: string): boolean => {
            return token.length > 80 && /^[A-Za-z0-9+/_=-]+\.[A-Za-z0-9+/_=-]+\.[A-Za-z0-9+/_=-]+$/.test(token);
          };

          const collectTokenMatches = (input: string, pattern: RegExp): string[] => {
            const results: string[] = [];
            const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
            const regex = new RegExp(pattern.source, flags);
            let match: RegExpExecArray | null = null;

            while ((match = regex.exec(input)) !== null) {
              const candidate = match[1]?.trim();
              if (candidate && candidate.length > 20) {
                results.push(candidate);
              }
            }

            return results;
          };

          const extractMorningstarToken = (html: string): string | null => {
            const normalizedInputs = [
              html,
              html.replace(/\\"/g, '"'),
              html.replace(/\\u002F/gi, '/').replace(/\\"/g, '"'),
            ];
            const tokenMaaSCandidates: string[] = [];
            const accessTokenCandidates: string[] = [];

            for (const input of normalizedInputs) {
              tokenMaaSCandidates.push(
                ...collectTokenMatches(input, /["']?tokenMaaS["']?\s*[:=]\s*["']([^"']+)["']/i)
              );
              accessTokenCandidates.push(
                ...collectTokenMatches(input, /["']?accessToken["']?\s*[:=]\s*["']([^"']+)["']/i)
              );
            }

            const uniqueCandidates = Array.from(
              new Set([...tokenMaaSCandidates, ...accessTokenCandidates])
            );
            const jwtCandidate = uniqueCandidates.find(isLikelyJwt);
            if (jwtCandidate) {
              return jwtCandidate;
            }

            return uniqueCandidates.sort((left, right) => right.length - left.length)[0] ?? null;
          };

          const buildRequestId = (): string => {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
              return crypto.randomUUID();
            }
            return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          };

          const fetchMorningstarToken = async (): Promise<string> => {
            const authUrl = new URL(APP_CONFIG.API.MORNINGSTAR.AUTH_PAGE_URL);
            authUrl.searchParams.set('_ts', Date.now().toString());
            const authUrlString = authUrl.toString();
            const morningstarAuthSameOriginUrl = buildSameOriginUrl(
              `/proxy-morningstar-indexes${toPathAndQuery(authUrlString)}`
            );
            const { data: html } = await fetchTextWithFallback({
              targetUrl: authUrlString,
              sameOriginUrl: morningstarAuthSameOriginUrl,
              includeDirect: false,
              includeExternalProxies: false,
              requestInit: {
                cache: 'no-store',
                headers: {
                  'Cache-Control': 'no-cache',
                  Pragma: 'no-cache',
                },
              },
            });
            const token = extractMorningstarToken(html);
            if (!token) {
              throw new Error('Could not extract Morningstar auth token');
            }
            return token;
          };

          const fetchYahooIndex = async (indexDefinition: IndexDefinition): Promise<{ points: IndexDataPoint[]; sourceName: string }> => {
            const yahooUrl = `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${indexDefinition.symbol}?period1=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.START}&period2=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.END}&interval=1mo`;
            const yahooSameOriginUrl = buildSameOriginUrl(`/proxy-yahoo${toPathAndQuery(yahooUrl)}`);
            const { data, sourceName } = await fetchJsonWithFallback<YahooChartResponse>({
              targetUrl: yahooUrl,
              sameOriginUrl: yahooSameOriginUrl,
              includeDirect: false,
              includeExternalProxies: true,
            });
            const result = data.chart?.result?.[0];
            const timestamps = result?.timestamp;
            const closePrices = result?.indicators?.quote?.[0]?.close;

            if (!timestamps || !closePrices) {
              throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
            }

            const points = timestamps.map((timestamp: number, index: number) => ({
              date: new Date(timestamp * 1000),
              value: closePrices[index] ?? null,
              dateFormatted: new Date(timestamp * 1000).toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY),
            })).filter((item) => item.value !== null);

            return { points, sourceName };
          };

          const fetchMorningstarIndex = async (
            indexDefinition: IndexDefinition,
            token: string
          ): Promise<{ points: IndexDataPoint[]; sourceName: string }> => {
            const queryKey = 'queryKey' in indexDefinition ? indexDefinition.queryKey : undefined;
            if (!queryKey) {
              throw new Error(`Missing Morningstar query key for ${indexDefinition.symbol}`);
            }

            const morningstarUrl = buildMorningstarUrl(queryKey);
            const morningstarSameOriginUrl = buildSameOriginUrl(`/proxy-morningstar-api${toPathAndQuery(morningstarUrl)}`);
            const { data, sourceName } = await fetchJsonWithFallback<MorningstarResponse>({
              targetUrl: morningstarUrl,
              sameOriginUrl: morningstarSameOriginUrl,
              headers: {
                'Accept': 'application/json,text/plain,*/*',
                'Authorization': `Bearer ${token}`,
                'X-Api-RequestId': buildRequestId(),
              },
              includeDirect: false,
              includeExternalProxies: false,
              requestInit: {
                cache: 'no-store',
              },
            });

            const series = data?.[0]?.series;
            if (!series || !Array.isArray(series)) {
              throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
            }

            const points = series.map((item) => {
              const parsedDate = item.date ? new Date(item.date) : null;
              return {
                date: parsedDate ?? new Date('1970-01-01'),
                value: item.close ?? null,
                dateFormatted: parsedDate
                  ? parsedDate.toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY)
                  : '',
              };
            }).filter((item) => item.value !== null && !Number.isNaN(item.date.getTime()));

            return { points, sourceName };
          };

          const nextIndexDataBySymbol: Record<string, IndexDataPoint[]> = {
            ...existingIndexDataBySymbol,
          };
          const nextIndexTrendStatsBySymbol: Record<string, TrendStats | null> = {
            ...existingIndexTrendStatsBySymbol,
          };
          const loadErrors: string[] = [];
          let newlyLoadedCount = 0;

          let morningstarToken: string | null = null;
          const morningstarNeeded = indexDefinitionsToFetch.some((indexDefinition) => indexDefinition.source === 'morningstar');

          if (morningstarNeeded) {
            set({ status: 'Fetching Morningstar auth token...' });
            try {
              morningstarToken = await fetchMorningstarToken();
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED;
              loadErrors.push(`Morningstar token: ${errorMessage}`);
            }
          }

          for (const indexDefinition of indexDefinitionsToFetch) {
            try {
              set({ status: `Fetching ${indexDefinition.symbol} index data...` });
              let points: IndexDataPoint[] = [];
              let sourceName = 'direct';

              if (indexDefinition.source === 'yahoo') {
                const result = await fetchYahooIndex(indexDefinition);
                points = result.points;
                sourceName = result.sourceName;
              } else {
                if (!morningstarToken) {
                  throw new Error('Morningstar token missing');
                }
                try {
                  const result = await fetchMorningstarIndex(indexDefinition, morningstarToken);
                  points = result.points;
                  sourceName = result.sourceName;
                } catch (morningstarError) {
                  const errorMessage = morningstarError instanceof Error ? morningstarError.message : '';
                  if (errorMessage.includes('HTTP 401')) {
                    morningstarToken = await fetchMorningstarToken();
                    const retryResult = await fetchMorningstarIndex(indexDefinition, morningstarToken);
                    points = retryResult.points;
                    sourceName = `${retryResult.sourceName} (token-refresh)`;
                  } else {
                    throw morningstarError;
                  }
                }
              }

              const { data: dataWithTrend, trendStats } = calculateExponentialTrend(points);
              nextIndexDataBySymbol[indexDefinition.symbol] = dataWithTrend as IndexDataPoint[];
              nextIndexTrendStatsBySymbol[indexDefinition.symbol] = trendStats;
              newlyLoadedCount += 1;
              set({ status: `Loaded ${indexDefinition.symbol} (${points.length} points) via ${sourceName}` });
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED;
              loadErrors.push(`${indexDefinition.symbol}: ${errorMessage}`);
              console.error(`Failed to load index data for ${indexDefinition.symbol}:`, err);
            }
          }

          const loadedSymbols = APP_CONFIG.API.INDEX_SERIES
            .map((series) => series.symbol)
            .filter((symbol) => {
              const points = nextIndexDataBySymbol[symbol];
              return Array.isArray(points) && points.length > 0;
            });
          const missingSymbols = APP_CONFIG.API.INDEX_SERIES
            .map((series) => series.symbol)
            .filter((symbol) => !loadedSymbols.includes(symbol));
          const availableTrendStats = Object.values(nextIndexTrendStatsBySymbol).filter(
            (stats): stats is TrendStats => stats !== null
          );
          const averageIndexTrendStats = availableTrendStats.length > 0
            ? {
                annualGrowthRate: availableTrendStats.reduce((sum, stats) => sum + stats.annualGrowthRate, 0) / availableTrendStats.length,
                standardDeviation: availableTrendStats.reduce((sum, stats) => sum + stats.standardDeviation, 0) / availableTrendStats.length,
              }
            : null;
          const hasAnyData = loadedSymbols.length > 0;

          set({
            indexDataBySymbol: nextIndexDataBySymbol,
            indexTrendStatsBySymbol: nextIndexTrendStatsBySymbol,
            averageIndexTrendStats,
            indexError: loadErrors.length > 0
              ? `Some index sources failed. ${loadErrors.join(' | ')}`
              : null,
            status: hasAnyData
              ? (missingSymbols.length === 0
                  ? `Loaded ${newlyLoadedCount} missing index series`
                  : `Loaded ${newlyLoadedCount} missing index series. Still missing: ${missingSymbols.join(', ')}`)
              : 'Error loading index data',
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
