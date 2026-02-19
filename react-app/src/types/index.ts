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
  eunl_rate_to_trend?: string | number;
}

export interface Condition {
  condition?: string;
  explanation_short?: string;
  explanation_long?: string;
}

export interface MiniReward {
  percentage: number;
  taken: boolean;
  takenRaw?: string;
}

export interface Config {
  [key: string]: string | undefined;
  investment_goal?: string;
  annual_growth_rate?: string;
  planned_monthly_contribution?: string;
  planned_monthly_contributions_until?: string;
}

export interface ChartDataPoint {
  date: Date;
  dateFormatted: string;
  stocks_in_eur?: number | null;
  stocks_in_eur_adjusted_for_eunl_trend?: number | null;
  targetWithFixedContribution?: number;
  targetWithMinimumContribution?: number | null;
  lineWithMinusOnePercentGrowth?: number | null;
  lineWithPlusOnePercentGrowth?: number | null;
  lineWithTrendGrowth?: number | null;
  lineWithTrendGrowthAndPlannedContribution?: number | null;
  plannedContributionLine?: number | null;
  plannedMinRequiredContribution?: number | null;
  expectedMinRequiredContribution?: number | null;
  minRequiredContribution?: number;
  minRequiredContributionAdjustedForEUNLTrend?: number;
}

export interface TrendStats {
  annualGrowthRate: number;
  standardDeviation: number;
}

export interface IndexDataPoint {
  date: Date;
  value: number | null;
  dateFormatted: string;
  trend?: number;
  trendUpperBound?: number;
  trendLowerBound?: number;
  multiplier?: number | null;
  isAboveUpperBound?: boolean;
  isBelowLowerBound?: boolean;
}

export interface MilestoneMarker {
  x: string;
  y: number;
  label: string;
  condition: number;
  achieved?: boolean;
}

// Component prop types
export interface KPICardsProps {
  data: Event[];
  config: Config;
  miniRewards: MiniReward[];
}

export interface StockChartsProps {
  data: Event[];
  config: Config;
  conditions: Condition[];
  indexDataBySymbol: Record<string, IndexDataPoint[]>;
  indexTrendStatsBySymbol: Record<string, TrendStats | null>;
  onFetchIndexData: () => Promise<void>;
  loading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  averageIndexTrendStats?: TrendStats | null;
  indexError?: string | null;
}

export interface StockChartProps {
  title: string;
  data: ChartDataPoint[];
  progressAxisData?: ChartDataPoint[];
  dataKey: string;
  config: Config;
  milestoneMarkers?: MilestoneMarker[];
  trendAnnualGrowthRate?: number | null;
  rawData?: Event[];
}

export interface IndexHistoryChartProps {
  title: string;
  indexDataBySymbol: Record<string, IndexDataPoint[]>;
  indexTrendStatsBySymbol: Record<string, TrendStats | null>;
  onFetchIndexData?: () => Promise<void>;
  loading: boolean;
  showOnlyDataWithStocks: boolean;
  stocksData: Event[];
  viewMode: ViewMode;
  indexError?: string | null;
}

export interface MinRequiredContributionsChartProps {
  title: string;
  data: ChartDataPoint[];
  fullData?: ChartDataPoint[];
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
  indexDataBySymbol: Record<string, IndexDataPoint[]>;
  indexTrendStatsBySymbol: Record<string, TrendStats | null>;
  averageIndexTrendStats?: TrendStats | null;
  fetchIndexData: () => Promise<void>;
  indexError?: string | null;
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
export type ViewMode = 'recorded' | 'next2years' | 'next5years' | 'full';

export interface MonthlyEventData {
  month: string;
  events: number;
}

export interface CategoryData {
  name: string;
  value: number;
}
