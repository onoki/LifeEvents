import type { IndexApiResponse } from '../index-api-utils';
import {
  INDEX_API_SESSION_CACHE_TTL_MS,
  readIndexApiSessionCache,
  shouldReadIndexApiSessionCache,
  shouldUseLegacyIndexFallback,
  writeIndexApiSessionCache,
} from '../index-fetch-utils';

const NOW = Date.UTC(2026, 7, 16, 12);
const ENDPOINT = 'https://life-events-five.vercel.app/api/index-history';
const SYMBOLS = ['EUNL.DE', 'MSNA', 'MSDE', 'MSDA'];

const makeResponse = (): IndexApiResponse => ({
  series: SYMBOLS.map((symbol, index) => ({
    symbol,
    source: symbol === 'EUNL.DE' ? 'yahoo' : 'morningstar',
    points: [
      { date: '2026-07-01', value: 100 + index },
      { date: '2026-08-14', value: 105 + index },
    ],
  })),
  errors: [],
});

describe('index fetch cache policy', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('uses the session cache only for an automatic all-index request', () => {
    expect(shouldReadIndexApiSessionCache('automatic')).toBe(true);
    expect(shouldReadIndexApiSessionCache('automatic', 'EUNL.DE')).toBe(false);
    expect(shouldReadIndexApiSessionCache('manual')).toBe(false);
  });

  it('allows slow legacy sources only for an explicit manual refresh', () => {
    expect(shouldUseLegacyIndexFallback('automatic')).toBe(false);
    expect(shouldUseLegacyIndexFallback('manual')).toBe(true);
  });

  it('round-trips a fresh, complete, validated all-index response', () => {
    const response = makeResponse();

    expect(writeIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      response,
      now: NOW,
    })).toBe(true);

    expect(readIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      now: NOW + INDEX_API_SESSION_CACHE_TTL_MS,
    })).toEqual(response);
  });

  it('rejects incomplete responses instead of caching partial results', () => {
    const response = makeResponse();
    response.series = response.series.slice(1);
    response.errors = [{ symbol: 'EUNL.DE', error: 'temporarily unavailable' }];

    expect(writeIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      response,
      now: NOW,
    })).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('discards entries after five minutes or when the endpoint changes', () => {
    const response = makeResponse();
    writeIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      response,
      now: NOW,
    });

    expect(readIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      now: NOW + INDEX_API_SESSION_CACHE_TTL_MS + 1,
    })).toBeNull();

    writeIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      response,
      now: NOW,
    });
    expect(readIndexApiSessionCache({
      endpoint: 'https://example.com/api/index-history',
      expectedSymbols: SYMBOLS,
      now: NOW + 1,
    })).toBeNull();
  });

  it('revalidates stored data before using it', () => {
    writeIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      response: makeResponse(),
      now: NOW,
    });

    const cacheKey = window.sessionStorage.key(0);
    expect(cacheKey).not.toBeNull();
    const cachedValue = JSON.parse(
      window.sessionStorage.getItem(cacheKey as string) as string
    ) as { response: IndexApiResponse };
    cachedValue.response.series[0].points[0].value = -1;
    window.sessionStorage.setItem(cacheKey as string, JSON.stringify(cachedValue));

    expect(readIndexApiSessionCache({
      endpoint: ENDPOINT,
      expectedSymbols: SYMBOLS,
      now: NOW + 1,
    })).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });
});
