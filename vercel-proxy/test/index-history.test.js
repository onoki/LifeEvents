import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import handler from '../api/index-history.js';
import {
  ALLOWED_SYMBOLS,
  DEFAULT_ALLOWED_ORIGINS,
  extractMorningstarToken,
  fetchWithTimeout,
  getAllowedOrigins,
  handleIndexHistoryRequest,
} from '../api/_index-history-core.js';

const TEST_NOW = new Date('2026-08-16T12:00:00.000Z');
const TOKEN_ONE = `${'a'.repeat(32)}.${'b'.repeat(32)}.${'c'.repeat(32)}`;
const TOKEN_TWO = `${'d'.repeat(32)}.${'e'.repeat(32)}.${'f'.repeat(32)}`;
const DEFAULT_ORIGIN = 'https://onoki.github.io';

const unixSeconds = (isoDate) => Math.floor(new Date(isoDate).getTime() / 1000);

const createYahooPayload = (datedValues) => ({
  chart: {
    result: [{
      meta: { gmtoffset: 0 },
      timestamp: datedValues.map(([date]) => unixSeconds(date)),
      indicators: {
        quote: [{
          close: datedValues.map(([, value]) => value),
        }],
      },
    }],
  },
});

const createMockUpstreams = ({
  failedMorningstarKeys = new Set(),
  failMorningstarAuth = false,
  failYahooMonthly = false,
  failYahooDaily = false,
  refreshMorningstarToken = false,
  invalidMorningstarKeys = new Set(),
} = {}) => {
  const calls = [];
  let authCallCount = 0;

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    calls.push({ url, headers, signal: init.signal });

    if (url.hostname === 'indexes.morningstar.com') {
      authCallCount += 1;
      if (failMorningstarAuth) {
        return new Response('unavailable', { status: 503 });
      }
      const token = authCallCount === 1 ? TOKEN_ONE : TOKEN_TWO;
      return new Response(`<script>{"tokenMaaS":"${token}"}</script>`);
    }

    if (url.hostname === 'query1.finance.yahoo.com') {
      const interval = url.searchParams.get('interval');
      if (interval === '1mo') {
        if (failYahooMonthly) {
          return new Response('unavailable', { status: 503 });
        }
        return Response.json(createYahooPayload([
          ['2026-01-01T00:00:00.000Z', 100],
          ['2026-08-01T00:00:00.000Z', 200],
        ]));
      }

      if (failYahooDaily) {
        return new Response('unavailable', { status: 503 });
      }
      return Response.json(createYahooPayload([
        ['2026-08-03T00:00:00.000Z', 201],
        ['2026-08-14T00:00:00.000Z', 210],
        ['2026-08-16T00:00:00.000Z', 999],
      ]));
    }

    if (url.hostname === 'www.us-api.morningstar.com') {
      const queryKey = url.searchParams.get('query')?.split(':')[0];
      if (refreshMorningstarToken && headers.get('Authorization') === `Bearer ${TOKEN_ONE}`) {
        return new Response('expired', { status: 401 });
      }
      if (queryKey && failedMorningstarKeys.has(queryKey)) {
        return new Response('unavailable', { status: 503 });
      }
      if (queryKey && invalidMorningstarKeys.has(queryKey)) {
        return Response.json({ unexpected: true });
      }
      return Response.json([{
        queryKey,
        series: [
          { date: '2025-12-31T00:00:00.000Z', close: 1000 },
          { date: '2026-07-31T00:00:00.000Z', close: 1100 },
        ],
      }]);
    }

    throw new Error(`Unexpected upstream request: ${url}`);
  };

  return {
    calls,
    fetchImpl,
    getAuthCallCount: () => authCallCount,
  };
};

const requestProxy = async (
  query,
  {
    method = 'GET',
    origin = DEFAULT_ORIGIN,
    fetchImpl,
    env,
    allowedOrigins,
    requestHeaders,
    signal,
    timeoutMs,
    maxBodyBytes,
    maxPoints,
  } = {}
) => {
  const headers = new Headers(requestHeaders);
  if (origin) {
    headers.set('Origin', origin);
  }
  const request = new Request(`https://proxy.example/api/index-history${query}`, {
    method,
    headers,
    signal,
  });
  return handleIndexHistoryRequest(request, {
    allowedOrigins,
    createRequestId: () => 'test-request-id',
    env,
    fetchImpl,
    now: TEST_NOW,
    timeoutMs,
    maxBodyBytes,
    maxPoints,
  });
};

const readJson = async (response) => response.json();

const withoutConsoleErrors = async (callback) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.error = originalConsoleError;
  }
};

test('exports a Web-standard Vercel fetch handler', () => {
  assert.equal(typeof handler.fetch, 'function');
});

