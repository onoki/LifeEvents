import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts'

export function AdvancedCharts({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="text-center py-8 text-muted-foreground">
          No data available
        </div>
      </div>
    )
  }

  const chartData = processChartData(data)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* 1. Multiple Area Series (Non-Stacked) */}
      <ChartCard
        title="Multiple Area Series"
        description="Non-stacked area charts with different colors"
      >
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
          />
          <Area
            type="monotone"
            dataKey="stocks_in_eur"
            stackId="1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="projected"
            stackId="2"
            stroke="#06b6d4"
            fill="#06b6d4"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ChartCard>

      {/* 2. Combined Area + Line Chart */}
      <ChartCard
        title="Area + Line Combination"
        description="Area chart with line series overlay"
      >
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
          />
          <Area
            type="monotone"
            dataKey="stocks_in_eur"
            stackId="1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
          />
          <Line
            type="monotone"
            dataKey="movingAverage"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartCard>

      {/* 3. Area Between Two Lines */}
      <ChartCard
        title="Area Between Two Lines"
        description="Filled area bounded by upper and lower bounds"
      >
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
          />
          <Area
            type="monotone"
            dataKey="upperBound"
            stackId="1"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="lowerBound"
            stackId="1"
            stroke="#10b981"
            fill="#ffffff"
            fillOpacity={1}
          />
        </AreaChart>
      </ChartCard>

      {/* 4. Advanced: Area with Confidence Interval */}
      <ChartCard
        title="Confidence Interval"
        description="Area chart showing uncertainty range"
      >
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="dateFormatted"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
          />
          <Area
            type="monotone"
            dataKey="upperBound"
            stackId="1"
            stroke="transparent"
            fill="#3b82f6"
            fillOpacity={0.1}
          />
          <Area
            type="monotone"
            dataKey="lowerBound"
            stackId="1"
            stroke="transparent"
            fill="#ffffff"
            fillOpacity={1}
          />
          <Line
            type="monotone"
            dataKey="stocks_in_eur"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          />
        </AreaChart>
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, description, children }) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

// Helper function to process data with additional series
function processChartData(data) {
  return data
    .filter(item => item.date && item.stocks_in_eur)
    .map((item, index) => {
      const baseValue = parseFloat(item.stocks_in_eur) || 0
      const projected = baseValue * 1.05 // 5% growth projection
      const movingAverage = index >= 2 ? 
        (parseFloat(data[index-1]?.stocks_in_eur || 0) + parseFloat(data[index-2]?.stocks_in_eur || 0) + baseValue) / 3 
        : baseValue
      
      return {
        ...item,
        dateFormatted: item.date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        stocks_in_eur: baseValue,
        projected: projected,
        movingAverage: movingAverage,
        upperBound: baseValue * 1.1, // 10% above
        lowerBound: baseValue * 0.9, // 10% below
      }
    })
    .sort((a, b) => a.date - b.date)
}
