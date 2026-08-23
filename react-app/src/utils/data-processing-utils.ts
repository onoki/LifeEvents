import type {
  AfterGoalMonthlyCost,
  Event,
  Condition,
  Config,
  ViewMode,
  ChartDataPoint,
  MilestoneMarker,
  MiniReward,
} from '../types';
import { APP_CONFIG } from '../config/app-config';
import { parseNumeric } from './number-utils';
import { parseLocalCalendarDate } from './date-utils';

export interface ChartDateRange {
  /** Null means that the range has no lower bound. */
  min: Date | null;
  /** Null means that the range has no upper bound. */
  max: Date | null;
}

const FULL_CHART_DATE_RANGE: ChartDateRange = { min: null, max: null };

const startOfLocalDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

/** Add calendar years while keeping leap-day values within the target month. */
const addCalendarYears = (date: Date, years: number): Date => {
  const targetYear = date.getFullYear() + years;
  const targetMonth = date.getMonth();
  const lastDayInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(
    targetYear,
    targetMonth,
    Math.min(date.getDate(), lastDayInTargetMonth)
  );
};

/**
 * Resolve the end of the planned-period view. A null value means that the
 * configured date is invalid, or that its one-year buffer does not reach
 * beyond today and the view should therefore be omitted.
 */
export function getPlannedEndPlusOneYear(
  config: Config,
  now: Date = new Date()
): Date | null {
  const rawPlannedEnd = config.planned_monthly_contributions_until;
  if (!rawPlannedEnd) return null;

  const plannedEnd = parseLocalCalendarDate(rawPlannedEnd);
  if (Number.isNaN(plannedEnd.getTime())) return null;

  const bufferedEnd = addCalendarYears(startOfLocalDay(plannedEnd), 1);
  return bufferedEnd > startOfLocalDay(now) ? bufferedEnd : null;
}

export function isPlannedEndPlusOneYearAvailable(
  config: Config,
  now: Date = new Date()
): boolean {
  return getPlannedEndPlusOneYear(config, now) !== null;
}

/**
 * Derive one shared X range for all financial charts and the index-history
 * chart. The `now` argument is injectable so date-sensitive behavior remains
 * deterministic in tests.
 *
 * If a planned-period view becomes unavailable while selected, it falls back
 * to the default next-two-years horizon. Full range is explicitly unbounded.
 */
export function getChartDateRange(
  data: Event[],
  config: Config,
  viewMode: ViewMode,
  now: Date = new Date()
): ChartDateRange {
  if (viewMode === 'full') {
    return FULL_CHART_DATE_RANGE;
  }

  const stockDates = data
    .filter((item) => item.stocks_in_eur && parseNumeric(item.stocks_in_eur) > 0)
    .map((item) => item.investment_date)
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()));

  if (stockDates.length === 0) {
    return FULL_CHART_DATE_RANGE;
  }

  const firstStockDate = new Date(Math.min(...stockDates.map((date) => date.getTime())));
  const latestStockDate = new Date(Math.max(...stockDates.map((date) => date.getTime())));
  const min = new Date(firstStockDate.getFullYear(), firstStockDate.getMonth() - 1, 1);

  if (viewMode === 'recorded') {
    return { min, max: latestStockDate };
  }

  const defaultEnd = addCalendarYears(startOfLocalDay(now), 2);
  if (viewMode === 'planned') {
    return {
      min,
      max: getPlannedEndPlusOneYear(config, now) ?? defaultEnd,
    };
  }

  return { min, max: defaultEnd };
}

/**
 * Process and normalize event data
 */
export function processEventData(event: Record<string, string>): Event {
  const normalized: Event = {
    ...event,
  } as unknown as Event;

  if (event.investment_date) {
    normalized.investment_date = parseLocalCalendarDate(event.investment_date);
  }

  if (event.stocks_in_eur) {
    normalized.event = `Stocks Value: ${event.stocks_in_eur}`;
    normalized.category = 'Finance';
    normalized.status = 'completed';
    normalized.duration = '1 day';
    normalized.durationDays = 1;
  }

  if (event.duration) {
    const durationMatch = event.duration.match(/(\d+)/);
    normalized.durationDays = durationMatch ? parseInt(durationMatch[1]) : 0;
  } else {
    normalized.durationDays = 0;
  }

  if (event.status) {
    normalized.status = event.status.toLowerCase();
  }

  if (event.category) {
    normalized.category = event.category.trim();
  }

  return normalized;
}

export interface ParsedTSVData {
  config: Config;
  conditions: Condition[];
  data: Event[];
  miniRewards: MiniReward[];
  afterGoalMonthlyCosts: AfterGoalMonthlyCost[];
}

type SheetSection = 'conditions' | 'investments' | 'miniRewards' | 'afterGoalMonthlyCosts';

interface SheetRow {
  cells: string[];
  isBlank: boolean;
}

