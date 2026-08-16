import {
  buildIndexApiUrl,
  fetchConfiguredIndexApi,
  isIndexApiResponse,
  MAX_INDEX_API_POINT_VALUE,
  MAX_INDEX_API_RESPONSE_BYTES,
} from '../index-api-utils';

const validPayload = {
  series: [
    {
      symbol: 'EUNL.DE',
      source: 'yahoo',
      points: [{ date: '2026-08-14', value: 123.45 }],
    },
  ],
  errors: [{ symbol: 'MSNA', error: 'Upstream request failed' }],
};

const mockResponse = (
  payload: unknown,
  status = 200,
  statusText = 'OK',
  contentLength?: string
): Response => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  headers: {
    get: (name: string) => (
      name.toLowerCase() === 'content-length' ? contentLength ?? null : null
    ),
  } as Headers,
  body: null,
  text: async () => JSON.stringify(payload),
} as Response);

describe('index API client', () => {
  it('builds only the configured endpoint and symbol query', () => {
    expect(
      buildIndexApiUrl(
        'https://example.vercel.app/api/index-history?ignored=true#fragment',
        'EUNL.DE'
      )
    ).toBe('https://example.vercel.app/api/index-history?symbol=EUNL.DE');
  });

  it('allows plain HTTP only for exact loopback development hosts', () => {
    expect(buildIndexApiUrl('http://localhost:3000/api/index-history', 'all'))
      .toBe('http://localhost:3000/api/index-history?symbol=all');
    expect(buildIndexApiUrl('http://127.0.0.1:3000/api/index-history', 'all'))
      .toBe('http://127.0.0.1:3000/api/index-history?symbol=all');
    expect(buildIndexApiUrl('http://[::1]:3000/api/index-history', 'all'))
      .toBe('http://[::1]:3000/api/index-history?symbol=all');

    [
      'http://example.com/api/index-history',
      'http://192.168.1.10/api/index-history',
      'http://localhost.example.com/api/index-history',
    ].forEach((endpoint) => {
      expect(() => buildIndexApiUrl(endpoint, 'all'))
        .toThrow('must use HTTPS outside local development');
    });
  });

  it('rejects non-network protocols and configured endpoints with credentials', () => {
    ['javascript:alert(1)', 'data:application/json,{}', 'file:///tmp/index.json']
      .forEach((endpoint) => {
        expect(() => buildIndexApiUrl(endpoint, 'all')).toThrow('must use HTTPS');
      });
    expect(() => buildIndexApiUrl(
      'https://user:secret@example.vercel.app/api/index-history',
      'all'
    )).toThrow('must not contain embedded credentials');
  });

  it('accepts a complete partial-success response', () => {
    expect(isIndexApiResponse(validPayload, ['EUNL.DE', 'MSNA'])).toBe(true);
  });

  it('rejects missing symbols, duplicate reports, and invalid dates', () => {
    expect(isIndexApiResponse(validPayload, ['EUNL.DE', 'MSNA', 'MSDE'])).toBe(false);
    expect(isIndexApiResponse({
      series: validPayload.series,
      errors: [{ symbol: 'EUNL.DE', error: 'duplicate' }],
    }, ['EUNL.DE'])).toBe(false);
    expect(isIndexApiResponse({
      series: [{
        ...validPayload.series[0],
        points: [{ date: '2026-02-30', value: 123.45 }],
      }],
      errors: [],
    }, ['EUNL.DE'])).toBe(false);
  });

  it('rejects non-positive, implausible, duplicate, and unsorted points', () => {
    const responseWithPoints = (points: Array<{ date: string; value: number }>) => ({
      series: [{ ...validPayload.series[0], points }],
      errors: [],
    });
    const now = new Date('2026-08-16T00:00:00.000Z');

    expect(isIndexApiResponse(responseWithPoints([
      { date: '2026-08-14', value: 0 },
    ]), ['EUNL.DE'], now)).toBe(false);
    expect(isIndexApiResponse(responseWithPoints([
      { date: '2026-08-14', value: MAX_INDEX_API_POINT_VALUE + 1 },
    ]), ['EUNL.DE'], now)).toBe(false);
    expect(isIndexApiResponse(responseWithPoints([
      { date: '1899-12-31', value: 100 },
    ]), ['EUNL.DE'], now)).toBe(false);
    expect(isIndexApiResponse(responseWithPoints([
      { date: '2026-08-24', value: 100 },
    ]), ['EUNL.DE'], now)).toBe(false);
    expect(isIndexApiResponse(responseWithPoints([
      { date: '2026-08-14', value: 100 },
      { date: '2026-08-14', value: 101 },
    ]), ['EUNL.DE'], now)).toBe(false);
    expect(isIndexApiResponse(responseWithPoints([
      { date: '2026-08-15', value: 101 },
      { date: '2026-08-14', value: 100 },
    ]), ['EUNL.DE'], now)).toBe(false);
  });

  it('fetches and validates the configured endpoint', async () => {
    const fetchMock = jest.fn(async () => mockResponse(validPayload));

    await expect(fetchConfiguredIndexApi({
      endpoint: 'https://example.vercel.app/api/index-history',
      requestedSymbol: 'all',
      expectedSymbols: ['EUNL.DE', 'MSNA'],
      timeoutMs: 1000,
      fetchFn: fetchMock as unknown as typeof fetch,
    })).resolves.toEqual(validPayload);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.vercel.app/api/index-history?symbol=all',
      expect.objectContaining({ method: 'GET' })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit).not.toHaveProperty('cache');
  });

  it('rejects HTTP and schema failures so the caller can use its fallback', async () => {
    const failedFetch = jest.fn(async () => mockResponse(
      { error: 'unavailable' },
      503,
      'Service Unavailable'
    ));
    await expect(fetchConfiguredIndexApi({
      endpoint: 'https://example.vercel.app/api/index-history',
      requestedSymbol: 'all',
      expectedSymbols: ['EUNL.DE'],
      timeoutMs: 1000,
      fetchFn: failedFetch as unknown as typeof fetch,
    })).rejects.toThrow('HTTP 503');

    const malformedFetch = jest.fn(async () => mockResponse({ series: [] }));
    await expect(fetchConfiguredIndexApi({
      endpoint: 'https://example.vercel.app/api/index-history',
      requestedSymbol: 'all',
      expectedSymbols: ['EUNL.DE'],
      timeoutMs: 1000,
      fetchFn: malformedFetch as unknown as typeof fetch,
    })).rejects.toThrow('Invalid data format');
  });

  it('rejects a configured API response before parsing when it is too large', async () => {
    const oversizedFetch = jest.fn(async () => mockResponse(
      validPayload,
      200,
      'OK',
      String(MAX_INDEX_API_RESPONSE_BYTES + 1)
    ));

    await expect(fetchConfiguredIndexApi({
      endpoint: 'https://example.vercel.app/api/index-history',
      requestedSymbol: 'all',
      expectedSymbols: ['EUNL.DE', 'MSNA'],
      timeoutMs: 1000,
      fetchFn: oversizedFetch as unknown as typeof fetch,
    })).rejects.toThrow('response exceeds the 2 MB safety limit');
  });
});
