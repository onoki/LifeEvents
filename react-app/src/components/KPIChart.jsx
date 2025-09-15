import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export function KPIChart({ data, type }) {
  if (type === 'line') {
    return <EventsOverTimeChart data={data} />
  } else if (type === 'pie') {
    return <CategoryDistributionChart data={data} />
  }
  return null
}

function EventsOverTimeChart({ data }) {
  const monthlyData = getMonthlyEventData(data)
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={monthlyData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="month" 
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
        <Line 
          type="monotone" 
          dataKey="events" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function CategoryDistributionChart({ data }) {
  const categoryData = getCategoryData(data)
  const colors = [
    'hsl(var(--primary))',
    'hsl(142.1, 76.2%, 36.3%)',
    'hsl(47.9, 95.8%, 53.3%)',
    'hsl(346.8, 86.1%, 49.4%)',
    'hsl(262.1, 83.3%, 57.8%)',
    'hsl(24.6, 95%, 53.1%)',
    'hsl(195.7, 85.6%, 64.9%)',
    'hsl(322.7, 84%, 64.9%)',
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={categoryData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {categoryData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Helper functions
function getMonthlyEventData(data) {
  const monthlyCount = {}
  
  data.forEach(event => {
    if (event.date) {
      const monthKey = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}`
      monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1
    }
  })

  const sortedMonths = Object.keys(monthlyCount).sort()
  return sortedMonths.map(month => {
    const [year, monthNum] = month.split('-')
    return {
      month: new Date(year, monthNum - 1).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      }),
      events: monthlyCount[month]
    }
  })
}

function getCategoryData(data) {
  const categoryCount = {}
  
  data.forEach(event => {
    const category = event.category || 'Uncategorized'
    categoryCount[category] = (categoryCount[category] || 0) + 1
  })

  return Object.entries(categoryCount).map(([name, value]) => ({
    name,
    value
  }))
}
