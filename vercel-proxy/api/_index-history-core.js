import { randomUUID } from 'node:crypto';

export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  'https://onoki.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export const ALLOWED_SYMBOLS = Object.freeze([
  'all',
  'EUNL.DE',
  'MSNA',
  'MSDE',
  'MSDA',
]);

const SERIES_DEFINITIONS = Object.freeze([
  Object.freeze({
    symbol: 'EUNL.DE',
    source: 'yahoo',
  }),
  Object.freeze({
    symbol: 'MSNA',
    source: 'morningstar',
    queryKey: 'F00001QK3I',
  }),
  Object.freeze({
    symbol: 'MSDE',
    source: 'morningstar',
    queryKey: 'F00001QK2I',
  }),
  Object.freeze({
    symbol: 'MSDA',
    source: 'morningstar',
    queryKey: 'F00001QK46',
  }),
]);

const YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_PERIOD_START = 1253862000;
const YAHOO_PERIOD_END = 2546985600;
const MORNINGSTAR_AUTH_PAGE_URL = 'https://indexes.morningstar.com/indexes/details/morningstar-developed-europe-screened-select-150-eur-FS0000JKWD?currency=EUR&tab=overview&variant=NR';
const MORNINGSTAR_TIMESERIES_BASE = 'https://www.us-api.morningstar.com/QS-markets/chartservice/v2/timeseries';
const MORNINGSTAR_START_DATE = '1900-01-01';
const MORNINGSTAR_TRACK_MARKET_DATA = '3.6.3';
const MORNINGSTAR_INST_ID = 'MSIND';
const MORNINGSTAR_FREQUENCY = 'm';
const DEFAULT_UPSTREAM_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_UPSTREAM_BODY_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_NORMALIZED_POINTS = 5_000;
const MAX_MORNINGSTAR_TOKEN_LENGTH = 16 * 1024;
const MAX_REDIRECTS = 3;
const EARLIEST_PLAUSIBLE_DATE = '1900-01-01';
const MAX_FUTURE_DATE_SKEW_MS = 2 * 24 * 60 * 60 * 1000;
const SUCCESS_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const NO_STORE_CACHE_CONTROL = 'no-store';
const DAY_MS = 24 * 60 * 60 * 1000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_UPSTREAM_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'indexes.morningstar.com',
  'www.us-api.morningstar.com',
]);
const BLOCKED_INBOUND_HEADERS = Object.freeze([
  'authorization',
  'range',
]);
// Do not reject Cache-Control or Pragma: browsers may add them for an explicit
// fetch cache mode or while developer tools are open. WAF rate limiting remains
// the protection against callers that intentionally bypass an otherwise valid
// CDN entry with those standard headers.

class UpstreamHttpError extends Error {
  constructor(source, status) {
    super(`${source} returned HTTP ${status}`);
    this.name = 'UpstreamHttpError';
    this.source = source;
    this.status = status;
  }
}

class RequestCancelledError extends Error {
  constructor() {
    super('Request was cancelled');
    this.name = 'RequestCancelledError';
  }
}

const rethrowIfRequestCancelled = (error, signal) => {
  if (error instanceof RequestCancelledError || signal?.aborted) {
    throw new RequestCancelledError();
  }
};

const getDateKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthKey = (dateKey) => dateKey.slice(0, 7);

const comparePoints = (left, right) => left.date.localeCompare(right.date);

const isPlausibleDateKey = (dateKey, now) => {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || getDateKey(parsed) !== dateKey) {
    return false;
  }
  const latestPlausibleDate = getDateKey(new Date(now.getTime() + MAX_FUTURE_DATE_SKEW_MS));
  return dateKey >= EARLIEST_PLAUSIBLE_DATE && dateKey <= latestPlausibleDate;
};

