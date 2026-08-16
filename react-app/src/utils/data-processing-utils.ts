import type { Event, Condition, Config, ViewMode, ChartDataPoint, MilestoneMarker, MiniReward } from '../types';
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
    .map((item) => item.date)
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

  if (event.date) {
    normalized.date = parseLocalCalendarDate(event.date);
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

/**
 * Parse TSV data from Google Sheets
 */
export function parseTSVData(tsvText: string): { config: Config; conditions: Condition[]; data: Event[]; miniRewards: MiniReward[] } {
  const lines = tsvText.trim().split('\n');
  
  // Parse configuration parameters (first few lines)
  const configData: Config = {};
  let conditionsStartIndex = 0;
  let dataStartIndex = 0;
  let miniRewardsStartIndex = -1;
  
  // Look for config lines first
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('\t')) {
      const parts = line.split('\t');
      
      // Check if this looks like a config line (key-value pair)
      if (parts.length >= 2 && !line.match(/^\d{4}-\d{2}-\d{2}/) && !line.includes('condition')) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        configData[key] = value;
        
        // Don't set conditionsStartIndex here, let it be found naturally
      } else if (line.includes('condition') && line.includes('explanation_short') && line.includes('explanation_long')) {
        // Found conditions header
        conditionsStartIndex = i;
      } else if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Found first date line, this is where data starts
        dataStartIndex = i;
        break;
      }
    }
  }
  
  // Parse conditions section
  const conditionsData: Condition[] = [];
  
  if (conditionsStartIndex > 0 && dataStartIndex > conditionsStartIndex) {
    const conditionsLines = lines.slice(conditionsStartIndex, dataStartIndex - 1);
    
    const conditionsHeaders = conditionsLines[0].split('\t').map(h => h.trim());
    
    for (let i = 1; i < conditionsLines.length; i++) {
      const line = conditionsLines[i].trim();
      if (line) {
        const values = line.split('\t').map(v => v.trim());
        const condition: Condition = {};
        
        conditionsHeaders.forEach((header, headerIndex) => {
          (condition as any)[header] = values[headerIndex] || '';
        });
        
        conditionsData.push(condition);
      }
    }
  }
  
  // Find mini reward header if it exists (after data rows)
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [firstCell] = line.split('\t');
    if (firstCell && firstCell.trim() === 'mini_reward_percentage') {
      miniRewardsStartIndex = i;
      break;
    }
  }

  // Parse the actual data starting from the date header
  const dataLines = lines.slice(
    dataStartIndex - 1,
    miniRewardsStartIndex > 0 ? miniRewardsStartIndex : lines.length
  );
  
  if (dataLines.length === 0) {
    return { config: configData, conditions: conditionsData, data: [], miniRewards: [] };
  }
  
  const headers = dataLines[0].split('\t').map(h => h.trim());
  
  const parsedData = dataLines.slice(1).map((line) => {
    const values = line.split('\t').map(v => v.trim());
    const event: Record<string, string> = {};
    
    headers.forEach((header, headerIndex) => {
      event[header] = values[headerIndex] || '';
    });

    return processEventData(event);
  }).filter(event => event.date);
  
  const miniRewards: MiniReward[] = [];
  if (miniRewardsStartIndex > -1) {
    const rewardLines = lines.slice(miniRewardsStartIndex);
    const rewardHeaders = rewardLines[0].split('\t').map(h => h.trim());
    const percentageIndex = rewardHeaders.indexOf('mini_reward_percentage');
    const takenIndex = rewardHeaders.indexOf('mini_reward_taken');

    for (let i = 1; i < rewardLines.length; i++) {
      const line = rewardLines[i].trim();
      if (!line) continue;
      const values = line.split('\t').map(v => v.trim());
      const percentageRaw = values[percentageIndex] || '';
      const percentage = parseNumeric(percentageRaw);
      if (!Number.isFinite(percentage)) {
        continue;
      }
      const takenRaw = values[takenIndex] || '';
      miniRewards.push({
        percentage,
        taken: Boolean(takenRaw),
        takenRaw
      });
    }
  }

  return { config: configData, conditions: conditionsData, data: parsedData, miniRewards };
}

/**
 * Get monthly event data for charts
 */
export function getMonthlyEventData(data: Event[]): Array<{ month: string; events: number }> {
  const monthlyCount: Record<string, number> = {};
  
  data.forEach(event => {
    if (event.date) {
      const monthKey = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}`;
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
    .sort((a, b) => b.date.getTime() - a.date.getTime())
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
    const itemDate = item.date;
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
