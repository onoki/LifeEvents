import { parseExternalJson } from '../external-api-utils';

type TimeSeriesResponse = Array<{
  series?: Array<{ date?: string; close?: number }>;
}>;

const isTimeSeriesResponse = (data: unknown): data is TimeSeriesResponse => (
  Array.isArray(data)
  && data.some((item) => (
    item !== null
    && typeof item === 'object'
    && Array.isArray((item as { series?: unknown }).series)
  ))
);

describe('parseExternalJson', () => {
  const validPayload: TimeSeriesResponse = [{
    series: [{ date: '2026-01-31', close: 123.45 }],
  }];

  it('parses a response matching the expected schema', () => {
    expect(parseExternalJson(
      JSON.stringify(validPayload),
      'invalid',
      isTimeSeriesResponse
    )).toEqual(validPayload);
  });

  it('unwraps a JSON string from a valid proxy envelope', () => {
    const proxyEnvelope = JSON.stringify({
      contents: JSON.stringify(validPayload),
      status: { http_code: 200 },
    });

    expect(parseExternalJson(
      proxyEnvelope,
      'invalid',
      isTimeSeriesResponse
    )).toEqual(validPayload);
  });

  it('unwraps an already parsed payload from a data envelope', () => {
    expect(parseExternalJson(
      JSON.stringify({ data: validPayload }),
      'invalid',
      isTimeSeriesResponse
    )).toEqual(validPayload);
  });

  it('handles an XSSI guard before validating the payload', () => {
    expect(parseExternalJson(
      `)]}'\n${JSON.stringify(validPayload)}`,
      'invalid',
      isTimeSeriesResponse
    )).toEqual(validPayload);
  });

  it('rejects syntactically valid JSON with the wrong schema', () => {
    expect(() => parseExternalJson(
      JSON.stringify({ error: 'authorization header was not forwarded' }),
      'invalid',
      isTimeSeriesResponse
    )).toThrow('invalid');
  });
});
