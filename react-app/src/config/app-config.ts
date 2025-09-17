// Application configuration constants
export const APP_CONFIG = {
  // Work schedule
  WORK_SCHEDULE: {
    START_HOUR: 8,
    START_MINUTE: 30,
    END_HOUR: 16,
    END_MINUTE: 30,
    DAYS_PER_WEEK: 5, // Monday to Friday
  },

  // Important dates
  DATES: {
    FAMILY_LEAVE_START: '2024-06-24T08:30:00',
    FAMILY_LEAVE_END: '2025-12-05T17:30:00',
    RETIREMENT_START: '2013-11-18T08:00:00',
    RETIREMENT_END: '2043-02-19T17:00:00',
    // Customizable dates
    FAMILY_LEAVE_TARGET: '2024-12-25', // Christmas
    RETIREMENT_TARGET: '2050-01-01',
  },

  // Vacation settings
  VACATION: {
    MONTH: 6, // July (0-indexed)
    WEEKS: 5, // First 5 weeks of July
    DAYS_PER_WEEK: 7,
  },

  // External API endpoints
  API: {
    CORS_PROXY: 'https://api.allorigins.win/raw?url=',
    YAHOO_FINANCE_BASE: 'https://query1.finance.yahoo.com/v8/finance/chart',
    EUNL_SYMBOL: 'EUNL.DE',
    YAHOO_FINANCE_PERIODS: {
      START: 1253862000, // 2009-09-25
      END: 2546985600,   // 2050-09-25
    },
  },

  // Chart and UI settings
  UI: {
    CHART_HEIGHT: 300,
    COUNTUP_DURATION: 1,
    UPDATE_INTERVAL: 60000, // 1 minute
    MAX_RECENT_EVENTS: 10,
  },

  // Default values
  DEFAULTS: {
    INVESTMENT_GOAL: 1000000, // 1 million EUR
    ANNUAL_GROWTH_RATE: 0.07, // 7%
    MONTHLY_GROWTH_RATE: 0.07 / 12,
  },

  // Error messages
  ERRORS: {
    NO_DATA: 'No data found in the sheet',
    INVALID_URL: 'Please enter a valid Google Sheets URL',
    FETCH_FAILED: 'Failed to fetch data',
    INVALID_DATA_FORMAT: 'Invalid data format from external API',
  },

  // Data processing
  DATA: {
    DATE_FORMAT_OPTIONS: {
      month: 'short' as const,
      year: '2-digit' as const,
    },
    DATE_FORMAT_OPTIONS_WITH_DAY: {
      year: 'numeric' as const,
      month: 'short' as const,
      day: 'numeric' as const,
    },
    DATE_FORMAT_OPTIONS_MONTH_ONLY: {
      month: 'short' as const,
      year: 'numeric' as const,
    },
  },
} as const;

// Type definitions for configuration
export type WorkSchedule = typeof APP_CONFIG.WORK_SCHEDULE;
export type Dates = typeof APP_CONFIG.DATES;
export type Vacation = typeof APP_CONFIG.VACATION;
export type API = typeof APP_CONFIG.API;
export type UI = typeof APP_CONFIG.UI;
export type Defaults = typeof APP_CONFIG.DEFAULTS;
export type Errors = typeof APP_CONFIG.ERRORS;
export type DataConfig = typeof APP_CONFIG.DATA;
