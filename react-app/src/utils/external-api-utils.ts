export type JsonPayloadValidator<T> = (data: unknown) => data is T;

const stripXssiGuard = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.startsWith(")]}'")
    ? trimmed.replace(/^\)\]\}'\s*/, '')
    : trimmed;
};

/**
 * Parse an external JSON response and, when necessary, unwrap the string/object
 * envelopes commonly returned by public CORS proxies.
 *
 * A validator is important here: an error envelope is valid JSON too. Without
 * checking the expected schema, callers can accept the envelope and stop trying
 * healthier fallback sources.
 */
export const parseExternalJson = <T>(
  raw: string,
  invalidDataMessage: string,
  validate?: JsonPayloadValidator<T>
): T => {
  const normalized = stripXssiGuard(raw);
  if (!normalized) {
    throw new Error(invalidDataMessage);
  }

  const visited = new Set<unknown>();

  const parseCandidate = (candidate: unknown, depth: number): T | null => {
    if (depth > 3 || visited.has(candidate)) {
      return null;
    }
    visited.add(candidate);

    let parsed: unknown = candidate;
    if (typeof candidate === 'string') {
      const candidateText = stripXssiGuard(candidate);
      if (!candidateText) {
        return null;
      }

      try {
        parsed = JSON.parse(candidateText) as unknown;
      } catch {
        return null;
      }
    }

    if (!validate || validate(parsed)) {
      return parsed as T;
    }

    // allorigins-style and similar proxy responses may put the target payload
    // in either `contents` or `data`, as a JSON string or as an already parsed
    // value. Only inspect these after the outer object fails schema validation.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const envelope = parsed as Record<string, unknown>;
      for (const key of ['contents', 'data']) {
        if (envelope[key] !== undefined) {
          const unwrapped = parseCandidate(envelope[key], depth + 1);
          if (unwrapped !== null) {
            return unwrapped;
          }
        }
      }
    }

    return null;
  };

  const result = parseCandidate(normalized, 0);
  if (result === null) {
    throw new Error(invalidDataMessage);
  }

  return result;
};
