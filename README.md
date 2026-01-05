# Life Events KPI Tracker

Life Events KPI Tracker is a React + TypeScript web app for tracking life events and investment progress. It loads TSV data from a URL (for example, a published Google Sheets export), calculates KPIs, and renders charts for stock value, contribution plans, and EUNL trend analysis.

## Features

- KPI cards for work progress, family leave, and retirement.
- Stock value chart with target lines, growth scenarios, and reward milestones.
- Minimum required contribution and planned contribution projections.
- EUNL ETF history with trend and confidence bands (fetched on demand from Yahoo Finance via a CORS proxy).
- Privacy mode via a URL parameter.

## Tech stack

- React 19, TypeScript, Vite
- Tailwind CSS and shadcn/ui
- Recharts for charts
- Zustand for state management
- Jest for tests, ESLint for linting

## Project layout

```
react-app/
  src/
    components/   # UI, KPI, and chart components
    hooks/        # Custom hooks for KPIs and financial calculations
    store/        # Zustand store and async actions
    utils/        # Parsing and calculation utilities
    config/       # App configuration and defaults
```

## Getting started

Prerequisites: Node.js LTS.

```bash
cd react-app
npm install
npm run dev
```

Other useful commands:

```bash
npm run build
npm run preview
npm test
npm run lint
npm run deploy
```

## Data input

The app expects a URL that returns TSV text. For Google Sheets, publish the sheet and use an export URL, for example:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=tsv
```

You can also pass the URL in the page query string:

```
https://your-domain.example/?sheets=<TSV_URL>
```

### Expected TSV sections

Configuration (key/value pairs):

```
investment_goal    1000000
annual_growth_rate 0.07
planned_monthly_contribution 500
planned_monthly_contributions_until 2026-01-01
```

Conditions (header row plus entries):

```
condition  explanation_short  explanation_long
500000     Halfway            Reached the midpoint of the goal
```

Data (header row plus entries):

```
date        stocks_in_eur  event          category  status     duration  eunl_rate_to_trend
2024-01-01  10000          Stock update   Finance   completed  1 day     1.02
```

## Configuration

Default values, dates, and API endpoints live in `react-app/src/config/app-config.ts`.

## Privacy mode

Append `?privacy=true` to hide sensitive values in the UI.
