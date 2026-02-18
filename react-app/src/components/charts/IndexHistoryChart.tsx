import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import type { IndexHistoryChartProps, Event } from '../../types';
import { APP_CONFIG } from '../../config/app-config';
import { ChartLegend } from './ChartLegend';

type ChartRow = {
  date: Date;
  dateFormatted: string;
  [key: string]: string | number | Date | null | undefined;
};

interface IndexFieldConfig {
  symbol: string;
  shortLabel: string;
  displayName: string;
  color: string;
  sourceUrl: string;
  valueKey: string;
  trendKey: string;
  upperKey: string;
  lowerKey: string;
  multiplierKey: string;
}

const toDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toFieldPrefix = (symbol: string): string => symbol.replace(/[^a-zA-Z0-9]/g, '_');

const formatValue = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const getStocksRange = (stocksData: Event[], viewMode: IndexHistoryChartProps['viewMode']): { min: Date; max: Date } | null => {
  if (!stocksData || stocksData.length === 0) return null;
  const stocksWithData = stocksData.filter((item) => item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0);
  if (stocksWithData.length === 0) return null;

  const minDate = new Date(Math.min(...stocksWithData.map((item) => item.date.getTime())));
  const maxDate = new Date(Math.max(...stocksWithData.map((item) => item.date.getTime())));

  const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  let maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

  if (viewMode === 'next2years' || viewMode === 'next5years') {
    const yearsToAdd = viewMode === 'next5years' ? 5 : 2;
    maxMonth = new Date(maxDate.getFullYear() + yearsToAdd, maxDate.getMonth() + 2, 0);
  }

  return { min: minMonth, max: maxMonth };
};

