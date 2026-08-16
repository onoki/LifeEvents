import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import type { IndexHistoryChartProps, IndexDataPoint, TrendStats } from '../../types';
import { APP_CONFIG } from '../../config/app-config';
import { ChartLegend } from './ChartLegend';
import { getChartDateRange } from '../../utils/data-processing-utils';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { PRIVACY_DATE_MASK } from '../../utils/privacy-utils';

type ChartRow = {
  date: Date;
  dateTs: number;
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
  normalizedValueKey: string;
  normalizedTrendKey: string;
  normalizedUpperKey: string;
  normalizedLowerKey: string;
}

interface IndexBounds {
  min: number;
  max: number;
}

type SigmaZone = 'above' | 'within' | 'below' | 'unknown';

interface SigmaPosition {
  deviation: number | null;
  zone: SigmaZone;
}

interface SigmaRegimeSegment {
  startPercent: number;
  widthPercent: number;
  dateLabel: string;
  zone: SigmaZone;
  deviation: number | null;
}

const SIGMA_ZONE_PRESENTATION: Record<SigmaZone, {
  icon: string;
  label: string;
  color: string;
}> = {
  above: {
    icon: '▲',
    label: 'Above +1σ',
    color: '#fb7185',
  },
  within: {
    icon: '●',
    label: 'Within ±1σ',
    color: '#94a3b8',
  },
  below: {
    icon: '▼',
    label: 'Below −1σ',
    color: '#22d3ee',
  },
  unknown: {
    icon: '—',
    label: 'Band unavailable',
    color: '#64748b',
  },
};

const toDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateWithDayUtc = (date: Date): string => {
  return toDateKey(date);
};

const formatLabelDateShort = (label: unknown, maskExactDate = false): string => {
  if (maskExactDate) return PRIVACY_DATE_MASK;

  if (typeof label === 'number' && Number.isFinite(label)) {
    return toDateKey(new Date(label));
  }

  if (label instanceof Date && !Number.isNaN(label.getTime())) {
    return toDateKey(label);
  }

  if (typeof label === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
      return label;
    }
    const parsed = new Date(label);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateKey(parsed);
    }
    return label;
  }

  return '';
};

const getTodayStartLocal = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getTodayStartUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const toFieldPrefix = (symbol: string): string => symbol.replace(/[^a-zA-Z0-9]/g, '_');

const formatValue = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatPercent = (value: number): string => `${Math.round(value)} %`;

const normalizeValue = (value: number | null | undefined, bounds: IndexBounds | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || !bounds) return null;
  if (bounds.max === bounds.min) return 50;
  const normalized = ((value - bounds.min) / (bounds.max - bounds.min)) * 100;
  if (!Number.isFinite(normalized)) return null;
  return Math.max(0, Math.min(100, normalized));
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const getSigmaPosition = (
  value: unknown,
  trend: unknown,
  standardDeviation: unknown
): SigmaPosition => {
  if (
    !isFiniteNumber(value)
    || !isFiniteNumber(trend)
    || !isFiniteNumber(standardDeviation)
    || value <= 0
    || trend <= 0
    || standardDeviation <= 0
  ) {
    return { deviation: null, zone: 'unknown' };
  }

  const deviation = Math.log(value / trend) / standardDeviation;
  if (!Number.isFinite(deviation)) {
    return { deviation: null, zone: 'unknown' };
  }

  if (deviation > 1) return { deviation, zone: 'above' };
  if (deviation < -1) return { deviation, zone: 'below' };
  return { deviation, zone: 'within' };
};

const formatSigmaDeviation = (deviation: number | null): string => {
  if (deviation === null || !Number.isFinite(deviation)) return 'N/A';
  return `${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)} σ`;
};

