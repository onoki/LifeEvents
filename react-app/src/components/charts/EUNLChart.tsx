import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from 'recharts';
import type { EUNLChartProps } from '../../types';
import { formatCurrency } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';

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
  viewMode 
}: EUNLChartProps): JSX.Element {
  // Show empty state if no EUNL data
  if (!data || data.length === 0) {
    return (
      <div className="bg-card border border-gray-600 rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          {onFetchEUNL && (
            <button
              onClick={onFetchEUNL}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Fetching...' : 'Fetch EUNL Data'}
            </button>
          )}
        </div>
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

  // Apply toggle filter if needed (only for display)
  let filteredData = data;
  
  if (showOnlyDataWithStocks && data.length > 0) {
    // If this is EUNL data (has 'price' field), filter by date range of stocks data
    if (data[0].price !== undefined && stocksData && stocksData.length > 0) {
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
        
        // If viewMode is 'next2years', extend the range by 2 years
        if (viewMode === 'next2years') {
          maxMonth = new Date(maxDate.getFullYear() + 2, maxDate.getMonth() + 1, 0);
        }
        
        // Filter EUNL data to the same month range
        filteredData = data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= minMonth && itemDate <= maxMonth;
        });
      }
    } else if (data[0].stocks_in_eur !== undefined) {
      // This is stocks data - filter normally
      filteredData = data.filter(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0);
    }
  }

  const chartData = filteredData;

  return (
    <div className="bg-card border border-gray-600 rounded-lg p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {onFetchEUNL && (
          <button
            onClick={onFetchEUNL}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Fetching...' : 'Fetch EUNL Data'}
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={APP_CONFIG.UI.CHART_HEIGHT}>
        <ComposedChart data={chartData}>
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
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value, name) => [formatCurrency(value as number), name === 'price' ? 'EUNL price' : 'Trend']}
          />
          <Area 
            type="monotone" 
            dataKey={data.length > 0 && data[0].price !== undefined ? "price" : "stocks_in_eur"}
            stroke="#06b6d4" 
            fill="#06b6d4"
            fillOpacity={0.3}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 4, fill: '#06b6d4' }}
          />
          <Line 
            type="monotone" 
            dataKey="trend"
            stroke="#ef4444" 
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