test('enables Vercel request cancellation for the function', async () => {
  const vercelConfig = JSON.parse(await readFile(
    new URL('../vercel.json', import.meta.url),
    'utf8'
  ));
  assert.equal(vercelConfig.functions['api/index-history.js'].supportsCancellation, true);
});

test('exposes only the closed set of supported symbols', () => {
  assert.deepEqual(ALLOWED_SYMBOLS, ['all', 'EUNL.DE', 'MSNA', 'MSDE', 'MSDA']);
});

test('loads all indexes, shares one Morningstar token, and normalizes points', async () => {
  const upstreams = createMockUpstreams();
  const response = await requestProxy('?symbol=all', { fetchImpl: upstreams.fetchImpl });
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), DEFAULT_ORIGIN);
  assert.match(response.headers.get('Cache-Control'), /s-maxage=3600/);
  assert.deepEqual(body.errors, []);
  assert.deepEqual(body.series.map(({ symbol }) => symbol), ['EUNL.DE', 'MSNA', 'MSDE', 'MSDA']);
  assert.deepEqual(body.series[0], {
    symbol: 'EUNL.DE',
    source: 'yahoo',
    points: [
      { date: '2026-01-01', value: 100 },
      { date: '2026-08-03', value: 201 },
      { date: '2026-08-14', value: 210 },
    ],
  });
  assert.equal(upstreams.getAuthCallCount(), 1);

  const morningstarCalls = upstreams.calls.filter(({ url }) => url.hostname === 'www.us-api.morningstar.com');
  assert.equal(morningstarCalls.length, 3);
  morningstarCalls.forEach(({ headers }) => {
    assert.equal(headers.get('Authorization'), `Bearer ${TOKEN_ONE}`);
    assert.equal(headers.get('X-Api-RequestId'), 'test-request-id');
  });
  assert.equal(JSON.stringify(body).includes(TOKEN_ONE), false);
});

test('returns partial all-symbol results and disables caching when one upstream fails', async () => {
  const upstreams = createMockUpstreams({
    failedMorningstarKeys: new Set(['F00001QK2I']),
  });
  const response = await withoutConsoleErrors(() => requestProxy('?symbol=all', {
    fetchImpl: upstreams.fetchImpl,
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(body.series.map(({ symbol }) => symbol), ['EUNL.DE', 'MSNA', 'MSDA']);
  assert.deepEqual(body.errors, [{
    symbol: 'MSDE',
    error: 'Unable to load MSDE from morningstar.',
  }]);
});

test('returns 502 and no-store when a requested series cannot be loaded', async () => {
  const upstreams = createMockUpstreams({ failMorningstarAuth: true });
  const response = await withoutConsoleErrors(() => requestProxy('?symbol=MSNA', {
    fetchImpl: upstreams.fetchImpl,
  }));
  const body = await readJson(response);

  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(body.series, []);
  assert.deepEqual(body.errors, [{
    symbol: 'MSNA',
    error: 'Unable to load MSNA from morningstar.',
  }]);
});

test('rejects missing, unknown, extra, and duplicate query parameters without upstream calls', async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error('must not fetch');
  };
  const queries = [
    '',
    '?symbol=UNKNOWN',
    '?symbol=all&url=https%3A%2F%2Fevil.example',
    '?symbol=MSNA&symbol=MSDE',
    '?url=https%3A%2F%2Fquery1.finance.yahoo.com',
    '?symbol=all&header=Authorization',
    '?symbol=all&queryKey=F00001QK3I',
  ];

  for (const query of queries) {
    const response = await requestProxy(query, { fetchImpl });
    const body = await readJson(response);
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get('Cache-Control'), 'no-store', query);
    assert.deepEqual(body.series, [], query);
    assert.equal(body.errors.length, 1, query);
  }
  assert.equal(fetchCount, 0);
});

test('rejects inbound headers that deliberately bypass Vercel CDN caching', async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error('must not fetch');
  };

  for (const requestHeaders of [
    { Authorization: 'Bearer attacker-controlled' },
    { Range: 'bytes=0-10' },
  ]) {
    const response = await requestProxy('?symbol=all', { fetchImpl, requestHeaders });
    const body = await readJson(response);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(body.errors[0].error, 'Request contains an unsupported header.');
  }
  assert.equal(fetchCount, 0);
});

test('accepts OPTIONS without a symbol and never contacts an upstream', async () => {
  let fetchCount = 0;
  const response = await requestProxy('', {
    method: 'OPTIONS',
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error('must not fetch');
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), DEFAULT_ORIGIN);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
  assert.equal(await response.text(), '');
  assert.equal(fetchCount, 0);
});

test('rejects methods other than GET and OPTIONS', async () => {
  const response = await requestProxy('?symbol=all', { method: 'POST' });
  const body = await readJson(response);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, OPTIONS');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.errors[0].error, 'Method not allowed.');
});

