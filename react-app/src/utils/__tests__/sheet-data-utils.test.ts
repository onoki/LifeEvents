import {
  fetchTsvText,
  getSheetsUrlFromSearch,
  normalizeFetchableTsvUrl,
  validateTsvTextLimits,
  type TsvSafetyLimits,
} from '../sheet-data-utils';

const mockTextResponse = (
  text: string,
  {
    status = 200,
    statusText = 'OK',
    contentLength,
  }: {
    status?: number;
    statusText?: string;
    contentLength?: string;
  } = {}
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
  text: async () => text,
} as Response);

const makeLimits = (overrides: Partial<TsvSafetyLimits> = {}): TsvSafetyLimits => ({
  maxBytes: 1_000,
  maxRows: 10,
  maxRowCharacters: 100,
  maxFieldsPerRow: 5,
  maxFieldCharacters: 50,
  ...overrides,
});

describe('sheet data safety helpers', () => {
  it('accepts HTTPS and loopback TSV sources without double-decoding URLSearchParams values', () => {
    const sheetsParam = getSheetsUrlFromSearch(
      '?sheets=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F100%2525%2Fexport%3Fformat%3Dtsv'
    );

    expect(sheetsParam).toBe('https://docs.google.com/spreadsheets/d/100%25/export?format=tsv');
    expect(normalizeFetchableTsvUrl(sheetsParam!)).toBe(
      'https://docs.google.com/spreadsheets/d/100%25/export?format=tsv'
    );
    expect(normalizeFetchableTsvUrl('http://localhost:9000/custom.tsv#private')).toBe(
      'http://localhost:9000/custom.tsv'
    );
    expect(normalizeFetchableTsvUrl('http://127.0.0.1:9000/custom.tsv')).toBe(
      'http://127.0.0.1:9000/custom.tsv'
    );
    expect(normalizeFetchableTsvUrl('http://[::1]:9000/custom.tsv')).toBe(
      'http://[::1]:9000/custom.tsv'
    );
    expect(() => getSheetsUrlFromSearch('?sheets=https://example.com/100%')).not.toThrow();
  });

  it('rejects non-network URLs and embedded credentials', () => {
    ['javascript:alert(1)', 'data:text/plain,date%09stocks_in_eur', 'file:///tmp/data.tsv']
      .forEach((url) => {
        expect(() => normalizeFetchableTsvUrl(url)).toThrow('http:// or https://');
      });
    expect(() => normalizeFetchableTsvUrl('https://user:secret@example.com/data.tsv'))
      .toThrow('must not contain embedded credentials');
    expect(() => normalizeFetchableTsvUrl('not a URL')).toThrow('http:// or https://');
  });

  it('requires HTTPS outside exact loopback hosts', () => {
    [
      'http://example.com/data.tsv',
      'http://192.168.1.10/data.tsv',
      'http://localhost.example.com/data.tsv',
    ].forEach((url) => {
      expect(() => normalizeFetchableTsvUrl(url))
        .toThrow('must use HTTPS outside local development');
    });
  });

  it('fetches a valid bounded TSV response without disabling intermediary caches', async () => {
    const responseText = 'date\tstocks_in_eur\n2026-08-01\t1000';
    const fetchMock = jest.fn(async () => mockTextResponse(responseText));

    await expect(fetchTsvText('https://example.com/data.tsv#ignored', {
      fetchFn: fetchMock as unknown as typeof fetch,
      timeoutMs: 1_000,
    })).resolves.toBe(responseText);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/data.tsv',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit).not.toHaveProperty('cache');
  });

  it('rejects oversized responses from both headers and streamed bytes', async () => {
    const headerFetch = jest.fn(async () => mockTextResponse('small', { contentLength: '10' }));
    await expect(fetchTsvText('https://example.com/data.tsv', {
      fetchFn: headerFetch as unknown as typeof fetch,
      limits: { maxBytes: 5 },
    })).rejects.toThrow('larger than the supported');

    const reader = {
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('too large') }),
      cancel: jest.fn(async () => undefined),
      releaseLock: jest.fn(),
    };
    const streamedResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      body: { getReader: () => reader },
    } as unknown as Response;
    const streamFetch = jest.fn(async () => streamedResponse);

    await expect(fetchTsvText('https://example.com/data.tsv', {
      fetchFn: streamFetch as unknown as typeof fetch,
      limits: { maxBytes: 5 },
    })).rejects.toThrow('larger than the supported');
    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  it('times out stalled requests with a user-facing error', async () => {
    const stalledFetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      })
    ));

    await expect(fetchTsvText('https://example.com/data.tsv', {
      fetchFn: stalledFetch as typeof fetch,
      timeoutMs: 5,
    })).rejects.toThrow('timed out after 0.005 seconds');
  });

  it('bounds TSV rows, row length, field count, and field length', () => {
    expect(() => validateTsvTextLimits('a\nb\nc', makeLimits({ maxRows: 2 })))
      .toThrow('more than 2 rows');
    expect(() => validateTsvTextLimits('abcdef', makeLimits({ maxRowCharacters: 5 })))
      .toThrow('row exceeds');
    expect(() => validateTsvTextLimits('a\tb\tc', makeLimits({ maxFieldsPerRow: 2 })))
      .toThrow('more than 2 fields');
    expect(() => validateTsvTextLimits('abcdef', makeLimits({ maxFieldCharacters: 5 })))
      .toThrow('field exceeds');
  });

  it('preserves HTTP errors without exposing response bodies', async () => {
    const failedFetch = jest.fn(async () => mockTextResponse('private upstream details', {
      status: 503,
      statusText: 'Service Unavailable',
    }));

    await expect(fetchTsvText('https://example.com/data.tsv', {
      fetchFn: failedFetch as unknown as typeof fetch,
    })).rejects.toThrow('HTTP 503: Service Unavailable');
  });
});
