import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from 'recharts'
import { useState } from 'react'

export function StockCharts({ data, config }) {
  const [showOnlyDataWithStocks, setShowOnlyDataWithStocks] = useState(false)

  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="text-center py-8 text-muted-foreground">
          No stock data available
        </div>
      </div>
    )
  }

  // Always calculate with full data range for consistent target lines
  const fullChartData = calculateTargetWithFixedContribution(data, config)
  const fullStocksData = processStocksData(data)
  
  // Filter data based on toggle state (only for display)
  const filteredData = showOnlyDataWithStocks 
    ? data.filter(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur) > 0)
    : data

  const stocksData = processStocksData(filteredData)

  return (
    <div className="space-y-6">
      {/* Toggle Control */}
      <div className="flex items-center justify-center">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Show all data</span>
            <button
              onClick={() => setShowOnlyDataWithStocks(!showOnlyDataWithStocks)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showOnlyDataWithStocks ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showOnlyDataWithStocks ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium">Show only months with stock data</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <StockChart 
          title="Owned Stocks" 
          data={showOnlyDataWithStocks ? fullChartData.filter(item => item.stocks_in_eur !== null) : fullChartData}
          dataKey="stocks_in_eur"
          description="Complex line chart showing your stock portfolio value over time"
          config={config}
        />
        
        <EUNLChart 
          title="EUNL History" 
          data={stocksData}
          description="Simpler line chart showing EUNL ETF performance"
        />
        
        {/* Minimum Required Contributions Chart */}
        <MinRequiredContributionsChart 
          title="Minimum Required Monthly Contributions" 
          data={showOnlyDataWithStocks ? fullChartData.filter(item => item.stocks_in_eur !== null) : fullChartData}
          config={config}
          description="Monthly contribution needed to reach investment goal"
        />
      </div>
    </div>
  )
}