test('rejects non-allowlisted browser origins before contacting upstreams', async () => {
  let fetchCount = 0;
  const response = await requestProxy('?symbol=all', {
    origin: 'https://evil.example',
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error('must not fetch');
    },
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(fetchCount, 0);
});

test('allows requests without an Origin header and supports exact additional origins', async () => {
  const upstreams = createMockUpstreams();
  const noOriginResponse = await requestProxy('?symbol=EUNL.DE', {
    origin: null,
    fetchImpl: upstreams.fetchImpl,
  });
  assert.equal(noOriginResponse.status, 200);
  assert.equal(noOriginResponse.headers.get('Access-Control-Allow-Origin'), null);

  const additionalOriginResponse = await requestProxy('?symbol=EUNL.DE', {
    origin: 'https://dashboard.example',
    env: { ALLOWED_ORIGINS: 'https://dashboard.example,*,https://invalid.example/path' },
    fetchImpl: upstreams.fetchImpl,
  });
  assert.equal(additionalOriginResponse.status, 200);
  assert.equal(additionalOriginResponse.headers.get('Access-Control-Allow-Origin'), 'https://dashboard.example');

  const origins = getAllowedOrigins({
    ALLOWED_ORIGINS: 'https://dashboard.example,*,https://invalid.example/path',
  });
  DEFAULT_ALLOWED_ORIGINS.forEach((origin) => assert.equal(origins.has(origin), true));
  assert.equal(origins.has('https://dashboard.example'), true);
  assert.equal(origins.has('*'), false);
  assert.equal(origins.has('https://invalid.example/path'), false);
});

test('keeps Yahoo monthly data when every latest-daily request fails', async () => {
  const upstreams = createMockUpstreams({ failYahooDaily: true });
  const response = await requestProxy('?symbol=EUNL.DE', { fetchImpl: upstreams.fetchImpl });
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.errors, []);
  assert.deepEqual(body.series[0].points, [
    { date: '2026-01-01', value: 100 },
    { date: '2026-08-01', value: 200 },
  ]);
  const dailyCalls = upstreams.calls.filter(({ url }) => (
    url.hostname === 'query1.finance.yahoo.com' && url.searchParams.get('interval') === '1d'
  ));
  assert.equal(dailyCalls.length, 3);
});

test('refreshes an expired Morningstar token once and retries the affected request', async () => {
  const upstreams = createMockUpstreams({ refreshMorningstarToken: true });
  const response = await requestProxy('?symbol=MSDE', { fetchImpl: upstreams.fetchImpl });
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.errors, []);
  assert.equal(upstreams.getAuthCallCount(), 2);
  const dataCalls = upstreams.calls.filter(({ url }) => url.hostname === 'www.us-api.morningstar.com');
  assert.equal(dataCalls.length, 2);
  assert.equal(dataCalls[0].headers.get('Authorization'), `Bearer ${TOKEN_ONE}`);
  assert.equal(dataCalls[1].headers.get('Authorization'), `Bearer ${TOKEN_TWO}`);
  assert.equal(JSON.stringify(body).includes(TOKEN_ONE), false);
  assert.equal(JSON.stringify(body).includes(TOKEN_TWO), false);
});

test('treats a schema-invalid upstream response as an uncached failure', async () => {
  const upstreams = createMockUpstreams({
    invalidMorningstarKeys: new Set(['F00001QK46']),
  });
  const response = await withoutConsoleErrors(() => requestProxy('?symbol=MSDA', {
    fetchImpl: upstreams.fetchImpl,
  }));
  const body = await readJson(response);

  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(body.series, []);
  assert.equal(body.errors[0].symbol, 'MSDA');
});

test('requires an exact Morningstar query key match', async () => {
  const upstreams = createMockUpstreams();
  const fetchImpl = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'www.us-api.morningstar.com') {
      return Response.json([{
        queryKey: 'WRONG_QUERY_KEY',
        series: [{ date: '2026-07-31T00:00:00.000Z', close: 1100 }],
      }]);
    }
    return upstreams.fetchImpl(input, init);
  };
  const response = await withoutConsoleErrors(() => requestProxy('?symbol=MSNA', { fetchImpl }));
  const body = await readJson(response);

  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(body.series, []);
  assert.equal(body.errors[0].symbol, 'MSNA');
});

test('returns only positive values with plausible historical dates', async () => {
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get('interval') === '1mo') {
      return Response.json(createYahooPayload([
        ['1899-12-01T00:00:00.000Z', 90],
        ['2026-01-01T00:00:00.000Z', -10],
        ['2026-02-01T00:00:00.000Z', 100],
        ['2100-01-01T00:00:00.000Z', 200],
      ]));
    }
    return new Response('daily unavailable', { status: 503 });
  };
  const response = await requestProxy('?symbol=EUNL.DE', { fetchImpl });
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.errors, []);
  assert.deepEqual(body.series[0].points, [
    { date: '2026-02-01', value: 100 },
  ]);
});

