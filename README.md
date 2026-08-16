# Life Events KPI Tracker

Life Events KPI Tracker is a React + TypeScript web app for tracking life events and investment progress. It loads TSV data from a URL (for example, a published Google Sheets export), calculates KPIs, and renders charts for stock value, contribution plans, and index trend analysis.

## Features

- KPI cards for work progress, focused savings, and retirement.
- Stock value chart with target lines, growth scenarios, and reward milestones.
- Minimum required contribution and planned contribution projections.
- Multi-index history with fitted trends and historical ±1σ bands (EUNL from Yahoo Finance plus Morningstar indexes).
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
vercel-proxy/
  api/             # Optional allowlisted index-history endpoint
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

TSV sources must use HTTPS. Plain HTTP is accepted only for exact loopback hosts
(`localhost`, `127.0.0.1`, or `[::1]`) during local development. Loads time out
after 20 seconds and are rejected if they exceed 8 MiB, 50,000 rows, 256 fields
per row, or the documented row/field length limits in
`react-app/src/utils/sheet-data-utils.ts`.

### Expected TSV sections

Configuration (key/value pairs):

```
investment_goal    1000000
annual_growth_rate_near_term 0.10
annual_growth_rate_long_term 0.07
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

## Optional Vercel index endpoint

The app fetches index history automatically through a small Vercel
Function. The old browser/direct/public-proxy flow has not been removed:

1. On startup, the app requests all indexes from `VITE_INDEX_API_URL`. Automatic
   loading is Vercel-only, so an upstream failure produces only a quiet notice and
   never starts the slow public-proxy fallback.
2. Complete automatic results are validated and reused from `sessionStorage` for
   five minutes, while the Vercel CDN provides the longer shared response cache.
3. The manual **Refresh indexes** action requests Vercel first and retains the
   existing implementation as a fallback for failed or missing indexes.
4. Removing `VITE_INDEX_API_URL` and rebuilding restores manual legacy fetching;
   automatic loading then reports that index data is temporarily unavailable.

The endpoint is intentionally not an open proxy. It accepts exactly one `symbol`
parameter whose value must be `all`, `EUNL.DE`, `MSNA`, `MSDE`, or `MSDA`. Upstream
hosts, paths, query keys, and authorization headers are fixed server-side.

### Deploy the proxy on Vercel

1. Create a Vercel account at [vercel.com/signup](https://vercel.com/signup). The
   Hobby plan is intended for personal, non-commercial projects such as this one.
2. In the Vercel dashboard, choose **Add New → Project** and import the
   `onoki/LifeEvents` GitHub repository.
3. Set **Root Directory** to `vercel-proxy` and leave the Framework Preset as
   **Other**. No build command, output directory, API key, or other secret is
   required.
4. Deploy the project. The function is available at:

   ```text
   https://life-events-five.vercel.app/api/index-history
   ```

5. Test it in a browser or terminal:

   ```bash
   curl "https://life-events-five.vercel.app/api/index-history?symbol=all"
   ```

6. In GitHub, open **LifeEvents → Settings → Secrets and variables → Actions →
   Variables**, create a repository variable named `VITE_INDEX_API_URL`, and set
   it to the full function URL from step 4. This URL is public configuration, so
   it should be a variable rather than a secret.
7. Re-run the GitHub Pages workflow or push a new commit. The workflow passes the
   variable to Vite at build time.

The function allows the existing GitHub Pages origin and local Vite origins by
default. If the UI later moves to another origin, set the optional
`ALLOWED_ORIGINS` environment variable in the Vercel project to a comma-separated
list of exact origins, then redeploy. Do not include URL paths in an origin.

The endpoint is public and read-only. CORS limits which browser origins can read
responses, but it is not authentication and does not stop command-line clients or
bots. Before enabling `VITE_INDEX_API_URL` in the production UI, add a Vercel
Firewall rate-limit rule for the endpoint:

1. In the Vercel project, open **Firewall** and choose **Configure → New Rule**.
2. Match the request path `/api/index-history`.
3. Choose **Rate Limit**, a fixed 60-second window, the client IP as the key, and
   an initial limit of 10 requests per minute.
4. Use the default `429` response, publish the rule, and monitor the Firewall and
   Usage views after enabling the frontend.

This distributed rate limit is configured in Vercel rather than `vercel.json`.
Vercel's Hobby plan includes one rate-limit rule per project. The function also
rejects inbound `Authorization` and `Range` headers because they are unnecessary
for this public endpoint and can bypass CDN caching.

Vercel automatically deploys changes pushed to the connected production branch.
The relevant official documentation is available in the
[Vercel Git guide](https://vercel.com/docs/git),
[Functions documentation](https://vercel.com/docs/functions/runtimes/node-js), and
[Hobby plan documentation](https://vercel.com/docs/plans/hobby).

### Repository deployment security

The Pages workflow keeps pull-request builds read-only and grants Pages/OIDC
write permissions only to the main-branch deployment job. Keep the `main` branch
protected in GitHub: require the workflow's build status before merging, disable
force pushes and deletion, and require review when another contributor can push
to the repository. Keep multi-factor authentication enabled for both GitHub and
Vercel accounts.

### Local proxy testing

The proxy has no runtime dependencies. Its unit tests use Node's built-in test
runner:

```bash
cd vercel-proxy
npm test
npx vercel dev --listen 3000
```

To make the local React app try that endpoint first, create
`react-app/.env.local` from `.env.example`, use
`VITE_INDEX_API_URL=http://localhost:3000/api/index-history`, and restart
`npm run dev`.

## Privacy mode

Append `?privacy=true` to hide sensitive values in the UI.

Privacy mode is a project-wide UI requirement: exact user-specific monetary
amounts, dates, configured values, and derived projections must be masked in
descriptive UI such as legends, tooltips, annotations, and summaries. Standalone
public Internet/index data is exempt. Project invariants for future changes are
recorded in `AGENTS.md`.