const CONDITIONS_HEADERS = ['condition', 'explanation_short', 'explanation_long'] as const;
const MINI_REWARDS_HEADERS = ['mini_reward_percentage', 'mini_reward_taken'] as const;
const AFTER_GOAL_MONTHLY_COST_HEADERS = [
  'after_goal_monthly_category',
  'after_goal_monthly_sum',
  'after_goal_monthly_skip_inflation',
] as const;
const CONFIG_KEYS = new Set([
  'investment_goal',
  'annual_growth_rate_near_term',
  'annual_growth_rate_long_term',
  'annual_inflation_rate',
  'effective_capital_income_tax_rate',
  'planned_monthly_contribution',
  'planned_monthly_contributions_until',
]);

const hasExactHeaders = (cells: string[], headers: readonly string[]): boolean => (
  headers.every((header, index) => cells[index] === header)
  && cells.slice(headers.length).every((cell) => cell === '')
);

const getSection = (cells: string[]): SheetSection | null => {
  if (hasExactHeaders(cells, CONDITIONS_HEADERS)) return 'conditions';
  if (hasExactHeaders(cells, MINI_REWARDS_HEADERS)) return 'miniRewards';
  if (hasExactHeaders(cells, AFTER_GOAL_MONTHLY_COST_HEADERS)) return 'afterGoalMonthlyCosts';
  if (cells.includes('investment_date') && cells.includes('stocks_in_eur')) return 'investments';
  return null;
};

const isConfigRow = (cells: string[]): boolean => (
  CONFIG_KEYS.has(cells[0] ?? '')
  && Boolean(cells[1])
  && cells.slice(2).every((cell) => cell === '')
);

const parseMonthlySum = (rawValue: string): number | null => {
  const normalized = rawValue.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/**
 * Parse TSV data from Google Sheets
 */
export function parseTSVData(tsvText: string): ParsedTSVData {
  const rows: SheetRow[] = tsvText.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => {
    const cells = line.split('\t').map((cell) => cell.trim());
    return { cells, isBlank: cells.every((cell) => cell === '') };
  });
  const sectionByHeaderIndex = new Map<number, SheetSection>();
  rows.forEach((row, index) => {
    const section = getSection(row.cells);
    if (section) sectionByHeaderIndex.set(index, section);
  });

  const legacyDateHeader = rows.some((row) => (
    row.cells.includes('date') && row.cells.includes('stocks_in_eur')
  ));
  if (legacyDateHeader) {
    throw new Error(
      'Investment data must use the "investment_date" header; the legacy "date" header is not supported.'
    );
  }

  const investmentHeaderEntry = [...sectionByHeaderIndex.entries()]
    .find(([, section]) => section === 'investments');
  if (!investmentHeaderEntry) {
    throw new Error('Missing required investment data header "investment_date".');
  }

  const sectionRows = new Map<number, number[]>();
  const consumedRowIndexes = new Set<number>();
  sectionByHeaderIndex.forEach((_section, headerIndex) => {
    consumedRowIndexes.add(headerIndex);
    const dataRowIndexes: number[] = [];
    for (let index = headerIndex + 1; index < rows.length; index++) {
      if (
        rows[index].isBlank
        || sectionByHeaderIndex.has(index)
        || isConfigRow(rows[index].cells)
      ) break;
      dataRowIndexes.push(index);
      consumedRowIndexes.add(index);
    }
    sectionRows.set(headerIndex, dataRowIndexes);
  });

  const configData: Config = {};
  rows.forEach((row, index) => {
    if (row.isBlank || consumedRowIndexes.has(index)) return;
    const [key = '', value = ''] = row.cells;
    if (key && row.cells.length >= 2) configData[key] = value;
  });

  const conditionsData: Condition[] = [];
  const parsedData: Event[] = [];
  const miniRewards: MiniReward[] = [];
  const afterGoalMonthlyCosts: AfterGoalMonthlyCost[] = [];

  sectionByHeaderIndex.forEach((section, headerIndex) => {
    const headerCells = rows[headerIndex].cells;
    const bodyRows = (sectionRows.get(headerIndex) ?? []).map((index) => rows[index].cells);

    if (section === 'conditions') {
      bodyRows.forEach((cells) => {
        const condition: Condition = {};
        CONDITIONS_HEADERS.forEach((header, index) => {
          condition[header] = cells[index] || '';
        });
        if (Object.values(condition).some(Boolean)) conditionsData.push(condition);
      });
      return;
    }

    if (section === 'investments') {
      bodyRows.forEach((cells) => {
        const event: Record<string, string> = {};
        headerCells.forEach((header, index) => {
          event[header] = cells[index] || '';
        });
        const normalizedEvent = processEventData(event);
        if (
          normalizedEvent.investment_date instanceof Date
          && !Number.isNaN(normalizedEvent.investment_date.getTime())
        ) {
          parsedData.push(normalizedEvent);
        }
      });
      return;
    }

    if (section === 'miniRewards') {
      bodyRows.forEach((cells) => {
        const percentageRaw = cells[0] || '';
        const percentage = parseNumeric(percentageRaw);
        if (!Number.isFinite(percentage)) return;
        const takenRaw = cells[1] || '';
        miniRewards.push({
          percentage,
          taken: Boolean(takenRaw),
          takenRaw,
        });
      });
      return;
    }

    bodyRows.forEach((cells) => {
      const category = cells[0]?.trim() ?? '';
      const monthlySum = parseMonthlySum(cells[1] ?? '');
      const skipInflationRaw = cells[2]?.trim().toLowerCase() ?? '';
      if (!category || monthlySum === null || !['', 'x'].includes(skipInflationRaw)) return;
      afterGoalMonthlyCosts.push({
        category,
        monthlySum,
        skipInflation: skipInflationRaw === 'x',
      });
    });
  });

  return {
    config: configData,
    conditions: conditionsData,
    data: parsedData,
    miniRewards,
    afterGoalMonthlyCosts,
  };
}

