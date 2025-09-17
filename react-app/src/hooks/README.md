# Hooks Documentation

This directory contains custom React hooks for data management and calculations.

## Available Hooks

### `useData.ts`
Main data management hook for loading and processing application data.

**Returns:**
```typescript
{
  data: Event[];           // Parsed event data
  config: Config;          // Configuration settings
  conditions: Condition[]; // Reward conditions
  loading: boolean;        // Loading state
  error: string | null;    // Error message
  status: string;          // Status message
  loadData: (url: string) => Promise<void>;     // Load data from URL
  eunlData: EUNLDataPoint[];                   // EUNL ETF data
  fetchEUNLData: () => Promise<void>;          // Fetch EUNL data
}
```

**Features:**
- TSV data parsing from Google Sheets
- EUNL data fetching from Yahoo Finance
- Error handling and status reporting
- TypeScript support

**Usage:**
```tsx
const { data, config, loading, loadData } = useData();

useEffect(() => {
  loadData('https://docs.google.com/spreadsheets/...');
}, []);
```

### `useKPICalculations.ts`
Hook for calculating KPI metrics and time-based progress.

**Returns:**
```typescript
{
  // Work day calculations
  hoursToWorkEnd: number;
  workProgress: number;
  workTimeFormatted: string;
  
  // Family leave calculations
  familyLeaveTimeFormatted: string;
  familyLeaveProgress: number;
  familyLeaveWorkdays: number;
  daysToFamilyLeave: number;
  
  // Retirement calculations
  retirementTimeFormatted: string;
  retirementProgress: number;
  retirementWorkdays: number;
  daysToRetirement: number;
  
  currentTime: Date;
}
```

**Features:**
- Real-time calculations
- Automatic time updates (every minute)
- Memoized calculations for performance
- Comprehensive time tracking

**Usage:**
```tsx
const { workProgress, workTimeFormatted } = useKPICalculations();

return (
  <div>
    <p>Work Progress: {workProgress.toFixed(1)}%</p>
    <p>Time Remaining: {workTimeFormatted}</p>
  </div>
);
```

### `useFinancialCalculations.ts`
Hook for financial calculations and chart data processing.

**Parameters:**
- `data: Event[]` - Raw event data
- `config: Config` - Configuration settings
- `conditions: Condition[]` - Reward conditions
- `eunlData: EUNLDataPoint[]` - EUNL ETF data
- `viewMode: ViewMode` - Current view mode

**Returns:**
```typescript
{
  fullChartData: ChartDataPoint[];        // Complete chart data
  fullStocksData: ChartDataPoint[];       // Processed stocks data
  filteredData: Event[];                  // Filtered by view mode
  stocksData: ChartDataPoint[];           // Filtered stocks data
  eunlChartData: EUNLDataPoint[];         // EUNL data with trends
  milestoneMarkers: MilestoneMarker[];    // Condition milestones
}
```

**Features:**
- Financial calculations (targets, contributions)
- Chart data processing
- View mode filtering
- Trend calculations
- Milestone detection

**Usage:**
```tsx
const calculations = useFinancialCalculations(
  data, 
  config, 
  conditions, 
  eunlData, 
  viewMode
);

return (
  <StockChart 
    data={calculations.fullChartData}
    // ... other props
  />
);
```

### `useMemoizedCalculations.ts`
Performance optimization hook that combines multiple calculation hooks.

**Parameters:**
- `data: Event[]` - Raw event data
- `config: Config` - Configuration settings
- `conditions: Condition[]` - Reward conditions
- `eunlData: EUNLDataPoint[]` - EUNL ETF data
- `viewMode: ViewMode` - Current view mode

**Returns:**
```typescript
{
  kpiCalculations: KPICalculations;       // KPI metrics
  financialCalculations: FinancialCalculations; // Financial data
  memoizedData: {                         // Memoized metadata
    dataLength: number;
    conditionsLength: number;
    eunlDataLength: number;
    hasData: boolean;
    hasConditions: boolean;
    hasEunlData: boolean;
  };
  chartData: {                            // Chart metadata
    hasChartData: boolean;
    chartDataCount: number;
    latestDataPoint?: ChartDataPoint;
    firstDataPoint?: ChartDataPoint;
  };
  milestones: {                           // Milestone metadata
    hasMilestones: boolean;
    milestoneCount: number;
    milestones?: MilestoneMarker[];
  };
}
```

**Features:**
- Combines multiple calculation hooks
- Memoizes expensive computations
- Provides metadata for conditional rendering
- Performance optimization

**Usage:**
```tsx
const { kpiCalculations, financialCalculations, memoizedData } = useMemoizedCalculations(
  data, config, conditions, eunlData, viewMode
);

if (!memoizedData.hasData) {
  return <EmptyState />;
}

return (
  <div>
    <KPICards {...kpiCalculations} />
    <StockCharts {...financialCalculations} />
  </div>
);
```

## State Management

### `useAppStore.ts` (Zustand Store)
Global state management using Zustand for complex application state.

**State:**
```typescript
{
  // Data state
  data: Event[];
  config: Config;
  conditions: Condition[];
  eunlData: EUNLDataPoint[];
  
  // UI state
  loading: boolean;
  error: string | null;
  status: string;
  sheetsUrl: string;
}
```

**Actions:**
```typescript
{
  // Simple setters
  setData: (data: Event[]) => void;
  setConfig: (config: Config) => void;
  setConditions: (conditions: Condition[]) => void;
  setEunlData: (data: EUNLDataPoint[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
  setSheetsUrl: (url: string) => void;
  
  // Complex actions
  loadData: (url: string) => Promise<void>;
  fetchEUNLData: () => Promise<void>;
  reset: () => void;
}
```

**Features:**
- TypeScript support
- DevTools integration
- Async actions
- Error handling
- Reset functionality

**Usage:**
```tsx
const { data, loading, loadData, setError } = useAppStore();

const handleLoadData = async (url: string) => {
  try {
    await loadData(url);
  } catch (error) {
    setError('Failed to load data');
  }
};
```

## Best Practices

### Performance
- Use memoized calculations for expensive operations
- Implement proper dependency arrays in useEffect
- Use useMemo for derived state
- Avoid unnecessary re-renders with React.memo

### Error Handling
- Always handle async operations with try-catch
- Provide meaningful error messages
- Implement fallback states
- Use error boundaries for component errors

### TypeScript
- Define proper interfaces for all hook returns
- Use generic types where appropriate
- Implement strict type checking
- Document complex type relationships

### Testing
- Test hook behavior with different inputs
- Mock external dependencies
- Test error scenarios
- Verify memoization behavior

## Migration Guide

### From Class Components
```tsx
// Old class component
class DataComponent extends Component {
  state = { data: [], loading: false };
  
  async loadData() {
    this.setState({ loading: true });
    // ... loading logic
  }
}

// New hook-based component
function DataComponent() {
  const { data, loading, loadData } = useData();
  
  useEffect(() => {
    loadData(url);
  }, []);
}
```

### From Multiple useState
```tsx
// Old multiple useState
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

// New custom hook
const { data, loading, error } = useData();
```