test('rejects upstream point arrays above the configured bound', async () => {
  const upstreams = createMockUpstreams();
  const response = await withoutConsoleErrors(() => requestProxy('?symbol=EUNL.DE', {
    fetchImpl: upstreams.fetchImpl,
    maxPoints: 1,
  }));
  const body = await readJson(response);

  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(body.series, []);
});

test('extracts Morningstar tokens from escaped and HTML-encoded payloads', () => {
  assert.equal(extractMorningstarToken(`\\"accessToken\\":\\"${TOKEN_ONE}\\"`), TOKEN_ONE);
  assert.equal(extractMorningstarToken(`&quot;tokenMaaS&quot;:&quot;${TOKEN_TWO}&quot;`), TOKEN_TWO);
  assert.equal(extractMorningstarToken('<html>no token</html>'), null);
});

test('follows only bounded same-host HTTPS redirects', async () => {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    if (url.pathname === '/start') {
      return new Response(null, {
        status: 302,
        headers: { Location: '/final' },
      });
    }
    return new Response('allowed response');
  };
  const result = await fetchWithTimeout('https://query1.finance.yahoo.com/start', {}, {
    fetchImpl,
  });

  assert.equal(result.rawText, 'allowed response');
  assert.deepEqual(calls, [
    'https://query1.finance.yahoo.com/start',
    'https://query1.finance.yahoo.com/final',
  ]);
});

test('rejects cross-host, non-HTTPS, and excessive upstream redirects', async () => {
  let unallowlistedFetchCount = 0;
  await assert.rejects(
    fetchWithTimeout('https://evil.example/direct', {}, {
      fetchImpl: async () => {
        unallowlistedFetchCount += 1;
        return new Response('must not fetch');
      },
    }),
    /host is not allowlisted/
  );
  assert.equal(unallowlistedFetchCount, 0);

  const cases = [
    {
      location: 'https://evil.example/private',
      expectedError: /redirect target is not allowed/,
    },
    {
      location: 'http://query1.finance.yahoo.com/insecure',
      expectedError: /redirect target is not allowed/,
    },
    {
      location: 'https://user:password@query1.finance.yahoo.com/private',
      expectedError: /redirect target is not allowed/,
    },
  ];

  for (const { location, expectedError } of cases) {
    let fetchCount = 0;
    const fetchImpl = async () => {
      fetchCount += 1;
      return new Response(null, { status: 302, headers: { Location: location } });
    };
    await assert.rejects(
      fetchWithTimeout('https://query1.finance.yahoo.com/start', {}, {
        fetchImpl,
      }),
      expectedError
    );
    assert.equal(fetchCount, 1);
  }

  let redirectCount = 0;
  await assert.rejects(
    fetchWithTimeout('https://query1.finance.yahoo.com/start', {}, {
      fetchImpl: async () => {
        redirectCount += 1;
        return new Response(null, { status: 302, headers: { Location: '/again' } });
      },
    }),
    /exceeded 3 redirects/
  );
  assert.equal(redirectCount, 4);
});

test('rejects upstream bodies above the byte bound', async () => {
  await assert.rejects(
    fetchWithTimeout('https://query1.finance.yahoo.com/data', {}, {
      fetchImpl: async () => new Response('0123456789'),
      maxBodyBytes: 5,
    }),
    /exceeded 5 bytes/
  );
});

test('keeps the upstream timeout active while consuming the response body', async () => {
  const encoder = new TextEncoder();
  const fetchImpl = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('{"partial":'));
    },
  }));

  await assert.rejects(
    fetchWithTimeout('https://query1.finance.yahoo.com/slow-body', {}, {
      fetchImpl,
      timeoutMs: 5,
    }),
    /timed out after 5 ms/
  );
});

test('propagates client cancellation to in-flight upstream requests', async () => {
  const requestController = new AbortController();
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const fetchImpl = async (_url, { signal }) => {
    markStarted();
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted upstream')), { once: true });
    });
  };

  const pendingResponse = requestProxy('?symbol=EUNL.DE', {
    fetchImpl,
    signal: requestController.signal,
  });
  await started;
  requestController.abort();

  await assert.rejects(pendingResponse, /Request was cancelled/);
});

test('aborts upstream requests at the configured timeout', async () => {
  const neverCompletes = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });

  await assert.rejects(
    fetchWithTimeout('https://query1.finance.yahoo.com', {}, {
      fetchImpl: neverCompletes,
      timeoutMs: 5,
    }),
    /timed out after 5 ms/
  );
});
