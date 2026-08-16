export interface TsvSafetyLimits {
  maxBytes: number;
  maxRows: number;
  maxRowCharacters: number;
  maxFieldsPerRow: number;
  maxFieldCharacters: number;
}

interface FetchTsvTextOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  limits?: Partial<TsvSafetyLimits>;
}

export const DEFAULT_TSV_REQUEST_TIMEOUT_MS = 20_000;

export const DEFAULT_TSV_SAFETY_LIMITS: Readonly<TsvSafetyLimits> = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxRows: 50_000,
  maxRowCharacters: 128 * 1024,
  maxFieldsPerRow: 256,
  maxFieldCharacters: 64 * 1024,
});

const FETCHABLE_PROTOCOLS = new Set(['http:', 'https:']);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

const formatMegabytes = (bytes: number): string => {
  const megabytes = bytes / (1024 * 1024);
  return Number.isInteger(megabytes) ? String(megabytes) : megabytes.toFixed(1);
};

const getResponseTooLargeMessage = (maxBytes: number): string => (
  `The TSV response is larger than the supported ${formatMegabytes(maxBytes)} MB limit.`
);

const getUtf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

export const getSheetsUrlFromSearch = (search: string): string | null => (
  new URLSearchParams(search).get('sheets')
);

export const normalizeFetchableTsvUrl = (candidate: string): string => {
  const trimmed = candidate.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Please provide a valid http:// or https:// URL for TSV data.');
  }

  if (!FETCHABLE_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Please provide a valid http:// or https:// URL for TSV data.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('TSV data URLs must not contain embedded credentials.');
  }
  if (parsed.protocol === 'http:' && !LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
    throw new Error('TSV data URLs must use HTTPS outside local development.');
  }

  parsed.hash = '';
  return parsed.toString();
};

const readResponseTextWithinLimit = async (
  response: Response,
  maxBytes: number,
  controller: AbortController
): Promise<string> => {
  if (!response.body) {
    const text = await response.text();
    if (getUtf8ByteLength(text) > maxBytes) {
      throw new Error(getResponseTooLargeMessage(maxBytes));
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
      if (totalBytes > maxBytes) {
        controller.abort();
        try {
          await reader.cancel();
        } catch {
          // The abort may already have closed the stream.
        }
        throw new Error(getResponseTooLargeMessage(maxBytes));
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock();
  }
};

export const validateTsvTextLimits = (
  text: string,
  limits: Readonly<TsvSafetyLimits> = DEFAULT_TSV_SAFETY_LIMITS
): void => {
  if (getUtf8ByteLength(text) > limits.maxBytes) {
    throw new Error(getResponseTooLargeMessage(limits.maxBytes));
  }

  const rows = text.split(/\r\n|\n|\r/);
  if (rows.length > limits.maxRows) {
    throw new Error(`The TSV response contains more than ${limits.maxRows.toLocaleString('en-US')} rows.`);
  }

  for (const row of rows) {
    if (row.length > limits.maxRowCharacters) {
      throw new Error('A TSV row exceeds the supported length limit.');
    }

    const fields = row.split('\t');
    if (fields.length > limits.maxFieldsPerRow) {
      throw new Error(`A TSV row contains more than ${limits.maxFieldsPerRow} fields.`);
    }
    if (fields.some((field) => field.length > limits.maxFieldCharacters)) {
      throw new Error('A TSV field exceeds the supported length limit.');
    }
  }
};

export const fetchTsvText = async (
  candidateUrl: string,
  {
    fetchFn = fetch,
    timeoutMs = DEFAULT_TSV_REQUEST_TIMEOUT_MS,
    limits: limitOverrides,
  }: FetchTsvTextOptions = {}
): Promise<string> => {
  const url = normalizeFetchableTsvUrl(candidateUrl);
  const limits: TsvSafetyLimits = {
    ...DEFAULT_TSV_SAFETY_LIMITS,
    ...limitOverrides,
  };
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      credentials: 'omit',
      headers: {
        Accept: 'text/tab-separated-values,text/plain;q=0.9,*/*;q=0.1',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLengthHeader = response.headers.get('Content-Length');
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
    if (contentLength !== null && Number.isFinite(contentLength) && contentLength > limits.maxBytes) {
      controller.abort();
      throw new Error(getResponseTooLargeMessage(limits.maxBytes));
    }

    const text = await readResponseTextWithinLimit(response, limits.maxBytes, controller);
    validateTsvTextLimits(text, limits);
    return text;
  } catch (error) {
    if (didTimeout) {
      throw new Error(`The TSV request timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
