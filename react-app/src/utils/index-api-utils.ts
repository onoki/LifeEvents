export interface IndexApiPoint {
  date: string;
  value: number;
}

export interface IndexApiSeries {
  symbol: string;
  source: 'yahoo' | 'morningstar';
  points: IndexApiPoint[];
}

export interface IndexApiError {
  symbol: string;
  error: string;
}

export interface IndexApiResponse {
  series: IndexApiSeries[];
  errors: IndexApiError[];
}

interface FetchConfiguredIndexApiOptions {
  endpoint: string;
  requestedSymbol: string;
  expectedSymbols: string[];
  timeoutMs: number;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EARLIEST_INDEX_DATE = '1900-01-01';
const MAX_FUTURE_DATE_DAYS = 7;
export const MAX_INDEX_API_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_INDEX_API_POINTS_PER_SERIES = 5_000;
export const MAX_INDEX_API_POINT_VALUE = 1_000_000_000_000;
const MAX_INDEX_API_ERROR_LENGTH = 1_000;
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

const getUtcDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLatestPlausibleIndexDate = (now: Date): string => {
  const upperBound = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + MAX_FUTURE_DATE_DAYS
  ));
  return getUtcDateKey(upperBound);
};

const isValidIsoDate = (value: string): boolean => {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() === Number(match[2]) - 1
    && parsed.getUTCDate() === Number(match[3]);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isIndexApiResponse = (
  value: unknown,
  expectedSymbols: string[],
  now: Date = new Date()
): value is IndexApiResponse => {
  if (!isObject(value) || !Array.isArray(value.series) || !Array.isArray(value.errors)) {
    return false;
  }

  const expected = new Set(expectedSymbols);
  const reported = new Set<string>();
  const latestPlausibleDate = getLatestPlausibleIndexDate(now);

  for (const candidate of value.series) {
    if (!isObject(candidate)) return false;
    const { symbol, source, points } = candidate;
    if (
      typeof symbol !== 'string'
      || !expected.has(symbol)
      || reported.has(symbol)
      || (source !== 'yahoo' && source !== 'morningstar')
      || !Array.isArray(points)
      || points.length === 0
      || points.length > MAX_INDEX_API_POINTS_PER_SERIES
    ) {
      return false;
    }

    let previousDate: string | null = null;
    for (const point of points) {
      if (
        !isObject(point)
        || typeof point.date !== 'string'
        || !isValidIsoDate(point.date)
        || point.date < EARLIEST_INDEX_DATE
        || point.date > latestPlausibleDate
        || (previousDate !== null && point.date <= previousDate)
        || typeof point.value !== 'number'
        || !Number.isFinite(point.value)
        || point.value <= 0
        || point.value > MAX_INDEX_API_POINT_VALUE
      ) {
        return false;
      }
      previousDate = point.date;
    }
    reported.add(symbol);
  }

  for (const candidate of value.errors) {
    if (!isObject(candidate)) return false;
    const { symbol, error } = candidate;
    if (
      typeof symbol !== 'string'
      || !expected.has(symbol)
      || reported.has(symbol)
      || typeof error !== 'string'
      || error.trim().length === 0
      || error.length > MAX_INDEX_API_ERROR_LENGTH
    ) {
      return false;
    }
    reported.add(symbol);
  }

  return reported.size === expected.size;
};

const getOversizedResponseError = (): Error => new Error(
  `Configured index API response exceeds the ${MAX_INDEX_API_RESPONSE_BYTES / (1024 * 1024)} MB safety limit`
);

const readResponseTextWithinLimit = async (
  response: Response,
  controller: AbortController
): Promise<string> => {
  const contentLengthHeader = response.headers.get('Content-Length');
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (
    contentLength !== null
    && Number.isFinite(contentLength)
    && contentLength > MAX_INDEX_API_RESPONSE_BYTES
  ) {
    controller.abort();
    throw getOversizedResponseError();
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_INDEX_API_RESPONSE_BYTES) {
      throw getOversizedResponseError();
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_INDEX_API_RESPONSE_BYTES) {
        controller.abort();
        try {
          await reader.cancel();
        } catch {
          // The abort may already have closed the response stream.
        }
        throw getOversizedResponseError();
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock();
  }
};

export const buildIndexApiUrl = (
  endpoint: string,
  requestedSymbol: string,
  baseUrl?: string
): string => {
  const fallbackBase = baseUrl
    ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  let url: URL;
  try {
    url = new URL(endpoint, fallbackBase);
  } catch {
    throw new Error('Configured index API endpoint must be a valid HTTPS URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Configured index API endpoint must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Configured index API endpoint must not contain embedded credentials.');
  }
  if (url.protocol === 'http:' && !LOOPBACK_HOSTNAMES.has(url.hostname)) {
    throw new Error('Configured index API endpoint must use HTTPS outside local development.');
  }

  url.search = '';
  url.hash = '';
  url.searchParams.set('symbol', requestedSymbol);
  return url.toString();
};

export const fetchConfiguredIndexApi = async ({
  endpoint,
  requestedSymbol,
  expectedSymbols,
  timeoutMs,
  fetchFn = fetch,
  baseUrl,
}: FetchConfiguredIndexApiOptions): Promise<IndexApiResponse> => {
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchFn(
      buildIndexApiUrl(endpoint, requestedSymbol, baseUrl),
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawPayload = await readResponseTextWithinLimit(response, controller);
    let payload: unknown;
    try {
      payload = JSON.parse(rawPayload) as unknown;
    } catch {
      throw new Error('Invalid data format from configured index API');
    }
    if (!isIndexApiResponse(payload, expectedSymbols)) {
      throw new Error('Invalid data format from configured index API');
    }
    return payload;
  } catch (error) {
    if (didTimeout) {
      throw new Error(`Configured index API timed out after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