function StockChart({ title, data, dataKey, description, config }) {
  // Data is already calculated with full range, just use it directly
  const chartData = data
  
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
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
            label={{ value: 'Portfolio Value (€)', angle: -90, position: 'insideLeft' }}
            domain={[(dataMin) => Math.floor(dataMin / 1000) * 1000, (dataMax) => Math.ceil(dataMax / 1000) * 1000]}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value, name) => {
              const annualGrowthRate = parseFloat(config.annual_growth_rate)
              const label = name === 'stocks_in_eur' ? 'Current Stocks' : 
                           name === 'targetWithFixedContribution' ? 'Target with Fixed Contribution' :
                           name === 'targetWithMinimumContribution' ? 'Target with Minimum Contribution' :
                           name === 'lineWithMinusOnePercentGrowth' ? `${Math.round((annualGrowthRate - 0.01) * 100)} % Growth Scenario` :
                           name === 'lineWithPlusOnePercentGrowth' ? `${Math.round((annualGrowthRate + 0.01) * 100)} % Growth Scenario` :
                           'Unknown'
              return [`€${Math.round(value)}`, label]
            }}
          />
          {/* Line 1: Target with fixed contribution */}
          <Line 
            type="monotone" 
            dataKey="targetWithFixedContribution"
            stroke="#ef4444" 
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={{ fill: '#ef4444', strokeWidth: 1, r: 2 }}
            activeDot={{ r: 4, fill: '#dc2626' }}
          />
          {/* Line 4: (annual_growth_rate - 1%) scenario */}
          <Line 
            type="monotone" 
            dataKey="lineWithMinusOnePercentGrowth"
            stroke="#10b981" 
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={{ fill: '#10b981', strokeWidth: 1, r: 2 }}
            activeDot={{ r: 4, fill: '#059669' }}
          />
          {/* Line 5: (annual_growth_rate + 1%) scenario */}
          <Line 
            type="monotone" 
            dataKey="lineWithPlusOnePercentGrowth"
            stroke="#f59e0b" 
            strokeWidth={1}
            strokeDasharray="4 2"
            dot={{ fill: '#f59e0b', strokeWidth: 1, r: 2 }}
            activeDot={{ r: 4, fill: '#d97706' }}
          />
          {/* Line 2: Target with minimum contribution */}
          <Line 
            type="monotone" 
            dataKey="targetWithMinimumContribution"
            stroke="#8b5cf6" 
            strokeWidth={1}
            strokeDasharray="2 2"
            dot={{ fill: '#8b5cf6', strokeWidth: 1, r: 2 }}
            activeDot={{ r: 4, fill: '#7c3aed' }}
          />
          {/* Line 3: Current stocks value - Area series */}
          <Area 
            type="monotone" 
            dataKey={dataKey}
            stroke="#3b82f6" 
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 1.5, r: 3 }}
            activeDot={{ r: 5, fill: '#1d4ed8' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function EUNLChart({ title, data, description }) {
  // For EUNL, we'll show a simpler version - you can customize this
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
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
            domain={[(dataMin) => Math.floor(dataMin / 1000) * 1000, (dataMax) => Math.ceil(dataMax / 1000) * 1000]}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value) => [`€${Math.round(value)}`, 'EUNL Value']}
          />
          <Line 
            type="monotone" 
            dataKey="stocks_in_eur"
            stroke="#06b6d4" 
            strokeWidth={3}
            dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#0891b2' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function MinRequiredContributionsChart({ title, data, config, description }) {
  // Data is already calculated with full range, just use it directly
  const chartData = data
  
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
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
            label={{ value: 'Monthly Contribution (€)', angle: -90, position: 'insideLeft' }}
            domain={[(dataMin) => Math.floor(dataMin / 1000) * 1000, (dataMax) => Math.ceil(dataMax / 1000) * 1000]}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value) => [`€${Math.round(value)}`, 'Min Required Contribution']}
          />
          <Line 
            type="monotone" 
            dataKey="minRequiredContribution"
            stroke="#10b981" 
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={{ fill: '#10b981', strokeWidth: 1.5, r: 3 }}
            activeDot={{ r: 5, fill: '#059669' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Helper function to calculate target with fixed monthly contribution
function calculateTargetWithFixedContribution(data, config) {
  if (!data || data.length === 0) return []
  
  // Get parameters
  const investmentGoal = parseFloat(config.investment_goal)
  const annualGrowthRate = parseFloat(config.annual_growth_rate)
  const monthlyGrowthRate = annualGrowthRate / 12
  
  // Sort data by date to ensure proper order
  const sortedData = [...data].sort((a, b) => a.date - b.date)
  
  // Get first and last dates from the raw data (including rows without stocks data)
  const firstDate = sortedData[0].date
  const lastDate = sortedData[sortedData.length - 1].date
  
  // Find the first row that actually has stocks data
  const firstStocksData = sortedData.find(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur) > 0)
  if (!firstStocksData) return []
  
  const firstValue = parseFloat(firstStocksData.stocks_in_eur)
  
  // Calculate total number of months from first to last date
  const totalMonths = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth()) + 1
  
  // Calculate required monthly contribution using future value of annuity formula
  // FV = PMT * [((1 + r)^n - 1) / r] + PV * (1 + r)^n
  // Where: FV = investment goal, PV = present value, r = monthly rate, n = months, PMT = monthly payment
  const futureValueOfPresentValue = firstValue * Math.pow(1 + monthlyGrowthRate, totalMonths - 1)
  const remainingToAchieve = investmentGoal - futureValueOfPresentValue
  
  let monthlyContribution = 0
  if (totalMonths > 0 && monthlyGrowthRate > 0) {
    monthlyContribution = remainingToAchieve / ((Math.pow(1 + monthlyGrowthRate, totalMonths - 1) - 1) / monthlyGrowthRate)
  } else if (totalMonths > 0) {
    monthlyContribution = remainingToAchieve / (totalMonths - 1)
  }
  
  // Find the latest data point that has actual stock values
  const latestDataPoint = sortedData
    .filter(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur) > 0)
    .pop()
  
  // Calculate minimum required contribution at the latest known data point
  let latestMinRequiredContribution = 0
  let latestDataPointIndex = -1
  if (latestDataPoint) {
    latestDataPointIndex = sortedData.findIndex(item => 
      item.date.getTime() === latestDataPoint.date.getTime()
    )
    
    const latestMonthsFromStart = (latestDataPoint.date.getFullYear() - firstDate.getFullYear()) * 12 + 
                                 (latestDataPoint.date.getMonth() - firstDate.getMonth())
    const monthsRemaining = totalMonths - latestMonthsFromStart
    const currentValue = parseFloat(latestDataPoint.stocks_in_eur)
    const futureValueOfCurrent = currentValue * Math.pow(1 + monthlyGrowthRate, monthsRemaining)
    const remainingToAchieve = investmentGoal - futureValueOfCurrent
    
    if (monthsRemaining > 0 && monthlyGrowthRate > 0) {
      latestMinRequiredContribution = remainingToAchieve / ((Math.pow(1 + monthlyGrowthRate, monthsRemaining) - 1) / monthlyGrowthRate)
    } else if (monthsRemaining > 0) {
      latestMinRequiredContribution = remainingToAchieve / monthsRemaining
    }
    latestMinRequiredContribution = Math.max(0, latestMinRequiredContribution)
  }
  
  // Process the raw data and add target calculations
  let previousMinContributionLineValue = 0
  let previousMinusOnePercentValue = 0
  let previousPlusOnePercentValue = 0

  const result = sortedData.map((item, index) => {
    const monthsFromStart = (item.date.getFullYear() - firstDate.getFullYear()) * 12 + 
                           (item.date.getMonth() - firstDate.getMonth())
    
    // Calculate target value for this month
    const targetValue = firstValue * Math.pow(1 + monthlyGrowthRate, monthsFromStart) + 
                       monthlyContribution * ((Math.pow(1 + monthlyGrowthRate, monthsFromStart) - 1) / monthlyGrowthRate)
    
    // Calculate minimum required contribution for this month
    let minRequiredContribution = 0
    if (index <= latestDataPointIndex) {
      // For points up to and including the latest known data point, calculate normally
      const monthsRemaining = totalMonths - monthsFromStart - 1
      const currentValue = item.stocks_in_eur ? parseFloat(item.stocks_in_eur) : 0
      const futureValueOfCurrent = currentValue * Math.pow(1 + monthlyGrowthRate, monthsRemaining)
      const remainingToAchieve = investmentGoal - futureValueOfCurrent
      
      if (monthsRemaining > 0 && monthlyGrowthRate > 0) {
        minRequiredContribution = remainingToAchieve / ((Math.pow(1 + monthlyGrowthRate, monthsRemaining) - 1) / monthlyGrowthRate)
      } else if (monthsRemaining > 0) {
        minRequiredContribution = remainingToAchieve / monthsRemaining
      }
        minRequiredContribution = Math.max(0, minRequiredContribution)
        latestMinRequiredContribution = minRequiredContribution
    } else {
      // For future points (after latest known data point), use the same value as latest
      minRequiredContribution = latestMinRequiredContribution
    }
    
    // Calculate minimum contribution line value
    let targetWithMinimumContribution = null
    if (item.stocks_in_eur) {
      // Rule 1: if there is a "stocks_in_eur" value for a given month - don't show this line
      targetWithMinimumContribution = null
    } else {
      // Rule 2: if there is no "stocks_in_eur" value for a given month
      targetWithMinimumContribution = previousMinContributionLineValue * (1 + monthlyGrowthRate) + latestMinRequiredContribution
    }
    
    // Calculate alternative growth scenarios (annual_growth_rate ± 1%)
    const monthlyGrowthRateMinusOne = (annualGrowthRate - 0.01) / 12
    const monthlyGrowthRatePlusOne = (annualGrowthRate + 0.01) / 12
    
    let lineWithMinusOnePercentGrowth = null
    let lineWithPlusOnePercentGrowth = null
    
    if (item.stocks_in_eur) {
      // Don't show these lines when there's actual stocks data
      lineWithMinusOnePercentGrowth = null
      lineWithPlusOnePercentGrowth = null
    } else {
      // Calculate with (annual_growth_rate - 1%) using its own previous value
      lineWithMinusOnePercentGrowth = previousMinusOnePercentValue * (1 + monthlyGrowthRateMinusOne) + latestMinRequiredContribution
      // Calculate with (annual_growth_rate + 1%) using its own previous value
      lineWithPlusOnePercentGrowth = previousPlusOnePercentValue * (1 + monthlyGrowthRatePlusOne) + latestMinRequiredContribution
    }
    
    const resultItem = {
      ...item,
      dateFormatted: item.date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: '2-digit'
      }),
      stocks_in_eur: item.stocks_in_eur ? parseFloat(item.stocks_in_eur) : null,
      targetWithFixedContribution: Math.max(0, targetValue),
      minRequiredContribution: minRequiredContribution,
        targetWithMinimumContribution: targetWithMinimumContribution ? Math.max(0, targetWithMinimumContribution) : null,
        lineWithMinusOnePercentGrowth: lineWithMinusOnePercentGrowth ? Math.max(0, lineWithMinusOnePercentGrowth) : null,
        lineWithPlusOnePercentGrowth: lineWithPlusOnePercentGrowth ? Math.max(0, lineWithPlusOnePercentGrowth) : null
    }

    // Update previous values for next iteration
    if (item.stocks_in_eur) {
      // When we have actual stocks data, reset all previous values to this value
      const currentStocksValue = parseFloat(item.stocks_in_eur)
      previousMinContributionLineValue = currentStocksValue
      previousMinusOnePercentValue = currentStocksValue
      previousPlusOnePercentValue = currentStocksValue
    } else {
      // When we don't have stocks data, update each line's previous value with its own calculated value
      if (targetWithMinimumContribution !== null) {
        previousMinContributionLineValue = targetWithMinimumContribution
      }
      if (lineWithMinusOnePercentGrowth !== null) {
        previousMinusOnePercentValue = lineWithMinusOnePercentGrowth
      }
      if (lineWithPlusOnePercentGrowth !== null) {
        previousPlusOnePercentValue = lineWithPlusOnePercentGrowth
      }
    }
    
    return resultItem
  })
  
  return result
}

// Helper function to process stocks data
function processStocksData(data) {
  return data
    .filter(item => item.date && item.stocks_in_eur)
    .map(item => ({
      ...item,
      dateFormatted: item.date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: '2-digit'
      }),
      stocks_in_eur: parseFloat(item.stocks_in_eur) || 0
    }))
    .sort((a, b) => a.date - b.date)
}
