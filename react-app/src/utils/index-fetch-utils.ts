import {
  isIndexApiResponse,
  type IndexApiResponse,
} from './index-api-utils';

export type IndexFetchPolicy = 'manual' | 'automatic';

export const INDEX_API_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const INDEX_API_SESSION_CACHE_KEY = 'life-events:index-api:all:v1';

export const shouldReadIndexApiSessionCache = (
  policy: IndexFetchPolicy,
  symbol?: string
): boolean => policy === 'automatic' && symbol === undefined;

export const shouldUseLegacyIndexFallback = (
  policy: IndexFetchPolicy
): boolean => policy === 'manual';

interface CachedIndexApiResponse {
  cachedAt: number;
  endpoint: string;
  response: IndexApiResponse;
}

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const isCompleteSuccessfulResponse = (
  response: unknown,
  expectedSymbols: string[],
  now: Date
): response is IndexApiResponse => (
  isIndexApiResponse(response, expectedSymbols, now)
  && response.errors.length === 0
  && response.series.length === expectedSymbols.length
);

export const readIndexApiSessionCache = ({
  endpoint,
  expectedSymbols,
  now = Date.now(),
  storage = getSessionStorage(),
}: {
  endpoint: string;
  expectedSymbols: string[];
  now?: number;
  storage?: Storage | null;
}): IndexApiResponse | null => {
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(INDEX_API_SESSION_CACHE_KEY);
    if (!rawValue) return null;

    const cachedValue = JSON.parse(rawValue) as Partial<CachedIndexApiResponse>;
    const cacheAge = now - (cachedValue.cachedAt ?? Number.NaN);
    const isFresh = Number.isFinite(cacheAge)
      && cacheAge >= 0
      && cacheAge <= INDEX_API_SESSION_CACHE_TTL_MS;

    if (
      cachedValue.endpoint !== endpoint
      || !isFresh
      || !isCompleteSuccessfulResponse(
        cachedValue.response,
        expectedSymbols,
        new Date(now)
      )
    ) {
      storage.removeItem(INDEX_API_SESSION_CACHE_KEY);
      return null;
    }

    return cachedValue.response;
  } catch {
    try {
      storage.removeItem(INDEX_API_SESSION_CACHE_KEY);
    } catch {
      // Storage may be disabled or unavailable. Index loading can continue.
    }
    return null;
  }
};

export const writeIndexApiSessionCache = ({
  endpoint,
  expectedSymbols,
  response,
  now = Date.now(),
  storage = getSessionStorage(),
}: {
  endpoint: string;
  expectedSymbols: string[];
  response: unknown;
  now?: number;
  storage?: Storage | null;
}): boolean => {
  if (
    !storage
    || !isCompleteSuccessfulResponse(response, expectedSymbols, new Date(now))
  ) {
    return false;
  }

  try {
    const cachedValue: CachedIndexApiResponse = {
      cachedAt: now,
      endpoint,
      response,
    };
    storage.setItem(INDEX_API_SESSION_CACHE_KEY, JSON.stringify(cachedValue));
    return true;
  } catch {
    return false;
  }
};
