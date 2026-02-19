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
    RETIREMENT_START: '2013-11-18T08:00:00',
    RETIREMENT_END: '2043-02-19T17:00:00',
    // Customizable dates
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
    YAHOO_FINANCE_BASE: 'https://query1.finance.yahoo.com/v8/finance/chart',
    EUNL_SYMBOL: 'EUNL.DE',
    // Keep multiple CORS proxies so one outage does not break index fetching.
    CORS_PROXIES: [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://api.codetabs.com/v1/proxy?quest=',
    ],
    REQUEST_TIMEOUT_MS: 15000,
    YAHOO_FINANCE_PERIODS: {
      START: 1253862000, // 2009-09-25
      END: 2546985600,   // 2050-09-25
    },
    MORNINGSTAR: {
      AUTH_PAGE_URL: 'https://indexes.morningstar.com/indexes/details/morningstar-developed-europe-screened-select-150-eur-FS0000JKWD?currency=EUR&tab=overview&variant=NR',
      TIMESERIES_BASE: 'https://www.us-api.morningstar.com/QS-markets/chartservice/v2/timeseries',
      START_DATE: '1900-01-01',
      TRACK_MARKET_DATA: '3.6.3',
      INST_ID: 'MSIND',
      FREQUENCY: 'm',
    },
    INDEX_SERIES: [
      {
        symbol: 'EUNL.DE',
        displayName: 'EUNL ETF',
        shortLabel: 'EUNL',
        source: 'yahoo',
        sourceUrl: 'https://finance.yahoo.com/quote/EUNL.DE/',
        color: '#3b82f6',
      },
      {
        symbol: 'MSNA',
        displayName: 'Morningstar North America Sustainability Screened Select NR USD',
        shortLabel: 'MSNA',
        source: 'morningstar',
        queryKey: 'F00001QK3I',
        sourceUrl: 'https://www.us-api.morningstar.com/QS-markets/chartservice/v2/timeseries?query=F00001QK3I:open,high,low,close,volume,previousClose&frequency=m&startDate=1900-01-01&endDate=2026-02-18&trackMarketData=3.6.3&instid=MSIND',
        color: '#22c55e',
      },
      {
        symbol: 'MSDE',
        displayName: 'Morningstar Developed Europe Screened Select 150 (EUR) NR EUR',
        shortLabel: 'MSDE',
        source: 'morningstar',
        queryKey: 'F00001QK2I',
        sourceUrl: 'https://indexes.morningstar.com/indexes/details/morningstar-developed-europe-screened-select-150-eur-FS0000JKWD?currency=EUR&tab=overview&variant=NR',
        color: '#f97316',
      },
      {
        symbol: 'MSDA',
        displayName: 'Morningstar Developed Asia Pacific ex Korea Sustainability Screened NR USD',
        shortLabel: 'MSDA',
        source: 'morningstar',
        queryKey: 'F00001QK46',
        sourceUrl: 'https://www.us-api.morningstar.com/QS-markets/chartservice/v2/timeseries?query=F00001QK46:open,high,low,close,volume,previousClose&frequency=m&startDate=1900-01-01&endDate=2026-02-18&trackMarketData=3.6.3&instid=MSIND',
        color: '#a855f7',
      },
    ],
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
