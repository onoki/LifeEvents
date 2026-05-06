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
  fetchIndexData: (symbol?: string) => Promise<void>;
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

      fetchIndexData: async (symbol?: string) => {
        const { APP_CONFIG } = await import('../config/app-config');
        const { calculateExponentialTrend } = await import('../utils/financial-utils');

        const existingIndexDataBySymbol = get().indexDataBySymbol;
        const existingIndexTrendStatsBySymbol = get().indexTrendStatsBySymbol;
        const requestedSymbolSet = symbol ? new Set([symbol]) : null;
        const indexDefinitionsToFetch = APP_CONFIG.API.INDEX_SERIES.filter((indexDefinition) => {
          return requestedSymbolSet === null || requestedSymbolSet.has(indexDefinition.symbol);
        });
        const fetchScopeSymbols = indexDefinitionsToFetch.map((series) => series.symbol);

        if (indexDefinitionsToFetch.length === 0) {
          set({
            loading: false,
            indexError: `Unknown index symbol: ${symbol}`,
            status: 'Error loading index data',
          });
          return;
        }

        set({
          loading: true,
          indexError: null,
          status: `Fetching ${indexDefinitionsToFetch.length} index series...`,
        });

        try {
          type IndexDefinition = (typeof APP_CONFIG.API.INDEX_SERIES)[number];
          type YahooChartResponse = {
            chart?: {
              result?: Array<{
                timestamp?: number[];
                meta?: {
                  gmtoffset?: number;
                  exchangeTimezoneName?: string;
                  timezone?: string;
                };
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

          // Default to production-like networking even in dev so GitHub Pages behavior
          // can be validated locally. Opt in to Vite same-origin proxies only when
          // VITE_USE_DEV_SAME_ORIGIN_PROXY=true.
          const useSameOriginProxy = import.meta.env.DEV
            && import.meta.env.VITE_USE_DEV_SAME_ORIGIN_PROXY === 'true';

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

          type FallbackSource = {
            sourceName: string;
            url: string;
            proxyUrl?: string;
          };

          let preferredExternalProxyUrl: string | null = null;

          const getOrderedExternalProxies = (): string[] => {
            const configuredProxies = APP_CONFIG.API.CORS_PROXIES;
            if (!preferredExternalProxyUrl) {
              return [...configuredProxies];
            }

            const preferredIndex = configuredProxies.indexOf(preferredExternalProxyUrl);
            if (preferredIndex < 0) {
              return [...configuredProxies];
            }

            return [
              ...configuredProxies.slice(preferredIndex),
              ...configuredProxies.slice(0, preferredIndex),
            ];
          };

          const rememberPreferredExternalProxy = (proxyUrl?: string): void => {
            if (proxyUrl) {
              preferredExternalProxyUrl = proxyUrl;
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
          }): FallbackSource[] => {
            const sources: FallbackSource[] = [];

            if (sameOriginUrl) {
              sources.push({ sourceName: 'same-origin-proxy', url: sameOriginUrl });
            }

            if (includeDirect) {
              sources.push({ sourceName: 'direct', url: targetUrl });
            }

            if (includeExternalProxies) {
              const proxiedUrls = getOrderedExternalProxies().map((proxyUrl) => ({
                sourceName: getProxySourceName(proxyUrl),
                url: `${proxyUrl}${encodeURIComponent(targetUrl)}`,
                proxyUrl,
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
            const parseJsonPayload = (raw: string): T => {
              const trimmed = raw.trim();
              if (!trimmed) {
                throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
              }

              const candidates: string[] = [trimmed];

              // Some proxies prepend XSSI guards.
              if (trimmed.startsWith(")]}'")) {
                candidates.push(trimmed.replace(/^\)\]\}'\s*/, ''));
              }

              // Some proxies wrap payloads in a JSON envelope.
              if (trimmed.startsWith('{')) {
                try {
                  const parsedEnvelope = JSON.parse(trimmed) as { contents?: unknown; data?: unknown };
                  if (typeof parsedEnvelope.contents === 'string') {
                    candidates.push(parsedEnvelope.contents.trim());
                  }
                  if (typeof parsedEnvelope.data === 'string') {
                    candidates.push(parsedEnvelope.data.trim());
                  }
                } catch {
                  // ignore envelope parse failure and continue with raw candidates
                }
              }

              for (const candidate of candidates) {
                try {
                  return JSON.parse(candidate) as T;
                } catch {
                  // try next candidate
                }
              }

              throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
            };

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

                const rawText = await response.text();
                rememberPreferredExternalProxy(source.proxyUrl);
                return {
                  data: parseJsonPayload(rawText),
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

                rememberPreferredExternalProxy(source.proxyUrl);
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
            const morningstarAuthSameOriginUrl = useSameOriginProxy
              ? buildSameOriginUrl(`/proxy-morningstar-indexes${toPathAndQuery(authUrlString)}`)
              : undefined;
            const { data: html } = await fetchTextWithFallback({
              targetUrl: authUrlString,
              sameOriginUrl: morningstarAuthSameOriginUrl,
              includeDirect: false,
              includeExternalProxies: !useSameOriginProxy,
              requestInit: {
                cache: 'no-store',
              },
            });
            const token = extractMorningstarToken(html);
            if (!token) {
              throw new Error('Could not extract Morningstar auth token');
            }
            return token;
          };

          const fetchYahooIndex = async (indexDefinition: IndexDefinition): Promise<{ points: IndexDataPoint[]; sourceName: string }> => {
            const getTodayStartForOffset = (offsetSeconds: number): Date => {
              const shiftedNow = new Date(Date.now() + (offsetSeconds * 1000));
              return new Date(Date.UTC(
                shiftedNow.getUTCFullYear(),
                shiftedNow.getUTCMonth(),
                shiftedNow.getUTCDate()
              ));
            };

            const parseYahooPoints = (
              response: YahooChartResponse
            ): {
              points: IndexDataPoint[];
              gmtoffsetSeconds: number;
            } => {
              const result = response.chart?.result?.[0];
              const timestamps = result?.timestamp;
              const closePrices = result?.indicators?.quote?.[0]?.close;
              const gmtoffsetSeconds = typeof result?.meta?.gmtoffset === 'number' && Number.isFinite(result.meta.gmtoffset)
                ? result.meta.gmtoffset
                : 0;

              if (!timestamps || !closePrices) {
                throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
              }

              const points = timestamps
                .map((timestamp: number, index: number): IndexDataPoint | null => {
                  const value = closePrices[index];
                  if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return null;
                  }

                  // Use Yahoo's market timezone offset to map each timestamp
                  // to the correct market-local calendar day.
                  const sourceDate = new Date((timestamp + gmtoffsetSeconds) * 1000);
                  if (Number.isNaN(sourceDate.getTime())) {
                    return null;
                  }

                  const parsedDate = new Date(Date.UTC(
                    sourceDate.getUTCFullYear(),
                    sourceDate.getUTCMonth(),
                    sourceDate.getUTCDate()
                  ));
                  if (Number.isNaN(parsedDate.getTime())) {
                    return null;
                  }

                  return {
                    date: parsedDate,
                    value,
                    dateFormatted: parsedDate.toLocaleDateString('en-US', {
                      ...APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY,
                      timeZone: 'UTC',
                    }),
                  };
                })
                .filter((item): item is IndexDataPoint => item !== null);

              return {
                points,
                gmtoffsetSeconds,
              };
            };

            const fetchYahooByUrl = async (
              yahooUrl: string
            ): Promise<{
              points: IndexDataPoint[];
              sourceName: string;
              gmtoffsetSeconds: number;
            }> => {
              const yahooUrlWithNoCache = new URL(yahooUrl);
              yahooUrlWithNoCache.searchParams.set('_ts', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
              const targetYahooUrl = yahooUrlWithNoCache.toString();
              const yahooSameOriginUrl = useSameOriginProxy
                ? buildSameOriginUrl(`/proxy-yahoo${toPathAndQuery(targetYahooUrl)}`)
                : undefined;
              const { data, sourceName } = await fetchJsonWithFallback<YahooChartResponse>({
                targetUrl: targetYahooUrl,
                sameOriginUrl: yahooSameOriginUrl,
                includeDirect: false,
                includeExternalProxies: true,
                requestInit: {
                  cache: 'no-store',
                },
              });
              const parsed = parseYahooPoints(data);

              return {
                points: parsed.points,
                sourceName,
                gmtoffsetSeconds: parsed.gmtoffsetSeconds,
              };
            };

            const monthlyUrl = `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${indexDefinition.symbol}?period1=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.START}&period2=${APP_CONFIG.API.YAHOO_FINANCE_PERIODS.END}&interval=1mo`;
            const monthlyResult = await fetchYahooByUrl(monthlyUrl);
            const todayStartMonthlyTz = getTodayStartForOffset(monthlyResult.gmtoffsetSeconds);
            const monthlyLatestPoint = monthlyResult.points
              .slice()
              .sort((left, right) => left.date.getTime() - right.date.getTime())
              .pop();
            const monthlyLatestSelectablePoint = monthlyResult.points
              .filter((point) => point.date.getTime() < todayStartMonthlyTz.getTime())
              .sort((left, right) => left.date.getTime() - right.date.getTime())
              .pop();

            const toYearMonthKey = (date: Date): string => `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
            let points = monthlyResult.points;
            let sourceName = monthlyResult.sourceName;

            // Keep month-by-month history, but replace the latest month bucket
            // with the latest available daily close (typically yesterday).
            const now = new Date();
            const nowUnix = Math.floor(now.getTime() / 1000);
            const twoDaysInSeconds = 2 * 24 * 60 * 60;
            const sevenDaysInSeconds = 7 * 24 * 60 * 60;
            const currentMonthStartUnix = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
            const dailyUrls = [
              `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${indexDefinition.symbol}?range=3mo&interval=1d`,
              `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${indexDefinition.symbol}?range=1mo&interval=1d`,
              `${APP_CONFIG.API.YAHOO_FINANCE_BASE}/${indexDefinition.symbol}?period1=${currentMonthStartUnix - sevenDaysInSeconds}&period2=${nowUnix + twoDaysInSeconds}&interval=1d`,
            ];
            const dailyErrors: string[] = [];
            let dailyResult: {
              points: IndexDataPoint[];
              sourceName: string;
              gmtoffsetSeconds: number;
            } | null = null;

            for (const dailyUrl of dailyUrls) {
              try {
                const candidate = await fetchYahooByUrl(dailyUrl);
                if (candidate.points.length > 0) {
                  dailyResult = candidate;
                  break;
                }
                dailyErrors.push(`empty: ${dailyUrl}`);
              } catch (dailyError) {
                const errorMessage = dailyError instanceof Error ? dailyError.message : APP_CONFIG.ERRORS.FETCH_FAILED;
                dailyErrors.push(errorMessage);
              }
            }

            if (dailyResult) {
              const todayStartDailyTz = getTodayStartForOffset(dailyResult.gmtoffsetSeconds);
              const currentMonthKey = `${todayStartDailyTz.getUTCFullYear()}-${todayStartDailyTz.getUTCMonth()}`;
              const dailyCurrentMonthPoints = dailyResult.points
                .filter((point) => point.date.getTime() < todayStartDailyTz.getTime() && toYearMonthKey(point.date) === currentMonthKey)
                .sort((left, right) => left.date.getTime() - right.date.getTime());
              const firstDailyCurrentMonthPoint = dailyCurrentMonthPoints[0];
              const latestDailyCurrentMonthPoint = dailyCurrentMonthPoints[dailyCurrentMonthPoints.length - 1];

              if (firstDailyCurrentMonthPoint && latestDailyCurrentMonthPoint) {
                const replacementPoints: IndexDataPoint[] = [firstDailyCurrentMonthPoint];
                if (latestDailyCurrentMonthPoint.date.getTime() !== firstDailyCurrentMonthPoint.date.getTime()) {
                  replacementPoints.push(latestDailyCurrentMonthPoint);
                }

                points = [
                  ...monthlyResult.points.filter((point) => toYearMonthKey(point.date) !== currentMonthKey),
                  ...replacementPoints,
                ].sort((left, right) => left.date.getTime() - right.date.getTime());
                sourceName = `${monthlyResult.sourceName} + ${dailyResult.sourceName}`;
              } else {
                const latestDailyPoint = dailyResult.points
                  .filter((point) => point.date.getTime() < todayStartDailyTz.getTime())
                  .sort((left, right) => left.date.getTime() - right.date.getTime())
                  .pop();
                const latestMonthlyComparablePoint = monthlyLatestSelectablePoint ?? monthlyLatestPoint;

                if (
                  latestDailyPoint
                  && (!latestMonthlyComparablePoint || latestDailyPoint.date.getTime() > latestMonthlyComparablePoint.date.getTime())
                ) {
                  const latestDailyPointMonthKey = toYearMonthKey(latestDailyPoint.date);
                  points = [
                    ...monthlyResult.points.filter((point) => toYearMonthKey(point.date) !== latestDailyPointMonthKey),
                    latestDailyPoint,
                  ].sort((left, right) => left.date.getTime() - right.date.getTime());
                  sourceName = `${monthlyResult.sourceName} + ${dailyResult.sourceName}`;
                }
              }
            } else if (dailyErrors.length > 0) {
              console.warn(`Daily Yahoo fetch failed for ${indexDefinition.symbol}, using monthly series only.`, dailyErrors.join(' | '));
            }

            return { points, sourceName };
          };

          const fetchMorningstarIndex = async (
            indexDefinition: IndexDefinition,
            token?: string
          ): Promise<{ points: IndexDataPoint[]; sourceName: string }> => {
            const queryKey = 'queryKey' in indexDefinition ? indexDefinition.queryKey : undefined;
            if (!queryKey) {
              throw new Error(`Missing Morningstar query key for ${indexDefinition.symbol}`);
            }

            const morningstarUrl = buildMorningstarUrl(queryKey);
            const morningstarSameOriginUrl = useSameOriginProxy
              ? buildSameOriginUrl(`/proxy-morningstar-api${toPathAndQuery(morningstarUrl)}`)
              : undefined;
            const { data, sourceName } = await fetchJsonWithFallback<MorningstarResponse>({
              targetUrl: morningstarUrl,
              sameOriginUrl: morningstarSameOriginUrl,
              headers: token
                ? {
                    'Accept': 'application/json,text/plain,*/*',
                    'Authorization': `Bearer ${token}`,
                    'X-Api-RequestId': buildRequestId(),
                  }
                : {
                    'Accept': 'application/json,text/plain,*/*',
                  },
              includeDirect: true,
              includeExternalProxies: !useSameOriginProxy,
              requestInit: {
                cache: 'no-store',
              },
            });

            const series = data?.[0]?.series;
            if (!series || !Array.isArray(series)) {
              throw new Error(APP_CONFIG.ERRORS.INVALID_DATA_FORMAT);
            }

            const points = series
              .map((item): IndexDataPoint | null => {
                const sourceDate = item.date ? new Date(item.date) : null;
                const value = item.close;

                if (!sourceDate || Number.isNaN(sourceDate.getTime())) {
                  return null;
                }

                if (typeof value !== 'number' || !Number.isFinite(value)) {
                  return null;
                }

                const parsedDate = new Date(Date.UTC(
                  sourceDate.getUTCFullYear(),
                  sourceDate.getUTCMonth(),
                  sourceDate.getUTCDate()
                ));
                if (Number.isNaN(parsedDate.getTime())) {
                  return null;
                }

                return {
                  date: parsedDate,
                  value,
                  dateFormatted: parsedDate.toLocaleDateString('en-US', {
                    ...APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY,
                    timeZone: 'UTC',
                  }),
                };
              })
              .filter((item): item is IndexDataPoint => item !== null);

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

          const publishIndexDataProgress = (statusOverride?: string): void => {
            const loadedSymbols = fetchScopeSymbols
              .filter((symbol) => {
                const points = nextIndexDataBySymbol[symbol];
                return Array.isArray(points) && points.length > 0;
              });
            const missingSymbols = fetchScopeSymbols.filter((targetSymbol) => !loadedSymbols.includes(targetSymbol));
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
              indexDataBySymbol: { ...nextIndexDataBySymbol },
              indexTrendStatsBySymbol: { ...nextIndexTrendStatsBySymbol },
              averageIndexTrendStats,
              indexError: loadErrors.length > 0
                ? `Some index sources failed. ${loadErrors.join(' | ')}`
                : null,
              status: statusOverride ?? (hasAnyData
                ? (missingSymbols.length === 0
                    ? `Loaded ${newlyLoadedCount} index series`
                    : `Loaded ${newlyLoadedCount} index series. Still missing: ${missingSymbols.join(', ')}`)
                : 'Error loading index data'),
            });
          };

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
                  const result = await fetchMorningstarIndex(indexDefinition);
                  points = result.points;
                  sourceName = `${result.sourceName} (no-token)`;
                } else {
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
              }

              const { data: dataWithTrend, trendStats } = calculateExponentialTrend(points);
              nextIndexDataBySymbol[indexDefinition.symbol] = dataWithTrend as IndexDataPoint[];
              nextIndexTrendStatsBySymbol[indexDefinition.symbol] = trendStats;
              newlyLoadedCount += 1;
              publishIndexDataProgress(`Loaded ${indexDefinition.symbol} (${points.length} points) via ${sourceName}`);
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : APP_CONFIG.ERRORS.FETCH_FAILED;
              loadErrors.push(`${indexDefinition.symbol}: ${errorMessage}`);
              console.error(`Failed to load index data for ${indexDefinition.symbol}:`, err);
              publishIndexDataProgress(`Failed ${indexDefinition.symbol}; continuing...`);
            }
          }
          publishIndexDataProgress();
          
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
