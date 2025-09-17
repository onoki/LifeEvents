# Components Documentation

This directory contains all React components organized by functionality.

## Structure

```
components/
├── ui/                    # Reusable UI components (shadcn/ui)
├── kpi/                   # KPI-related components
├── charts/                # Chart components
├── ErrorBoundary.tsx      # Error boundary component
└── README.md             # This file
```

## Component Categories

### UI Components (`ui/`)
Base UI components built with shadcn/ui and Radix UI primitives.

- **Card**: Container component with header, content, and footer sections
- **Button**: Interactive button with multiple variants and sizes
- **Input**: Form input component
- **Label**: Form label component
- **Badge**: Status and category display component

### KPI Components (`kpi/`)
Components for displaying Key Performance Indicators and progress tracking.

#### `KPICards.tsx`
Main container for KPI cards display.

**Props:**
- `data: Event[]` - Array of event data
- `config: Config` - Configuration object
- `conditions: Condition[]` - Array of conditions

#### `WorkProgressCard.tsx`
Displays current work day progress with time remaining.

**Features:**
- Real-time work progress calculation
- Time remaining display
- Progress bar visualization
- Automatic updates every minute

#### `FamilyLeaveCard.tsx`
Shows family leave progress and time remaining.

**Features:**
- Family leave period tracking
- Workdays calculation
- Progress percentage
- Time remaining display

#### `RetirementCard.tsx`
Displays retirement progress and time remaining.

**Features:**
- Retirement period tracking
- Workdays calculation with vacation exclusions
- Progress percentage
- Long-term time tracking

### Chart Components (`charts/`)
Components for displaying financial and data visualization charts.

#### `StockCharts.tsx`
Main container for stock-related charts.

**Props:**
- `data: Event[]` - Stock data
- `config: Config` - Chart configuration
- `conditions: Condition[]` - Reward conditions
- `eunlData: EUNLDataPoint[]` - EUNL ETF data
- `onFetchEUNL: () => Promise<void>` - EUNL data fetch handler
- `loading: boolean` - Loading state

#### `StockChart.tsx`
Displays stock value progression with target lines.

**Features:**
- Interactive stock value chart
- Target lines for different scenarios
- Milestone markers for conditions
- Tooltip with detailed information

#### `EUNLChart.tsx`
Shows EUNL ETF price history with trend analysis.

**Features:**
- Historical price data
- Exponential trend line
- Date range filtering
- Fetch data functionality

#### `MinRequiredContributionsChart.tsx`
Displays minimum required monthly contributions.

**Features:**
- Monthly contribution calculations
- Goal-based projections
- Interactive tooltips

#### `ViewModeToggle.tsx`
Toggle control for different data view modes.

**Features:**
- Three view modes: recorded, next 2 years, full range
- Accessible button controls
- Visual state indication

#### `ConditionsTable.tsx`
Displays reward conditions in table format.

**Features:**
- Structured condition display
- Monetary value formatting
- Responsive table design

### Error Handling

#### `ErrorBoundary.tsx`
Catches and handles React component errors gracefully.

**Features:**
- Error boundary implementation
- Custom fallback UI
- Error reporting
- Retry functionality
- Development error details

**Usage:**
```tsx
<ErrorBoundary onError={(error, errorInfo) => console.log(error, errorInfo)}>
  <YourComponent />
</ErrorBoundary>
```

## Usage Examples

### Basic KPI Cards
```tsx
import { KPICards } from './components/kpi/KPICards';

<KPICards 
  data={events} 
  config={config} 
  conditions={conditions} 
/>
```

### Stock Charts with Error Boundary
```tsx
import { ErrorBoundary } from './components/ErrorBoundary';
import { StockCharts } from './components/charts/StockCharts';

<ErrorBoundary>
  <StockCharts 
    data={stockData}
    config={config}
    conditions={conditions}
    eunlData={eunlData}
    onFetchEUNL={handleFetchEUNL}
    loading={loading}
  />
</ErrorBoundary>
```

### Individual Chart Component
```tsx
import { StockChart } from './components/charts/StockChart';

<StockChart 
  title="My Stock Chart"
  data={chartData}
  dataKey="stocks_in_eur"
  config={config}
  conditions={conditions}
/>
```

## Accessibility Features

All components include accessibility features:

- **ARIA labels**: Proper labeling for screen readers
- **Keyboard navigation**: Full keyboard support
- **Focus management**: Visible focus indicators
- **Color contrast**: High contrast color schemes
- **Screen reader support**: Semantic HTML structure

## Performance Considerations

- Components use React.memo for optimization where appropriate
- Expensive calculations are memoized with useMemo
- Chart data is processed efficiently
- Error boundaries prevent crashes from affecting the entire app

## Testing

Components include comprehensive tests:

- Unit tests for utility functions
- Component integration tests
- Error boundary testing
- Accessibility testing

Run tests with:
```bash
npm test
npm run test:coverage
```