const getLatestTrendPoint = (points: IndexDataPoint[]): IndexDataPoint | null => {
  return points.reduce<IndexDataPoint | null>((latest, point) => {
    const pointDate = new Date(point.date);
    if (
      Number.isNaN(pointDate.getTime())
      || !isFiniteNumber(point.value)
      || point.value <= 0
      || !isFiniteNumber(point.trend)
      || point.trend <= 0
    ) {
      return latest;
    }

    if (!latest || pointDate.getTime() > new Date(latest.date).getTime()) {
      return point;
    }
    return latest;
  }, null);
};

const buildSigmaRegimeSegments = (
  points: IndexDataPoint[],
  trendStats: TrendStats | null,
  domainStart: number,
  domainEnd: number
): SigmaRegimeSegment[] => {
  if (!trendStats || !Number.isFinite(domainStart) || !Number.isFinite(domainEnd) || domainEnd <= domainStart) {
    return [];
  }

  const visiblePoints = points
    .map((point) => ({ point, date: new Date(point.date) }))
    .filter(({ point, date }) => (
      !Number.isNaN(date.getTime())
      && date.getTime() >= domainStart
      && date.getTime() <= domainEnd
      && isFiniteNumber(point.value)
      && isFiniteNumber(point.trend)
    ))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  return visiblePoints.map(({ point, date }, index) => {
    const currentTime = date.getTime();
    const previousTime = visiblePoints[index - 1]?.date.getTime() ?? null;
    const nextTime = visiblePoints[index + 1]?.date.getTime() ?? null;
    const start = previousTime === null
      ? Math.max(domainStart, currentTime - ((nextTime ?? currentTime) - currentTime) / 2)
      : (previousTime + currentTime) / 2;
    const end = nextTime === null
      ? Math.min(domainEnd, currentTime + (currentTime - (previousTime ?? currentTime)) / 2)
      : (currentTime + nextTime) / 2;
    const sigmaPosition = getSigmaPosition(
      point.value,
      point.trend,
      trendStats.standardDeviation
    );

    return {
      startPercent: ((start - domainStart) / (domainEnd - domainStart)) * 100,
      widthPercent: Math.max(0, ((end - start) / (domainEnd - domainStart)) * 100),
      dateLabel: toDateKey(date),
      zone: sigmaPosition.zone,
      deviation: sigmaPosition.deviation,
    };
  });
};

