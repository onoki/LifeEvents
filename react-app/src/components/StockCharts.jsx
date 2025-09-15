import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts'

export function StockCharts({ data, config }) {
  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="text-center py-8 text-muted-foreground">
          No stock data available
        </div>
      </div>
    )
  }

  const stocksData = processStocksData(data)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <StockChart 
        title="Owned Stocks" 
        data={data}
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
        data={data}
        config={config}
        description="Monthly contribution needed to reach investment goal"
      />
    </div>
  )
}

function StockChart({ title, data, dataKey, description, config }) {
  const chartData = calculateTargetWithFixedContribution(data, config)
  
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
            label={{ value: 'Portfolio Value (€)', angle: -90, position: 'insideLeft' }}
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
              const label = name === 'stocks_in_eur' ? 'Current Value' : 
                           name === 'targetWithFixedContribution' ? 'Target with Fixed Contribution' :
                           'New Line Value'
              return [`€${value}`, label]
            }}
          />
          {/* Line 1: Target with fixed contribution */}
          <Line 
            type="monotone" 
            dataKey="targetWithFixedContribution"
            stroke="#ef4444" 
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={{ fill: '#ef4444', strokeWidth: 1, r: 2 }}
            activeDot={{ r: 4, fill: '#dc2626' }}
          />
          {/* Line 2: New line value */}
          <Line 
            type="monotone" 
            dataKey="newLineValue"
            stroke="#8b5cf6" 
            strokeWidth={1.5}
            strokeDasharray="2 2"
            dot={{ fill: '#8b5cf6', strokeWidth: 1, r: 2 }}
            activeDot={{ r: 4, fill: '#7c3aed' }}
          />
          {/* Line 3: Current stocks value */}
          <Line 
            type="monotone" 
            dataKey={dataKey}
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 1.5, r: 3 }}
            activeDot={{ r: 5, fill: '#1d4ed8' }}
          />
        </LineChart>
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
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value) => [`€${value}`, 'EUNL Value']}
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
  const chartData = calculateTargetWithFixedContribution(data, config)
  
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
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              color: 'hsl(var(--popover-foreground))'
            }}
            formatter={(value) => [`€${value}`, 'Min Required Contribution']}
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
  let previousNewLineValue = 0
  
  return sortedData.map((item, index) => {
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
    } else {
      // For future points (after latest known data point), use the same value as latest
      minRequiredContribution = latestMinRequiredContribution
    }
    
    // Calculate new line value
    let newLineValue = 0
    if (item.stocks_in_eur) {
      // Rule 1: if there is a "stocks_in_eur" value for a given month
      const currentStocksValue = parseFloat(item.stocks_in_eur)
      newLineValue = (currentStocksValue + latestMinRequiredContribution) * (1 + monthlyGrowthRate)
    } else {
      // Rule 2: if there is no "stocks_in_eur" value for a given month
      newLineValue = previousNewLineValue * (1 + monthlyGrowthRate) + latestMinRequiredContribution
    }
    
    // Update previous value for next iteration
    previousNewLineValue = newLineValue
    
    return {
      ...item,
      dateFormatted: item.date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: '2-digit'
      }),
      stocks_in_eur: item.stocks_in_eur ? parseFloat(item.stocks_in_eur) : null,
      targetWithFixedContribution: Math.max(0, targetValue),
      minRequiredContribution: minRequiredContribution,
      newLineValue: Math.max(0, newLineValue)
    }
  })
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
