import React from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from 'recharts';
import type { EUNLChartProps } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';
import { CountUp } from '../ui/countup';
import { ChartLegend } from './ChartLegend';

/**
 * EUNL Chart Component
 * Displays EUNL ETF price history with exponential trend line
 */
export function EUNLChart({ 
  title, 
  data, 
  onFetchEUNL, 
  loading, 
  showOnlyDataWithStocks, 
  stocksData, 
  viewMode,
  trendStats,
  eunlError
}: EUNLChartProps): React.JSX.Element {
  const legendItems = React.useMemo(() => ([
    {
      label: 'EUNL Price',
      description: 'The actual price of one MSCI World ETF (EUNL).',
      color: '#06b6d4',
      variant: 'area'
    },
    {
      label: 'Trend',
      description: 'Price trend from the whole history of EUNL.',
      color: '#ef4444',
      variant: 'line'
    },
    {
      label: 'Standard deviation',
      description: 'Standard deviation of the price from the whole history of EUNL.',
      color: '#ef4444',
      strokeDasharray: '5 5',
      variant: 'line'
    },
    {
      label: 'Multiplier',
      description: 'Trend divided by price. Used to convert the current value of the stocks to the trend in the other charts.',
      variant: 'note'
    }
  ]), []);
  // Show empty state if no EUNL data
  if (!data || data.length === 0) {
    return (
      <div className="bg-card border border-gray-600 rounded-lg p-2 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {onFetchEUNL && (
              <button
                onClick={onFetchEUNL}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Fetching...' : 'Fetch EUNL Data'}
              </button>
            )}
            <button
              onClick={() => window.open(`https://finance.yahoo.com/quote/${APP_CONFIG.API.EUNL_SYMBOL}/`, '_blank', 'noopener,noreferrer')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              View on Yahoo Finance
            </button>
          </div>
        </div>
        {eunlError && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {eunlError}
          </div>
        )}
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <p>No EUNL data loaded</p>
            <p className="text-sm">Click "Fetch EUNL Data" to load historical data</p>
          </div>
        </div>
      </div>
    );
  }

  const isEunlData = data.length > 0 && data[0].price !== undefined;
  // Apply toggle filter if needed (only for display)
  let filteredData = data;
  
  if (showOnlyDataWithStocks && data.length > 0) {
    // If this is EUNL data (has 'price' field), filter by date range of stocks data
    if (isEunlData && stocksData && stocksData.length > 0) {
      // Get the date range from stocks data that has actual values
      const stocksWithData = stocksData.filter(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0);
      if (stocksWithData.length > 0) {
        // Get the month boundaries from stocks data
        const stocksDates = stocksWithData.map(item => item.date);
        const minDate = new Date(Math.min(...stocksDates.map(date => date.getTime())));
        const maxDate = new Date(Math.max(...stocksDates.map(date => date.getTime())));
        
        // Create month boundaries (start of month for min, end of month for max)
        const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        let maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0); // Last day of the month
        
        // Always extend by one additional month to show current month data
        // This helps when you're at the beginning of a month and haven't invested yet
        maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0); // One month beyond the last recorded month
        
        // If viewMode is 'next2years' or 'next5years', extend the range
        if (viewMode === 'next2years' || viewMode === 'next5years') {
          const yearsToAdd = viewMode === 'next5years' ? 5 : 2;
          maxMonth = new Date(maxDate.getFullYear() + yearsToAdd, maxDate.getMonth() + 2, 0);
        }
        
        // Filter EUNL data to the same month range
        filteredData = data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= minMonth && itemDate <= maxMonth;
        });
      }
    } else if (!isEunlData && 'stocks_in_eur' in data[0] && data[0].stocks_in_eur !== undefined) {
      // This is stocks data - filter normally
      filteredData = data.filter(item => 'stocks_in_eur' in item && item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0);
    }
  }

  const chartData = filteredData;
  const latestEunlPoint = React.useMemo(() => {
    if (!isEunlData || chartData.length === 0) return null;
    return chartData.reduce((latest, item) => (item.date > latest.date ? item : latest), chartData[0]);
  }, [chartData, isEunlData]);

  const latestMetrics = React.useMemo(() => {
    if (!latestEunlPoint) return null;
    const price = latestEunlPoint.price ?? null;
    const trend = latestEunlPoint.trend ?? null;
    const trendLowerBound = latestEunlPoint.trendLowerBound ?? null;

    const diffPct = price !== null && trend !== null && trend !== 0
      ? ((price - trend) / trend) * 100
      : null;

    const distanceToLower = price !== null && trendLowerBound !== null
      ? price - trendLowerBound
      : null;
    const sigmaAbs = trend !== null && trendLowerBound !== null
      ? trend - trendLowerBound
      : null;
    const sigmasFromLower = distanceToLower !== null && sigmaAbs !== null && sigmaAbs !== 0
      ? distanceToLower / sigmaAbs
      : null;

    const multiplier = latestEunlPoint.multiplier ?? (price !== null && trend !== null && price !== 0 ? trend / price : null);

    return {
      diffPct,
      distanceToLower,
      sigmasFromLower,
      multiplier
    };
  }, [latestEunlPoint]);

  const diffPctLabel = latestMetrics && Number.isFinite(latestMetrics.diffPct)
    ? `${latestMetrics.diffPct >= 0 ? '+' : ''}${latestMetrics.diffPct.toFixed(2)} %`
    : 'N/A';
  const sigmasFromLowerLabel = latestMetrics && Number.isFinite(latestMetrics.sigmasFromLower)
    ? `${latestMetrics.sigmasFromLower.toFixed(2)} σ`
    : 'N/A';
  const multiplierLabel = latestMetrics && Number.isFinite(latestMetrics.multiplier)
    ? `${latestMetrics.multiplier.toFixed(3)}x`
    : 'N/A';

  return (
    <div className="bg-card border border-gray-600 rounded-lg p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {onFetchEUNL && (
            <button
              onClick={onFetchEUNL}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Fetching...' : 'Fetch EUNL Data'}
            </button>
          )}
          <button
            onClick={() => window.open(`https://finance.yahoo.com/quote/${APP_CONFIG.API.EUNL_SYMBOL}/`, '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            View on Yahoo Finance
          </button>
        </div>
      </div>
      {eunlError && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {eunlError}
        </div>
      )}
      <ResponsiveContainer width="100%" height={APP_CONFIG.UI.CHART_HEIGHT}>
        <ComposedChart data={chartData} margin={{ left: -10, right: -10, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => formatCurrency(value)}
            domain={['dataMin', 'dataMax']}
            orientation="right"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) {
                return null;
              }

              const nameMap: { [key: string]: string } = {
                'price': 'EUNL Price',
                'trend': 'Trend',
                'trendUpperBound': 'Standard deviation (+1 σ)',
                'trendLowerBound': 'Standard deviation (-1 σ)',
                'multiplier': 'Multiplier (trend ÷ price)'
              };

              // Get the payload item to access multiplier
              const dataItem = payload[0]?.payload;
              const multiplier = dataItem?.multiplier;

              return (
                <div className="rounded-lg border bg-popover p-3 shadow-md">
                  <p className="mb-2 font-medium">{`Date: ${label}`}</p>
                  <ul className="space-y-1">
                    {payload.map((entry, index) => {
                      const name = entry.dataKey as string;
                      const value = entry.value as number;
                      
                      if (name === 'multiplier') {
                        const numericValue = typeof value === 'number' ? value : Number(value);
                        const formattedMultiplier = Number.isFinite(numericValue) ? `${numericValue.toFixed(3)}x` : 'N/A';
                        return (
                          <li key={index} className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{nameMap[name] || name}:</span>
                            <span className="font-medium">{formattedMultiplier}</span>
                          </li>
                        );
                      }

                      const formattedValue = formatCurrency(value);
                      return (
                        <li key={index} className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{nameMap[name] || name}:</span>
                          <span className="font-medium">{formattedValue}</span>
                        </li>
                      );
                    })}
                    {/* Always show multiplier if it exists in the data and isn't already in payload */}
                    {multiplier !== undefined && multiplier !== null && !payload.some(p => p.dataKey === 'multiplier') && (
                      <li className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{nameMap['multiplier']}:</span>
                        <span className="font-medium">
                          {Number.isFinite(multiplier) ? `${Number(multiplier).toFixed(3)}x` : 'N/A'}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              );
            }}
          />
          
          
          {/* Main price area */}
          <Area 
            type="monotone" 
            dataKey={isEunlData ? "price" : "stocks_in_eur"}
            stroke="#06b6d4" 
            fill="#06b6d4"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#06b6d4' }}
          />
          
          {/* Trend line */}
          <Line 
            type="monotone" 
            dataKey="trend"
            stroke="#ef4444" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444' }}
          />
          
          {/* Confidence interval bounds - subtle dashed lines */}
          <Line 
            type="monotone" 
            dataKey="trendUpperBound"
            stroke="#ef4444" 
            strokeWidth={1}
            strokeDasharray="5 5"
            strokeOpacity={0.6}
            dot={false}
            activeDot={false}
          />
          <Line 
            type="monotone" 
            dataKey="trendLowerBound"
            stroke="#ef4444" 
            strokeWidth={1}
            strokeDasharray="5 5"
            strokeOpacity={0.6}
            dot={false}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend items={legendItems} />
      
      {/* Trend Statistics Display */}
      {trendStats && (
        <div className="mt-4 text-sm text-muted-foreground">
          Calculated trend: <CountUp 
            key="annual-growth"
            value={Math.round(trendStats.annualGrowthRate * 100 * 10) / 10} 
            decimals={1}
            className="font-semibold text-foreground"
            suffix=" %"
          />&nbsp;(± <CountUp 
            key="standard-deviation"
            value={Math.round(trendStats.standardDeviation * 100 * 10) / 10} 
            decimals={1}
            className="font-semibold text-foreground"
            suffix=" %"
          />)
          {latestMetrics && (
            <div className="mt-2 flex flex-nowrap gap-x-4 text-sm">
              <span className="whitespace-nowrap">
                Latest vs trend: <span className="font-semibold text-foreground">{diffPctLabel}</span>
              </span>
              <span className="whitespace-nowrap">
                Latest vs. -1 σ: <span className="font-semibold text-foreground">
                  {sigmasFromLowerLabel !== 'N/A' ? `${sigmasFromLowerLabel.startsWith('-') ? '' : '+'}${sigmasFromLowerLabel}` : 'N/A'}
                </span>
              </span>
              <span className="whitespace-nowrap">
                Multiplier: <span className="font-semibold text-foreground">{multiplierLabel}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