/**
 * Get monthly event data for charts
 */
export function getMonthlyEventData(data: Event[]): Array<{ month: string; events: number }> {
  const monthlyCount: Record<string, number> = {};
  
  data.forEach(event => {
    if (event.investment_date) {
      const monthKey = `${event.investment_date.getFullYear()}-${String(event.investment_date.getMonth() + 1).padStart(2, '0')}`;
      monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
    }
  });

  const sortedMonths = Object.keys(monthlyCount).sort();
  return sortedMonths.map(month => {
    const [year, monthNum] = month.split('-');
    return {
      month: new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', APP_CONFIG.DATA.DATE_FORMAT_OPTIONS_MONTH_ONLY),
      events: monthlyCount[month]
    };
  });
}

/**
 * Get category distribution data for charts
 */
export function getCategoryData(data: Event[]): Array<{ name: string; value: number }> {
  const categoryCount: Record<string, number> = {};
  
  data.forEach(event => {
    const category = event.category || 'Uncategorized';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  return Object.entries(categoryCount).map(([name, value]) => ({
    name,
    value
  }));
}

/**
 * Get recent events sorted by date
 */
export function getRecentEvents(data: Event[], limit: number = APP_CONFIG.UI.MAX_RECENT_EVENTS): Event[] {
  return data
    .sort((a, b) => b.investment_date.getTime() - a.investment_date.getTime())
    .slice(0, limit);
}

/**
 * Filter data based on view mode
 */
export function filterDataByViewMode(
  data: Event[],
  viewMode: ViewMode,
  config: Config = {},
  now: Date = new Date()
): Event[] {
  const range = getChartDateRange(data, config, viewMode, now);
  if (range.min === null && range.max === null) {
    if (viewMode === 'recorded') {
      return [];
    }
    return data;
  }

  return data.filter((item) => {
    const itemDate = item.investment_date;
    if (!(itemDate instanceof Date) || Number.isNaN(itemDate.getTime())) return false;
    if (range.min && itemDate < range.min) return false;
    if (range.max && itemDate > range.max) return false;
    return true;
  });
}

/**
 * Calculate milestone markers for conditions
 */
export function calculateMilestoneMarkers(
  chartData: ChartDataPoint[], 
  conditions: Condition[]
): MilestoneMarker[] {
  const milestoneMarkers: MilestoneMarker[] = [];

  if (!conditions || conditions.length === 0 || !chartData || chartData.length === 0) {
    return milestoneMarkers;
  }

  conditions.forEach((condition) => {
    const conditionValue = parseNumeric(condition.condition || '0');
    if (!Number.isFinite(conditionValue)) {
      return;
    }

    const achievedPoint = chartData.find((item) => {
      const adjustedValue = item.stocks_in_eur_adjusted_for_eunl_trend;
      return typeof adjustedValue === 'number' && Number.isFinite(adjustedValue) && adjustedValue >= conditionValue;
    });

    if (achievedPoint) {
      milestoneMarkers.push({
        x: achievedPoint.dateFormatted,
        y: achievedPoint.stocks_in_eur_adjusted_for_eunl_trend as number,
        label: condition.explanation_short || 'Unknown',
        condition: conditionValue,
        achieved: true
      });
      return;
    }

    const projectedPoint = chartData.find((item) => {
      const targetValue = item.targetWithMinimumContribution;
      return typeof targetValue === 'number' && Number.isFinite(targetValue) && targetValue >= conditionValue;
    });

    if (projectedPoint) {
      milestoneMarkers.push({
        x: projectedPoint.dateFormatted,
        y: projectedPoint.targetWithMinimumContribution as number,
        label: condition.explanation_short || 'Unknown',
        condition: conditionValue,
        achieved: false
      });
    }
  });

  return milestoneMarkers;
}