export function IndexHistoryChart({
  title,
  indexDataBySymbol,
  indexTrendStatsBySymbol,
  onFetchIndexData,
  loading,
  showOnlyDataWithStocks,
  stocksData,
  viewMode,
  indexError,
}: IndexHistoryChartProps): React.JSX.Element {
  const seriesConfigs = React.useMemo((): IndexFieldConfig[] => {
    return APP_CONFIG.API.INDEX_SERIES.map((series): IndexFieldConfig => {
      const prefix = toFieldPrefix(series.symbol);
      return {
        symbol: series.symbol,
        shortLabel: series.shortLabel,
        displayName: series.displayName,
        color: series.color,
        sourceUrl: series.sourceUrl,
        valueKey: `${prefix}_value`,
        trendKey: `${prefix}_trend`,
        upperKey: `${prefix}_upper`,
        lowerKey: `${prefix}_lower`,
        multiplierKey: `${prefix}_multiplier`,
      };
    });
  }, []);

  const filteredDataBySymbol = React.useMemo(() => {
    const range = showOnlyDataWithStocks ? getStocksRange(stocksData, viewMode) : null;
    const result: Record<string, typeof indexDataBySymbol[string]> = {};

    for (const config of APP_CONFIG.API.INDEX_SERIES) {
      const rawSeries = indexDataBySymbol[config.symbol] ?? [];
      if (!range) {
        result[config.symbol] = rawSeries;
        continue;
      }

      result[config.symbol] = rawSeries.filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= range.min && itemDate <= range.max;
      });
    }

    return result;
  }, [indexDataBySymbol, showOnlyDataWithStocks, stocksData, viewMode]);

  const chartData = React.useMemo((): ChartRow[] => {
    const rowsByDate = new Map<string, ChartRow>();

    for (const config of seriesConfigs) {
      const points = filteredDataBySymbol[config.symbol] ?? [];
      points.forEach((point) => {
        const date = new Date(point.date);
        const dateKey = toDateKey(date);
        const existing = rowsByDate.get(dateKey) ?? {
          date,
          dateFormatted: date.toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_WITH_DAY),
        };
        existing[config.valueKey] = point.value;
        existing[config.trendKey] = point.trend ?? null;
        existing[config.upperKey] = point.trendUpperBound ?? null;
        existing[config.lowerKey] = point.trendLowerBound ?? null;
        existing[config.multiplierKey] = point.multiplier ?? null;
        rowsByDate.set(dateKey, existing);
      });
    }

    return Array.from(rowsByDate.values()).sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
  }, [filteredDataBySymbol, seriesConfigs]);

  const hasData = chartData.length > 0;

  const yAxisDomain = React.useMemo((): [number, number] => {
    if (!hasData) return [0, 0];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    chartData.forEach((row) => {
      seriesConfigs.forEach((config) => {
        const values = [
          row[config.valueKey],
          row[config.trendKey],
          row[config.upperKey],
          row[config.lowerKey],
        ];
        values.forEach((value) => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        });
      });
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0];
    const padding = Math.max((max - min) * 0.05, 1);
    return [Math.max(0, min - padding), max + padding];
  }, [chartData, hasData, seriesConfigs]);

  const latestMetrics = React.useMemo(() => {
    return seriesConfigs
      .map((config) => {
        const points = filteredDataBySymbol[config.symbol] ?? [];
        if (points.length === 0) return null;
        const latestPoint = points.reduce((latest, point) => (point.date > latest.date ? point : latest), points[0]);
        const value = latestPoint.value ?? null;
        const trend = latestPoint.trend ?? null;
        const trendLowerBound = latestPoint.trendLowerBound ?? null;
        const sigmaAbs = trend !== null && trendLowerBound !== null ? trend - trendLowerBound : null;
        const diffPct = value !== null && trend !== null && trend !== 0 ? ((value - trend) / trend) * 100 : null;
        const sigmasFromTrend = value !== null && trend !== null && sigmaAbs !== null && sigmaAbs !== 0
          ? (value - trend) / sigmaAbs
          : null;
        return {
          config,
          trendStats: indexTrendStatsBySymbol[config.symbol] ?? null,
          diffPct,
          sigmasFromTrend,
          multiplier: latestPoint.multiplier ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [filteredDataBySymbol, indexTrendStatsBySymbol, seriesConfigs]);

  const legendItems = React.useMemo(() => {
    return [
      ...seriesConfigs.map((config) => ({
        label: `${config.shortLabel} value`,
        description: config.displayName,
        color: config.color,
        variant: 'line' as const,
      })),
      {
        label: 'Trend / ±1σ',
        description: 'Dashed lines show trend and one standard deviation band per index.',
        variant: 'note' as const,
      },
      {
        label: 'Multiplier',
        description: 'Multiplier = trend ÷ observed index value.',
        variant: 'note' as const,
      },
    ];
  }, [seriesConfigs]);

  const openUrl = (url: string): void => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const yahooSeries = APP_CONFIG.API.INDEX_SERIES.filter((series) => series.source === 'yahoo');
  const morningstarSeries = APP_CONFIG.API.INDEX_SERIES.filter((series) => series.source === 'morningstar');

  if (!hasData) {
    return (
      <div className="bg-card border border-gray-600 rounded-lg p-2 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {onFetchIndexData && (
              <button
                onClick={onFetchIndexData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Fetching...' : 'Fetch index data'}
              </button>
            )}
            {yahooSeries.map((series) => (
              <button
                key={series.symbol}
                onClick={() => openUrl(series.sourceUrl)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                View {series.shortLabel} on Yahoo Finance
              </button>
            ))}
            {morningstarSeries.map((series) => (
              <button
                key={series.symbol}
                onClick={() => openUrl(series.sourceUrl)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
              >
                View {series.shortLabel} on Morningstar
              </button>
            ))}
          </div>
        </div>
        {indexError && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {indexError}
          </div>
        )}
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          <div className="text-center">
            <p>No index data loaded</p>
            <p className="text-sm">Click "Fetch index data" to load historical data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-gray-600 rounded-lg p-2 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {onFetchIndexData && (
            <button
              onClick={onFetchIndexData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Fetching...' : 'Fetch index data'}
            </button>
          )}
          {yahooSeries.map((series) => (
            <button
              key={series.symbol}
              onClick={() => openUrl(series.sourceUrl)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              View {series.shortLabel} on Yahoo Finance
            </button>
          ))}
          {morningstarSeries.map((series) => (
            <button
              key={series.symbol}
              onClick={() => openUrl(series.sourceUrl)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
            >
              View {series.shortLabel} on Morningstar
            </button>
          ))}
        </div>
      </div>

      {indexError && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {indexError}
        </div>
      )}

      <ResponsiveContainer width="100%" height={APP_CONFIG.UI.CHART_HEIGHT}>
        <ComposedChart data={chartData} margin={{ left: -10, right: -10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => formatValue(value)}
            domain={yAxisDomain}
            orientation="right"
            width={72}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))',
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const row = payload[0]?.payload as ChartRow;
              return (
                <div className="rounded-lg border bg-popover p-3 shadow-md">
                  <p className="mb-2 font-medium">{`Date: ${label}`}</p>
                  <div className="space-y-2">
                    {seriesConfigs.map((config) => {
                      const value = row[config.valueKey];
                      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
                      const trend = row[config.trendKey];
                      const upper = row[config.upperKey];
                      const lower = row[config.lowerKey];
                      const multiplier = row[config.multiplierKey];
                      return (
                        <div key={`tooltip-${config.symbol}`} className="rounded border border-border/50 p-2">
                          <div className="font-semibold" style={{ color: config.color }}>{config.shortLabel}</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                            <span className="text-muted-foreground">Value:</span>
                            <span className="text-right">{formatValue(value)}</span>
                            <span className="text-muted-foreground">Trend:</span>
                            <span className="text-right">{typeof trend === 'number' ? formatValue(trend) : 'N/A'}</span>
                            <span className="text-muted-foreground">+1σ / -1σ:</span>
                            <span className="text-right">
                              {typeof upper === 'number' && typeof lower === 'number'
                                ? `${formatValue(upper)} / ${formatValue(lower)}`
                                : 'N/A'}
                            </span>
                            <span className="text-muted-foreground">Multiplier:</span>
                            <span className="text-right">
                              {typeof multiplier === 'number' && Number.isFinite(multiplier) ? `${multiplier.toFixed(3)}x` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          />

          {seriesConfigs.map((config) => (
            <React.Fragment key={`series-${config.symbol}`}>
              <Line
                type="monotone"
                dataKey={config.valueKey}
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: config.color }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey={config.trendKey}
                stroke={config.color}
                strokeWidth={1.75}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                strokeOpacity={0.95}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey={config.upperKey}
                stroke={config.color}
                strokeWidth={1}
                strokeDasharray="2 4"
                dot={false}
                activeDot={false}
                strokeOpacity={0.4}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey={config.lowerKey}
                stroke={config.color}
                strokeWidth={1}
                strokeDasharray="2 4"
                dot={false}
                activeDot={false}
                strokeOpacity={0.4}
                connectNulls={false}
              />
            </React.Fragment>
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <ChartLegend items={legendItems} />

      {latestMetrics.length > 0 && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-2 text-sm text-muted-foreground">
          {latestMetrics.map(({ config, trendStats, diffPct, sigmasFromTrend, multiplier }) => (
            <div key={`metrics-${config.symbol}`} className="rounded border border-border/50 px-3 py-2">
              <div className="font-semibold" style={{ color: config.color }}>
                {config.shortLabel}
              </div>
              <div>
                Trend:{' '}
                <span className="font-semibold text-foreground">
                  {trendStats ? `${(trendStats.annualGrowthRate * 100).toFixed(1)} %` : 'N/A'}
                </span>{' '}
                (
                <span className="font-semibold text-foreground">
                  {trendStats ? `±${(trendStats.standardDeviation * 100).toFixed(1)} %` : 'N/A'}
                </span>
                )
              </div>
              <div>
                Latest vs trend:{' '}
                <span className="font-semibold text-foreground">
                  {typeof diffPct === 'number' && Number.isFinite(diffPct) ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)} %` : 'N/A'}
                </span>{' '}
                (
                <span className="font-semibold text-foreground">
                  {typeof sigmasFromTrend === 'number' && Number.isFinite(sigmasFromTrend)
                    ? `${sigmasFromTrend >= 0 ? '+' : ''}${sigmasFromTrend.toFixed(2)} σ`
                    : 'N/A'}
                </span>
                )
              </div>
              <div>
                Multiplier:{' '}
                <span className="font-semibold text-foreground">
                  {typeof multiplier === 'number' && Number.isFinite(multiplier) ? `${multiplier.toFixed(3)}x` : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
