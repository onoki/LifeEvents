// Core data types
export interface Event {
  date: Date;
  event?: string;
  name?: string;
  title?: string;
  category?: string;
  status?: string;
  duration?: string;
  durationDays?: number;
  stocks_in_eur?: string | number;
}

export interface Condition {
  condition?: string;
  explanation_short?: string;
  explanation_long?: string;
}

export interface Config {
  [key: string]: string | undefined;
  investment_goal?: string;
  annual_growth_rate?: string;
}

export interface ChartDataPoint {
  date: Date;
  dateFormatted: string;
  stocks_in_eur?: number | null;
  targetWithFixedContribution?: number;
  targetWithMinimumContribution?: number | null;
  lineWithMinusOnePercentGrowth?: number | null;
  lineWithPlusOnePercentGrowth?: number | null;
  minRequiredContribution?: number;
}

export interface EUNLDataPoint {
  date: Date;
  price: number | null;
  dateFormatted: string;
  trend?: number;
}

export interface MilestoneMarker {
  x: string;
  y: number;
  label: string;
  condition: number;
}

// Component prop types
export interface KPICardsProps {
  data: Event[];
  config: Config;
  conditions: Condition[];
}

export interface StockChartsProps {
  data: Event[];
  config: Config;
  conditions: Condition[];
  eunlData: EUNLDataPoint[];
  onFetchEUNL: () => Promise<void>;
  loading: boolean;
}

export interface StockChartProps {
  title: string;
  data: ChartDataPoint[];
  dataKey: string;
  config: Config;
  conditions: Condition[];
  rawData?: Event[];
}

export interface EUNLChartProps {
  title: string;
  data: EUNLDataPoint[];
  onFetchEUNL?: () => Promise<void>;
  loading: boolean;
  showOnlyDataWithStocks: boolean;
  stocksData: Event[];
  viewMode: 'recorded' | 'next2years' | 'full';
}

export interface MinRequiredContributionsChartProps {
  title: string;
  data: ChartDataPoint[];
  config: Config;
}

export interface RecentEventsTableProps {
  data: Event[];
}

export interface KPIChartProps {
  data: Event[];
  type: 'line' | 'pie';
}

export interface EventsOverTimeChartProps {
  data: Event[];
}

export interface CategoryDistributionChartProps {
  data: Event[];
}

// Hook return types
export interface UseDataReturn {
  data: Event[];
  config: Config;
  conditions: Condition[];
  loading: boolean;
  error: string | null;
  status: string;
  loadData: (url: string) => Promise<void>;
  eunlData: EUNLDataPoint[];
  fetchEUNLData: () => Promise<void>;
}

// API response types
export interface YahooFinanceResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
  };
}

// Utility types
export type ViewMode = 'recorded' | 'next2years' | 'full';

export interface MonthlyEventData {
  month: string;
  events: number;
}

export interface CategoryData {
  name: string;
  value: number;
}