export function IndexHistoryChart({
  title,
  indexDataBySymbol,
  indexTrendStatsBySymbol,
  onFetchIndexData,
  loading,
  stocksData,
  config,
  viewMode,
  indexError,
  indexNotice,
}: IndexHistoryChartProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  const maskUserDerivedRangeDates = isPrivacyMode && viewMode !== 'full';
  const [showSourceLinks, setShowSourceLinks] = React.useState(false);
  const [visibleSymbols, setVisibleSymbols] = React.useState<Record<string, boolean>>(() => {
    const initialVisibility: Record<string, boolean> = {};
    APP_CONFIG.API.INDEX_SERIES.forEach((series) => {
      initialVisibility[series.symbol] = true;
    });
    return initialVisibility;
  });

  const toggleSymbolVisibility = (symbol: string): void => {
    setVisibleSymbols((previous) => ({
      ...previous,
      [symbol]: !previous[symbol],
    }));
  };

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
        normalizedValueKey: `${prefix}_value_norm`,
        normalizedTrendKey: `${prefix}_trend_norm`,
        normalizedUpperKey: `${prefix}_upper_norm`,
        normalizedLowerKey: `${prefix}_lower_norm`,
      };
    });
  }, []);

  const filteredDataBySymbol = React.useMemo(() => {
    const range = getChartDateRange(stocksData, config, viewMode);
    const result: Record<string, typeof indexDataBySymbol[string]> = {};

    for (const indexDefinition of APP_CONFIG.API.INDEX_SERIES) {
      const rawSeries = indexDataBySymbol[indexDefinition.symbol] ?? [];
      if (range.min === null && range.max === null) {
        result[indexDefinition.symbol] = rawSeries;
        continue;
      }

      result[indexDefinition.symbol] = rawSeries.filter((item) => {
        const itemDate = new Date(item.date);
        if (Number.isNaN(itemDate.getTime())) return false;
        if (range.min && itemDate < range.min) return false;
        if (range.max && itemDate > range.max) return false;
        return true;
      });
    }

    return result;
  }, [config, indexDataBySymbol, stocksData, viewMode]);

  const boundsBySymbol = React.useMemo((): Record<string, IndexBounds | null> => {
    const result: Record<string, IndexBounds | null> = {};

    seriesConfigs.forEach((config) => {
      const points = filteredDataBySymbol[config.symbol] ?? [];
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;

      points.forEach((point) => {
        const values = [point.value, point.trend, point.trendUpperBound, point.trendLowerBound];
        values.forEach((value) => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        });
      });

      result[config.symbol] = Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
    });

    return result;
  }, [filteredDataBySymbol, seriesConfigs]);

  const chartData = React.useMemo((): ChartRow[] => {
    const rowsByDate = new Map<string, ChartRow>();
    const todayStartLocal = getTodayStartLocal();

    for (const config of seriesConfigs) {
      const points = filteredDataBySymbol[config.symbol] ?? [];
      points.forEach((point) => {
        const date = new Date(point.date);
        if (Number.isNaN(date.getTime()) || !isFiniteNumber(point.value)) {
          return;
        }
        const dateKey = toDateKey(date);
        const existing = rowsByDate.get(dateKey) ?? {
          date,
          dateTs: date.getTime(),
          dateFormatted: formatDateWithDayUtc(date),
        };

        const bounds = boundsBySymbol[config.symbol] ?? null;

        existing[config.valueKey] = point.value;
        existing[config.trendKey] = point.trend ?? null;
        existing[config.upperKey] = point.trendUpperBound ?? null;
        existing[config.lowerKey] = point.trendLowerBound ?? null;
        existing[config.multiplierKey] = point.multiplier ?? null;

        existing[config.normalizedValueKey] = normalizeValue(point.value, bounds);
        existing[config.normalizedTrendKey] = normalizeValue(point.trend ?? null, bounds);
        existing[config.normalizedUpperKey] = normalizeValue(point.trendUpperBound ?? null, bounds);
        existing[config.normalizedLowerKey] = normalizeValue(point.trendLowerBound ?? null, bounds);

        rowsByDate.set(dateKey, existing);
      });
    }

    return Array.from(rowsByDate.values())
      .sort((a, b) => (a.dateTs as number) - (b.dateTs as number))
      .filter((row) => {
        return seriesConfigs.some((config) => isFiniteNumber(row[config.valueKey]))
          && (row.dateTs as number) < todayStartLocal.getTime();
      });
  }, [boundsBySymbol, filteredDataBySymbol, seriesConfigs]);

  const hasData = chartData.length > 0;

  const latestMetrics = React.useMemo(() => {
    return seriesConfigs
      .map((config) => {
        // Current status must describe the newest fetched market observation,
        // even when the chart viewport is cropped to an earlier user range.
        const latestPoint = getLatestTrendPoint(indexDataBySymbol[config.symbol] ?? []);
        if (!latestPoint) return null;
        const trendStats = indexTrendStatsBySymbol[config.symbol] ?? null;
        const value = latestPoint.value as number;
        const trend = latestPoint.trend as number;
        const diffPct = ((value - trend) / trend) * 100;
        const sigmaPosition = getSigmaPosition(value, trend, trendStats?.standardDeviation);

        let todayMinusOneSigmaLevel: number | null = null;
        if (
          config.symbol === APP_CONFIG.API.EUNL_SYMBOL
          && trendStats
          && trendStats.standardDeviation > 0
        ) {
          const latestPointDate = new Date(latestPoint.date);
          const todayStartUtc = getTodayStartUtc();
          if (!Number.isNaN(latestPointDate.getTime())) {
            const daysFromLatestToToday = Math.max(
              0,
              (todayStartUtc.getTime() - latestPointDate.getTime()) / (24 * 60 * 60 * 1000)
            );
            const dailyGrowthRate = trendStats.annualGrowthRate / 365;
            const projectedTodayTrend = trend * Math.exp(dailyGrowthRate * daysFromLatestToToday);
            const projectedTodayLowerBound = projectedTodayTrend * Math.exp(-trendStats.standardDeviation);

            if (Number.isFinite(projectedTodayLowerBound)) {
              todayMinusOneSigmaLevel = projectedTodayLowerBound;
            }
          }
        }

        return {
          config,
          trendStats,
          diffPct,
          sigmaPosition,
          multiplier: latestPoint.multiplier ?? null,
          latestDate: new Date(latestPoint.date),
          todayMinusOneSigmaLevel,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [indexDataBySymbol, indexTrendStatsBySymbol, seriesConfigs]);

  const todayLabel = formatDateWithDayUtc(getTodayStartUtc());

  const visibleSeriesConfigs = React.useMemo(
    () => seriesConfigs.filter((config) => visibleSymbols[config.symbol]),
    [seriesConfigs, visibleSymbols]
  );

  const sigmaRegimeRows = React.useMemo(() => {
    if (chartData.length < 2) return [];
    const domainStart = chartData[0].dateTs;
    const domainEnd = chartData[chartData.length - 1].dateTs;

    return visibleSeriesConfigs
      .map((config) => ({
        config,
        segments: buildSigmaRegimeSegments(
          filteredDataBySymbol[config.symbol] ?? [],
          indexTrendStatsBySymbol[config.symbol] ?? null,
          domainStart,
          domainEnd
        ),
      }))
      .filter((row) => row.segments.length > 0);
  }, [chartData, filteredDataBySymbol, indexTrendStatsBySymbol, visibleSeriesConfigs]);

  const legendItems = React.useMemo(() => {
    return [
      ...seriesConfigs.map((config) => ({
        label: config.shortLabel,
        description: `${config.displayName}. Solid: index value; dashed: fitted historical trend; dotted: ±1σ historical trend band.`,
        color: config.color,
        variant: 'line' as const,
      })),
      {
        label: 'Historical σ zones',
        description: '▲ above +1σ; ● within the historical trend band; ▼ below −1σ. The band describes past variation around the fitted trend, not a forecast probability.',
        variant: 'note' as const,
      },
      {
        label: 'Normalized scale (0 to 100 %)',
        description: 'Each index is scaled from its own minimum to maximum values for easier comparison.',
        variant: 'note' as const,
      },
      {
        label: 'Multiplier',
        description: 'Multiplier = trend / observed index value.',
        variant: 'note' as const,
      },
    ];
  }, [seriesConfigs]);

  const openUrl = (url: string): void => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const yahooSeries = APP_CONFIG.API.INDEX_SERIES.filter((series) => series.source === 'yahoo');
  const morningstarSeries = APP_CONFIG.API.INDEX_SERIES.filter((series) => series.source === 'morningstar');
  const visibleLatestMetrics = latestMetrics.filter(({ config }) => visibleSymbols[config.symbol]);

  const renderSourceLinksToggle = (): React.JSX.Element => {
    return (
      <button
        type="button"
        onClick={() => setShowSourceLinks((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-600 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-gray-500 hover:bg-gray-700/40"
        aria-expanded={showSourceLinks}
      >
        <span
          aria-hidden="true"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[10px]"
        >
          {showSourceLinks ? '-' : '+'}
        </span>
        {showSourceLinks ? 'Hide source links' : 'Show source links'}
      </button>
    );
  };

  const renderSourceLinksPanel = (): React.JSX.Element | null => {
    if (!showSourceLinks) {
      return null;
    }

    const sourceLinkButtonClassName = 'px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs';

    return (
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {yahooSeries.map((series) => (
          <button
            key={series.symbol}
            onClick={() => openUrl(series.sourceUrl)}
            className={sourceLinkButtonClassName}
          >
            {series.shortLabel} on Yahoo
          </button>
        ))}
        {morningstarSeries.map((series) => (
          <button
            key={series.symbol}
            onClick={() => openUrl(series.sourceUrl)}
            className={sourceLinkButtonClassName}
          >
            {series.shortLabel} on Morningstar
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border border-gray-600 rounded-lg p-2 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {onFetchIndexData && (
            <button
              type="button"
              onClick={() => onFetchIndexData()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Refreshing...' : 'Refresh indexes'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {seriesConfigs.map((config) => {
          const isVisible = Boolean(visibleSymbols[config.symbol]);
          return (
            <button
              key={`toggle-${config.symbol}`}
              type="button"
              onClick={() => toggleSymbolVisibility(config.symbol)}
              aria-pressed={isVisible}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${isVisible ? 'border-gray-500 bg-card text-foreground' : 'border-gray-700 bg-muted/40 text-muted-foreground'}`}
              title={`Toggle ${config.shortLabel}`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: config.color, opacity: isVisible ? 1 : 0.4 }}
                aria-hidden="true"
              />
              {config.shortLabel}
            </button>
          );
        })}
      </div>

      {visibleLatestMetrics.length > 0 && (
        <div
          className="mb-3 flex flex-wrap gap-1.5 text-xs"
          aria-label="Latest index sigma positions"
        >
          {visibleLatestMetrics.map(({ config, sigmaPosition, latestDate }) => {
            const presentation = SIGMA_ZONE_PRESENTATION[sigmaPosition.zone];
            const dateLabel = formatDateWithDayUtc(latestDate);
            return (
              <div
                key={`sigma-badge-${config.symbol}`}
                data-testid={`sigma-badge-${config.symbol}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-2 py-1"
                aria-label={`${config.shortLabel}: ${presentation.label}, ${formatSigmaDeviation(sigmaPosition.deviation)}, latest observation ${dateLabel}`}
                title={`Latest observation: ${dateLabel}`}
              >
                <span className="font-semibold" style={{ color: config.color }}>
                  {config.shortLabel}
                </span>
                <span aria-hidden="true" style={{ color: presentation.color }}>
                  {presentation.icon}
                </span>
                <span>{presentation.label}</span>
                <span className="font-mono text-foreground">
                  {formatSigmaDeviation(sigmaPosition.deviation)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {indexNotice && !indexError && (
        <div
          role="status"
          className="mb-3 flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/90 px-2.5 py-1.5 text-xs text-white"
        >
          <span aria-hidden="true" className="text-sm">ⓘ</span>
          <span><span className="font-semibold">Notice:</span> {indexNotice}</span>
        </div>
      )}

      {indexError && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {indexError}
        </div>
      )}

      {!hasData ? (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          <div className="text-center">
            <p>{loading ? 'Loading index data...' : 'No index data loaded'}</p>
            {!loading && <p className="text-sm">Use "Refresh indexes" to try again</p>}
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={APP_CONFIG.UI.CHART_HEIGHT}>
          <ComposedChart data={chartData} margin={{ left: -10, right: -10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="dateTs"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => formatLabelDateShort(value, maskUserDerivedRangeDates)}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(value) => formatPercent(value)}
              domain={[0, 100]}
              orientation="right"
              width={56}
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
                const labelDate = formatLabelDateShort(label, maskUserDerivedRangeDates);
                return (
                  <div className="rounded-lg border bg-popover p-3 shadow-md">
                    <p className="mb-2 font-medium">{`Date: ${labelDate}`}</p>
                    <div className="space-y-2">
                      {visibleSeriesConfigs.map((config) => {
                        const value = row[config.valueKey];
                        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
                        const trend = row[config.trendKey];
                        const upper = row[config.upperKey];
                        const lower = row[config.lowerKey];
                        const multiplier = row[config.multiplierKey];
                        const normalizedValue = row[config.normalizedValueKey];
                        const sigmaPosition = getSigmaPosition(
                          value,
                          trend,
                          indexTrendStatsBySymbol[config.symbol]?.standardDeviation
                        );
                        const sigmaPresentation = SIGMA_ZONE_PRESENTATION[sigmaPosition.zone];
                        return (
                          <div key={`tooltip-${config.symbol}`} className="rounded border border-border/50 p-2">
                            <div className="font-semibold" style={{ color: config.color }}>{config.shortLabel}</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                              <span className="text-muted-foreground">Position:</span>
                              <span className="text-right">{typeof normalizedValue === 'number' ? formatPercent(normalizedValue) : 'N/A'}</span>
                              <span className="text-muted-foreground">Value:</span>
                              <span className="text-right">{formatValue(value)}</span>
                              <span className="text-muted-foreground">Trend:</span>
                              <span className="text-right">{typeof trend === 'number' ? formatValue(trend) : 'N/A'}</span>
                              <span className="text-muted-foreground">Deviation:</span>
                              <span className="text-right">{formatSigmaDeviation(sigmaPosition.deviation)}</span>
                              <span className="text-muted-foreground">Zone:</span>
                              <span className="text-right" style={{ color: sigmaPresentation.color }}>
                                <span aria-hidden="true">{sigmaPresentation.icon} </span>
                                {sigmaPresentation.label}
                              </span>
                              <span className="text-muted-foreground">Historical band:</span>
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

            {visibleSeriesConfigs.map((config) => (
              <React.Fragment key={`series-${config.symbol}`}>
                <Line
                  type="monotone"
                  dataKey={config.normalizedValueKey}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: config.color }}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey={config.normalizedTrendKey}
                  stroke={config.color}
                  strokeWidth={1.75}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={false}
                  strokeOpacity={0.95}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey={config.normalizedUpperKey}
                  stroke={config.color}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  dot={false}
                  activeDot={false}
                  strokeOpacity={0.4}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey={config.normalizedLowerKey}
                  stroke={config.color}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  dot={false}
                  activeDot={false}
                  strokeOpacity={0.4}
                  connectNulls={true}
                />
              </React.Fragment>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {sigmaRegimeRows.length > 0 && (
        <div
          className="mt-2 rounded border border-border/50 bg-card/40 px-2 py-1.5"
          aria-label="Historical sigma zones"
          data-testid="sigma-regime-strip"
        >
          <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Historical σ zones</span>
            <span className="flex flex-wrap gap-x-2">
              <span><span aria-hidden="true" style={{ color: SIGMA_ZONE_PRESENTATION.above.color }}>▲</span> above +1σ</span>
              <span><span aria-hidden="true" style={{ color: SIGMA_ZONE_PRESENTATION.within.color }}>●</span> within</span>
              <span><span aria-hidden="true" style={{ color: SIGMA_ZONE_PRESENTATION.below.color }}>▼</span> below −1σ</span>
            </span>
          </div>
          <div className="space-y-1">
            {sigmaRegimeRows.map(({ config, segments }) => (
              <div key={`sigma-regime-${config.symbol}`} className="flex items-center">
                <svg
                  className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-slate-700/20"
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${config.shortLabel} historical sigma zones`}
                  data-testid={`sigma-regime-${config.symbol}`}
                >
                  {segments.map((segment, index) => {
                    const presentation = SIGMA_ZONE_PRESENTATION[segment.zone];
                    const segmentEnd = segment.startPercent + segment.widthPercent;
                    return (
                      <React.Fragment key={`${config.symbol}-${segment.dateLabel}-${index}`}>
                        <rect
                          x={segment.startPercent}
                          y={0}
                          width={segment.widthPercent}
                          height={8}
                          fill={presentation.color}
                          fillOpacity={segment.zone === 'within' ? 0.28 : segment.zone === 'unknown' ? 0.15 : 0.72}
                          data-zone={segment.zone}
                        >
                          <title>{`${maskUserDerivedRangeDates ? PRIVACY_DATE_MASK : segment.dateLabel}: ${presentation.label}, ${formatSigmaDeviation(segment.deviation)}`}</title>
                        </rect>
                        {segment.zone === 'above' && (
                          <line
                            x1={segment.startPercent}
                            x2={segmentEnd}
                            y1={1}
                            y2={1}
                            stroke="white"
                            strokeOpacity={0.75}
                            strokeWidth={0.55}
                            aria-hidden="true"
                          />
                        )}
                        {segment.zone === 'below' && (
                          <line
                            x1={segment.startPercent}
                            x2={segmentEnd}
                            y1={7}
                            y2={7}
                            stroke="white"
                            strokeOpacity={0.75}
                            strokeWidth={0.55}
                            aria-hidden="true"
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </svg>
                <span className="w-14 pl-2 text-right text-[10px] font-semibold" style={{ color: config.color }}>
                  {config.shortLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ChartLegend items={legendItems} controls={renderSourceLinksToggle()} />
      {renderSourceLinksPanel()}

      {latestMetrics.length > 0 && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-2 text-sm text-muted-foreground">
          {latestMetrics.map(({ config, trendStats, diffPct, sigmaPosition, multiplier, todayMinusOneSigmaLevel }) => {
            const presentation = SIGMA_ZONE_PRESENTATION[sigmaPosition.zone];
            const historicalBand = trendStats
              ? `−${((1 - Math.exp(-trendStats.standardDeviation)) * 100).toFixed(1)} % / +${((Math.exp(trendStats.standardDeviation) - 1) * 100).toFixed(1)} %`
              : 'N/A';
            return (
              <div key={`metrics-${config.symbol}`} className="rounded border border-border/50 px-3 py-2">
                <div className="font-semibold" style={{ color: config.color }}>
                  {config.shortLabel}
                </div>
                <div>
                  Trend:{' '}
                  <span className="font-semibold text-foreground">
                    {trendStats ? `${(trendStats.annualGrowthRate * 100).toFixed(1)} %` : 'N/A'}
                  </span>
                </div>
                <div>
                  Historical ±1σ band:{' '}
                  <span className="font-semibold text-foreground">{historicalBand}</span>
                </div>
                <div>
                  Latest vs trend:{' '}
                  <span className="font-semibold text-foreground">
                    {Number.isFinite(diffPct) ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)} %` : 'N/A'}
                  </span>{' '}
                  (
                  <span className="font-semibold text-foreground">
                    {formatSigmaDeviation(sigmaPosition.deviation)}
                  </span>
                  )
                </div>
                <div>
                  Zone:{' '}
                  <span className="font-semibold" style={{ color: presentation.color }}>
                    <span aria-hidden="true">{presentation.icon} </span>
                    {presentation.label}
                  </span>
                </div>
                <div>
                  Multiplier:{' '}
                  <span className="font-semibold text-foreground">
                    {typeof multiplier === 'number' && Number.isFinite(multiplier) ? `${multiplier.toFixed(3)}x` : 'N/A'}
                  </span>
                </div>
                {config.symbol === APP_CONFIG.API.EUNL_SYMBOL && (
                  <div>
                    Today −1σ ({todayLabel}):{' '}
                    <span className="font-semibold text-foreground">
                      {typeof todayMinusOneSigmaLevel === 'number' && Number.isFinite(todayMinusOneSigmaLevel)
                        ? formatValue(todayMinusOneSigmaLevel)
                        : 'N/A'}
                    </span>{' '}€
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