const deduplicateAndSortPoints = (points, now, maxPoints) => {
  const byDate = new Map();
  for (const point of points) {
    if (
      point
      && isPlausibleDateKey(point.date, now)
      && typeof point.value === 'number'
      && Number.isFinite(point.value)
      && point.value > 0
    ) {
      byDate.set(point.date, { date: point.date, value: point.value });
      if (byDate.size > maxPoints) {
        throw new Error(`Upstream returned more than ${maxPoints} normalized points`);
      }
    }
  }
  return Array.from(byDate.values()).sort(comparePoints);
};

const getTodayKeyForOffset = (now, offsetSeconds) => {
  const shiftedNow = new Date(now.getTime() + (offsetSeconds * 1000));
  return getDateKey(shiftedNow);
};

const getRuntimeNow = (nowOption) => {
  const candidate = typeof nowOption === 'function' ? nowOption() : nowOption;
  const date = candidate === undefined ? new Date() : new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid server clock value');
  }
  return date;
};

const parseJsonText = (rawText, source) => {
  const normalized = rawText.trim().replace(/^\)\]\}'\s*/, '');
  if (!normalized) {
    throw new Error(`${source} returned an empty response`);
  }
  try {
    return JSON.parse(normalized);
  } catch {
    throw new Error(`${source} returned invalid JSON`);
  }
};

const assertAllowedUpstreamUrl = (candidateUrl, allowedHosts) => {
  let parsed;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    throw new Error('Upstream URL is invalid');
  }
  if (
    parsed.protocol !== 'https:'
    || (parsed.port !== '' && parsed.port !== '443')
    || parsed.username !== ''
    || parsed.password !== ''
    || !allowedHosts.has(parsed.hostname)
  ) {
    throw new Error('Upstream redirect target is not allowed');
  }
  return parsed;
};

const readBoundedResponseText = async (response, maxBodyBytes, signal) => {
  const declaredLength = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error(`Upstream response exceeded ${maxBodyBytes} bytes`);
  }
  if (!response.body) {
    return '';
  }
  if (signal.aborted) {
    void response.body.cancel().catch(() => {});
    throw new RequestCancelledError();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteCount = 0;
  let rejectOnAbort;
  const abortPromise = new Promise((_, reject) => {
    rejectOnAbort = () => reject(new RequestCancelledError());
    signal.addEventListener('abort', rejectOnAbort, { once: true });
  });

  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), abortPromise]);
      if (done) {
        break;
      }
      byteCount += value.byteLength;
      if (byteCount > maxBodyBytes) {
        throw new Error(`Upstream response exceeded ${maxBodyBytes} bytes`);
      }
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener('abort', rejectOnAbort);
  }

  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

export const fetchWithTimeout = async (
  url,
  requestInit = {},
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
    maxBodyBytes = DEFAULT_MAX_UPSTREAM_BODY_BYTES,
    signal: requestSignal,
  } = {}
) => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Upstream timeout must be a positive number');
  }
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new Error('Upstream body limit must be a positive integer');
  }

  const initialUrl = new URL(url);
  if (!ALLOWED_UPSTREAM_HOSTS.has(initialUrl.hostname)) {
    throw new Error('Upstream host is not allowlisted');
  }
  const allowedHosts = new Set([initialUrl.hostname]);
  let currentUrl = assertAllowedUpstreamUrl(initialUrl, allowedHosts);
  const combinedController = new AbortController();
  let didTimeout = false;
  const linkedSignals = [requestSignal, requestInit.signal].filter(Boolean);
  const abortFromLinkedSignal = () => combinedController.abort();
  linkedSignals.forEach((linkedSignal) => {
    if (linkedSignal.aborted) {
      combinedController.abort();
    } else {
      linkedSignal.addEventListener('abort', abortFromLinkedSignal, { once: true });
    }
  });
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    combinedController.abort();
  }, timeoutMs);

  try {
    if (combinedController.signal.aborted) {
      throw new RequestCancelledError();
    }

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const response = await fetchImpl(currentUrl.toString(), {
        cache: 'no-store',
        ...requestInit,
        redirect: 'manual',
        signal: combinedController.signal,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        void response.body?.cancel().catch(() => {});
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error(`Upstream exceeded ${MAX_REDIRECTS} redirects`);
        }
        const location = response.headers.get('Location');
        if (!location) {
          throw new Error('Upstream redirect did not include a location');
        }
        currentUrl = assertAllowedUpstreamUrl(new URL(location, currentUrl), allowedHosts);
        continue;
      }

      const rawText = await readBoundedResponseText(
        response,
        maxBodyBytes,
        combinedController.signal
      );
      return { response, rawText };
    }
    throw new Error(`Upstream exceeded ${MAX_REDIRECTS} redirects`);
  } catch (error) {
    if (didTimeout) {
      throw new Error(`Upstream request timed out after ${timeoutMs} ms`);
    }
    if (linkedSignals.some((linkedSignal) => linkedSignal.aborted)) {
      throw new RequestCancelledError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    linkedSignals.forEach((linkedSignal) => {
      linkedSignal.removeEventListener('abort', abortFromLinkedSignal);
    });
  }
};

