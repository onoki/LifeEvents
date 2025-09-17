import type { Event, Condition, Config } from '../types';
import { APP_CONFIG } from '../config/app-config';

/**
 * Process and normalize event data
 */
export function processEventData(event: any): Event {
  // Convert date string to Date object
  if (event.date) {
    event.date = new Date(event.date);
  }

  // For stocks data, create some default values for the dashboard
  if (event.stocks_in_eur) {
    event.event = `Stocks Value: ${event.stocks_in_eur}`;
    event.category = 'Finance';
    event.status = 'completed';
    event.duration = '1 day';
    event.durationDays = 1;
  }

  // Parse duration if it exists
  if (event.duration) {
    const durationMatch = event.duration.match(/(\d+)/);
    event.durationDays = durationMatch ? parseInt(durationMatch[1]) : 0;
  } else {
    event.durationDays = 0;
  }

  // Normalize status
  if (event.status) {
    event.status = event.status.toLowerCase();
  }

  // Normalize category
  if (event.category) {
    event.category = event.category.trim();
  }

  return event;
}

/**
 * Parse TSV data from Google Sheets
 */
export function parseTSVData(tsvText: string): { config: Config; conditions: Condition[]; data: Event[] } {
  const lines = tsvText.trim().split('\n');
  
  // Parse configuration parameters (first few lines)
  const configData: Config = {};
  let conditionsStartIndex = 0;
  let dataStartIndex = 0;
  
  // Look for config lines first
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('\t')) {
      const parts = line.split('\t');
      
      // Check if this looks like a config line (key-value pair)
      if (parts.length === 2 && !line.match(/^\d{4}-\d{2}-\d{2}/) && !line.includes('condition')) {
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
  
  // Parse the actual data starting from the date header
  const dataLines = lines.slice(dataStartIndex - 1);
  
  if (dataLines.length === 0) {
    return { config: configData, conditions: conditionsData, data: [] };
  }
  
  const headers = dataLines[0].split('\t').map(h => h.trim());
  
  const parsedData = dataLines.slice(1).map((line, index) => {
    const values = line.split('\t').map(v => v.trim());
    const event: any = {};
    
    headers.forEach((header, headerIndex) => {
      event[header] = values[headerIndex] || '';
    });

    // Normalize and process the data
    return processEventData(event);
  }).filter(event => event.date); // Filter out invalid entries
  
  return { config: configData, conditions: conditionsData, data: parsedData };
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
  viewMode: 'recorded' | 'next2years' | 'full'
): Event[] {
  if (viewMode === 'recorded') {
    // Show only months with stock data
    return data.filter(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0);
  } else if (viewMode === 'next2years') {
    // Show recorded data + next 2 years (limit to exactly 2 years after last stock data)
    const stocksData = data.filter(item => item.stocks_in_eur && parseFloat(item.stocks_in_eur.toString()) > 0);
    if (stocksData.length > 0) {
      const lastStockDate = new Date(stocksData[stocksData.length - 1].date);
      const twoYearsLater = new Date(lastStockDate);
      twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
      // Only show data up to 2 years after the last stock data point
      return data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate <= twoYearsLater;
      });
    } else {
      return data;
    }
  } else {
    // Show full range
    return data;
  }
}

/**
 * Calculate milestone markers for conditions
 */
export function calculateMilestoneMarkers(
  chartData: any[], 
  conditions: Condition[]
): Array<{ x: string; y: number; label: string; condition: number }> {
  const milestoneMarkers: Array<{ x: string; y: number; label: string; condition: number }> = [];
  
  if (conditions && conditions.length > 0) {
    conditions.forEach((condition, index) => {
      const conditionValue = parseFloat(condition.condition || '0');
      if (!isNaN(conditionValue)) {
        // Find the first data point where targetWithMinimumContribution exceeds the condition
        const milestonePoint = chartData.find(item => 
          item.targetWithMinimumContribution && 
          item.targetWithMinimumContribution >= conditionValue
        );
        
        if (milestonePoint) {
          milestoneMarkers.push({
            x: milestonePoint.dateFormatted,
            y: milestonePoint.targetWithMinimumContribution,
            label: condition.explanation_short || 'Unknown',
            condition: conditionValue
          });
        }
      }
    });
  }
  
  return milestoneMarkers;
}