const fetchUpstreamText = async (url, source, runtime, requestInit = {}) => {
  const { response, rawText } = await fetchWithTimeout(url, requestInit, runtime);
  if (!response.ok) {
    throw new UpstreamHttpError(source, response.status);
  }
  return rawText;
};

const fetchUpstreamJson = async (url, source, runtime, requestInit = {}) => {
  const rawText = await fetchUpstreamText(url, source, runtime, requestInit);
  return parseJsonText(rawText, source);
};

const parseYahooPayload = (payload, runtime) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Yahoo returned an invalid response');
  }

  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const closePrices = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closePrices)) {
    throw new Error('Yahoo returned an invalid response');
  }
  if (timestamps.length > runtime.maxPoints || closePrices.length > runtime.maxPoints) {
    throw new Error(`Yahoo returned more than ${runtime.maxPoints} points`);
  }

  const offsetSeconds = typeof result.meta?.gmtoffset === 'number' && Number.isFinite(result.meta.gmtoffset)
    ? result.meta.gmtoffset
    : 0;

  const points = timestamps.map((timestamp, index) => {
    const value = closePrices[index];
    if (
      typeof timestamp !== 'number'
      || !Number.isFinite(timestamp)
      || typeof value !== 'number'
      || !Number.isFinite(value)
    ) {
      return null;
    }

    const marketDate = new Date((timestamp + offsetSeconds) * 1000);
    if (Number.isNaN(marketDate.getTime())) {
      return null;
    }
    return {
      date: getDateKey(marketDate),
      value,
    };
  });

  return {
    offsetSeconds,
    points: deduplicateAndSortPoints(points, runtime.now, runtime.maxPoints),
  };
};

const fetchYahooPayload = async (url, runtime) => {
  const payload = await fetchUpstreamJson(url, 'Yahoo', runtime, {
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': 'LifeEvents-Index-Proxy/1.0',
    },
  });
  return parseYahooPayload(payload, runtime);
};

const buildYahooUrl = (symbol, searchParams) => {
  const url = new URL(`${YAHOO_FINANCE_BASE}/${encodeURIComponent(symbol)}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const fetchYahooPoints = async (definition, runtime) => {
  const monthlyUrl = buildYahooUrl(definition.symbol, {
    period1: YAHOO_PERIOD_START,
    period2: YAHOO_PERIOD_END,
    interval: '1mo',
  });
  const monthlyResult = await fetchYahooPayload(monthlyUrl, runtime);
  if (monthlyResult.points.length === 0) {
    throw new Error('Yahoo returned no valid monthly points');
  }

  const todayMonthlyKey = getTodayKeyForOffset(runtime.now, monthlyResult.offsetSeconds);
  const monthlyLatestPoint = monthlyResult.points.at(-1);
  const monthlyLatestSelectablePoint = monthlyResult.points
    .filter((point) => point.date < todayMonthlyKey)
    .at(-1);

  const nowUnix = Math.floor(runtime.now.getTime() / 1000);
  const currentMonthStartUnix = Math.floor(Date.UTC(
    runtime.now.getUTCFullYear(),
    runtime.now.getUTCMonth(),
    1
  ) / 1000);
  const dailyUrls = [
    buildYahooUrl(definition.symbol, { range: '3mo', interval: '1d' }),
    buildYahooUrl(definition.symbol, { range: '1mo', interval: '1d' }),
    buildYahooUrl(definition.symbol, {
      period1: currentMonthStartUnix - (7 * DAY_MS / 1000),
      period2: nowUnix + (2 * DAY_MS / 1000),
      interval: '1d',
    }),
  ];

  let dailyResult = null;
  for (const dailyUrl of dailyUrls) {
    try {
      const candidate = await fetchYahooPayload(dailyUrl, runtime);
      if (candidate.points.length > 0) {
        dailyResult = candidate;
        break;
      }
    } catch (error) {
      rethrowIfRequestCancelled(error, runtime.signal);
      // Monthly history is still useful if every latest-daily attempt fails.
    }
  }

  if (!dailyResult) {
    return monthlyResult.points;
  }

  const todayDailyKey = getTodayKeyForOffset(runtime.now, dailyResult.offsetSeconds);
  const currentMonthKey = todayDailyKey.slice(0, 7);
  const dailyCurrentMonthPoints = dailyResult.points.filter((point) => (
    point.date < todayDailyKey && getMonthKey(point.date) === currentMonthKey
  ));
  const firstDailyCurrentMonthPoint = dailyCurrentMonthPoints[0];
  const latestDailyCurrentMonthPoint = dailyCurrentMonthPoints.at(-1);

  if (firstDailyCurrentMonthPoint && latestDailyCurrentMonthPoint) {
    const replacements = [firstDailyCurrentMonthPoint];
    if (latestDailyCurrentMonthPoint.date !== firstDailyCurrentMonthPoint.date) {
      replacements.push(latestDailyCurrentMonthPoint);
    }
    return deduplicateAndSortPoints([
      ...monthlyResult.points.filter((point) => getMonthKey(point.date) !== currentMonthKey),
      ...replacements,
    ], runtime.now, runtime.maxPoints);
  }

  const latestDailyPoint = dailyResult.points
    .filter((point) => point.date < todayDailyKey)
    .at(-1);
  const latestMonthlyComparablePoint = monthlyLatestSelectablePoint ?? monthlyLatestPoint;

  if (latestDailyPoint && (!latestMonthlyComparablePoint || latestDailyPoint.date > latestMonthlyComparablePoint.date)) {
    const latestDailyMonthKey = getMonthKey(latestDailyPoint.date);
    return deduplicateAndSortPoints([
      ...monthlyResult.points.filter((point) => getMonthKey(point.date) !== latestDailyMonthKey),
      latestDailyPoint,
    ], runtime.now, runtime.maxPoints);
  }

  return monthlyResult.points;
};

const isLikelyJwt = (token) => (
  token.length > 80
  && /^[A-Za-z0-9+/_=-]+\.[A-Za-z0-9+/_=-]+\.[A-Za-z0-9+/_=-]+$/.test(token)
);

const collectTokenMatches = (input, pattern) => {
  const matches = [];
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  let match = null;
  while ((match = regex.exec(input)) !== null) {
    const candidate = match[1]?.trim();
    if (
      candidate
      && candidate.length > 20
      && candidate.length <= MAX_MORNINGSTAR_TOKEN_LENGTH
    ) {
      matches.push(candidate);
    }
  }
  return matches;
};

export const extractMorningstarToken = (html) => {
  if (typeof html !== 'string' || !html) {
    return null;
  }

  const normalizedInputs = [
    html,
    html.replace(/&quot;/gi, '"').replace(/&#x2F;/gi, '/'),
    html.replace(/\\"/g, '"'),
    html.replace(/\\u002F/gi, '/').replace(/\\"/g, '"'),
  ];
  const tokenMaaSCandidates = [];
  const accessTokenCandidates = [];

  for (const input of normalizedInputs) {
    tokenMaaSCandidates.push(
      ...collectTokenMatches(input, /["']?tokenMaaS["']?\s*[:=]\s*["']([^"']+)["']/i)
    );
    accessTokenCandidates.push(
      ...collectTokenMatches(input, /["']?accessToken["']?\s*[:=]\s*["']([^"']+)["']/i)
    );
  }

  const uniqueCandidates = Array.from(new Set([
    ...tokenMaaSCandidates,
    ...accessTokenCandidates,
  ]));
  return uniqueCandidates.find(isLikelyJwt)
    ?? uniqueCandidates.sort((left, right) => right.length - left.length)[0]
    ?? null;
};

const fetchMorningstarToken = async (runtime) => {
  const authUrl = new URL(MORNINGSTAR_AUTH_PAGE_URL);
  authUrl.searchParams.set('_ts', String(runtime.now.getTime()));
  const html = await fetchUpstreamText(authUrl.toString(), 'Morningstar auth', runtime, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      Origin: 'https://indexes.morningstar.com',
      Referer: 'https://indexes.morningstar.com/',
      'User-Agent': 'LifeEvents-Index-Proxy/1.0',
    },
  });
  const token = extractMorningstarToken(html);
  if (!token) {
    throw new Error('Morningstar auth token was unavailable');
  }
  return token;
};

const buildMorningstarUrl = (definition, now) => {
  const params = new URLSearchParams({
    query: `${definition.queryKey}:open,high,low,close,volume,previousClose`,
    frequency: MORNINGSTAR_FREQUENCY,
    startDate: MORNINGSTAR_START_DATE,
    endDate: getDateKey(now),
    trackMarketData: MORNINGSTAR_TRACK_MARKET_DATA,
    instid: MORNINGSTAR_INST_ID,
  });
  return `${MORNINGSTAR_TIMESERIES_BASE}?${params.toString()}`;
};

const getMorningstarSeries = (payload, queryKey) => {
  if (!Array.isArray(payload)) {
    return null;
  }
  const exact = payload.find((item) => (
    item && typeof item === 'object' && item.queryKey === queryKey && Array.isArray(item.series)
  ));
  if (exact) {
    return exact.series;
  }
  return null;
};

const parseMorningstarPayload = (payload, definition, runtime) => {
  const series = getMorningstarSeries(payload, definition.queryKey);
  if (!series) {
    throw new Error('Morningstar returned an invalid response');
  }
  if (series.length > runtime.maxPoints) {
    throw new Error(`Morningstar returned more than ${runtime.maxPoints} points`);
  }

  const points = series.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.close !== 'number' || !Number.isFinite(item.close)) {
      return null;
    }
    const sourceDate = typeof item.date === 'string' ? new Date(item.date) : null;
    if (!sourceDate || Number.isNaN(sourceDate.getTime())) {
      return null;
    }
    return {
      date: getDateKey(sourceDate),
      value: item.close,
    };
  });
  const normalizedPoints = deduplicateAndSortPoints(points, runtime.now, runtime.maxPoints);
  if (normalizedPoints.length === 0) {
    throw new Error('Morningstar returned no valid points');
  }
  return normalizedPoints;
};

const fetchMorningstarPoints = async (definition, token, runtime) => {
  const headers = {
    Accept: 'application/json,text/plain,*/*',
    Authorization: `Bearer ${token}`,
    Origin: 'https://indexes.morningstar.com',
    Referer: 'https://indexes.morningstar.com/',
    'User-Agent': 'LifeEvents-Index-Proxy/1.0',
    'X-Api-RequestId': runtime.createRequestId(),
  };
  const payload = await fetchUpstreamJson(
    buildMorningstarUrl(definition, runtime.now),
    'Morningstar data',
    runtime,
    { headers }
  );
  return parseMorningstarPayload(payload, definition, runtime);
};

const fetchMorningstarBatch = async (definitions, runtime) => {
  let token;
  try {
    token = await fetchMorningstarToken(runtime);
  } catch (error) {
    rethrowIfRequestCancelled(error, runtime.signal);
    return {
      loaded: [],
      failed: definitions.map((definition) => ({ definition, error })),
    };
  }

  let attempts = await Promise.allSettled(
    definitions.map((definition) => fetchMorningstarPoints(definition, token, runtime))
  );
  if (runtime.signal?.aborted) {
    throw new RequestCancelledError();
  }
  const unauthorizedIndexes = attempts
    .map((attempt, index) => (
      attempt.status === 'rejected'
      && attempt.reason instanceof UpstreamHttpError
      && attempt.reason.status === 401
        ? index
        : -1
    ))
    .filter((index) => index >= 0);

  if (unauthorizedIndexes.length > 0) {
    try {
      token = await fetchMorningstarToken(runtime);
      const retries = await Promise.allSettled(
        unauthorizedIndexes.map((index) => fetchMorningstarPoints(definitions[index], token, runtime))
      );
      attempts = [...attempts];
      unauthorizedIndexes.forEach((originalIndex, retryIndex) => {
        attempts[originalIndex] = retries[retryIndex];
      });
    } catch (error) {
      rethrowIfRequestCancelled(error, runtime.signal);
      attempts = [...attempts];
      unauthorizedIndexes.forEach((index) => {
        attempts[index] = { status: 'rejected', reason: error };
      });
    }
  }
  if (runtime.signal?.aborted) {
    throw new RequestCancelledError();
  }

  const loaded = [];
  const failed = [];
  attempts.forEach((attempt, index) => {
    const definition = definitions[index];
    if (attempt.status === 'fulfilled') {
      loaded.push({
        symbol: definition.symbol,
        source: definition.source,
        points: attempt.value,
      });
    } else {
      failed.push({ definition, error: attempt.reason });
    }
  });
  return { loaded, failed };
};

const describeFailureForLog = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown upstream failure';
};

const loadRequestedSeries = async (requestedSymbol, runtime) => {
  const requestedDefinitions = requestedSymbol === 'all'
    ? SERIES_DEFINITIONS
    : SERIES_DEFINITIONS.filter((definition) => definition.symbol === requestedSymbol);
  const loadedBySymbol = new Map();
  const failuresBySymbol = new Map();
  const yahooDefinitions = requestedDefinitions.filter((definition) => definition.source === 'yahoo');
  const morningstarDefinitions = requestedDefinitions.filter((definition) => definition.source === 'morningstar');

  await Promise.all([
    ...yahooDefinitions.map(async (definition) => {
      try {
        const points = await fetchYahooPoints(definition, runtime);
        loadedBySymbol.set(definition.symbol, {
          symbol: definition.symbol,
          source: definition.source,
          points,
        });
      } catch (error) {
        rethrowIfRequestCancelled(error, runtime.signal);
        failuresBySymbol.set(definition.symbol, error);
      }
    }),
    ...(morningstarDefinitions.length > 0
      ? [fetchMorningstarBatch(morningstarDefinitions, runtime).then(({ loaded, failed }) => {
          loaded.forEach((series) => loadedBySymbol.set(series.symbol, series));
          failed.forEach(({ definition, error }) => failuresBySymbol.set(definition.symbol, error));
        })]
      : []),
  ]);

  const series = requestedDefinitions
    .map((definition) => loadedBySymbol.get(definition.symbol))
    .filter(Boolean);
  const errors = requestedDefinitions
    .filter((definition) => failuresBySymbol.has(definition.symbol))
    .map((definition) => {
      const error = failuresBySymbol.get(definition.symbol);
      console.error(`Index proxy failed for ${definition.symbol}: ${describeFailureForLog(error)}`);
      return {
        symbol: definition.symbol,
        error: `Unable to load ${definition.symbol} from ${definition.source}.`,
      };
    });

  return { series, errors };
};

const parseConfiguredOrigin = (candidate) => {
  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '*') {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== trimmed) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

export const getAllowedOrigins = (env = process.env) => {
  const configured = typeof env.ALLOWED_ORIGINS === 'string'
    ? env.ALLOWED_ORIGINS.split(',').map(parseConfiguredOrigin).filter(Boolean)
    : [];
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
};

const getCorsHeaders = (origin, allowedOrigins) => {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
};

const createJsonResponse = (payload, { status, origin, allowedOrigins, cacheControl }) => new Response(
  JSON.stringify(payload),
  {
    status,
    headers: {
      ...getCorsHeaders(origin, allowedOrigins),
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  }
);

const createErrorPayload = (message, symbol = null) => ({
  series: [],
  errors: [{ symbol, error: message }],
});

const validateQuery = (requestUrl) => {
  const entries = Array.from(requestUrl.searchParams.entries());
  if (entries.length !== 1 || entries[0][0] !== 'symbol') {
    return {
      error: 'Exactly one symbol query parameter is required, with no additional parameters.',
    };
  }
  const symbol = entries[0][1];
  if (!ALLOWED_SYMBOLS.includes(symbol)) {
    return {
      error: `Unsupported symbol. Allowed values: ${ALLOWED_SYMBOLS.join(', ')}.`,
    };
  }
  return { symbol };
};

export const handleIndexHistoryRequest = async (request, options = {}) => {
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins(options.env);
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins.has(origin)) {
    return createJsonResponse(createErrorPayload('Origin is not allowed.'), {
      status: 403,
      origin,
      allowedOrigins,
      cacheControl: NO_STORE_CACHE_CONTROL,
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(origin, allowedOrigins),
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (request.method !== 'GET') {
    const response = createJsonResponse(createErrorPayload('Method not allowed.'), {
      status: 405,
      origin,
      allowedOrigins,
      cacheControl: NO_STORE_CACHE_CONTROL,
    });
    response.headers.set('Allow', 'GET, OPTIONS');
    return response;
  }

  const blockedHeader = BLOCKED_INBOUND_HEADERS.find((headerName) => request.headers.has(headerName));
  if (blockedHeader) {
    return createJsonResponse(createErrorPayload('Request contains an unsupported header.'), {
      status: 400,
      origin,
      allowedOrigins,
      cacheControl: NO_STORE_CACHE_CONTROL,
    });
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return createJsonResponse(createErrorPayload('Invalid request URL.'), {
      status: 400,
      origin,
      allowedOrigins,
      cacheControl: NO_STORE_CACHE_CONTROL,
    });
  }

  const query = validateQuery(requestUrl);
  if (query.error) {
    return createJsonResponse(createErrorPayload(query.error), {
      status: 400,
      origin,
      allowedOrigins,
      cacheControl: NO_STORE_CACHE_CONTROL,
    });
  }

  const maxPoints = options.maxPoints ?? DEFAULT_MAX_NORMALIZED_POINTS;
  if (!Number.isSafeInteger(maxPoints) || maxPoints <= 0) {
    throw new Error('Point limit must be a positive integer');
  }
  const runtime = {
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS,
    maxBodyBytes: options.maxBodyBytes ?? DEFAULT_MAX_UPSTREAM_BODY_BYTES,
    maxPoints,
    now: getRuntimeNow(options.now),
    createRequestId: options.createRequestId ?? randomUUID,
    signal: request.signal,
  };
  const payload = await loadRequestedSeries(query.symbol, runtime);
  const hasErrors = payload.errors.length > 0;
  const status = payload.series.length > 0 ? 200 : 502;

  return createJsonResponse(payload, {
    status,
    origin,
    allowedOrigins,
    cacheControl: hasErrors ? NO_STORE_CACHE_CONTROL : SUCCESS_CACHE_CONTROL,
  });
};
