# Life Events KPI Tracker

A modern React-based web application for tracking financial KPIs and investment progress by fetching data from Google Sheets. Features interactive charts, confidence intervals, and comprehensive financial analysis tools.

## Features

- 📊 **KPI Dashboard**: Track investment goals, retirement planning, and work progress
- 📈 **Interactive Charts**: Visualize stock performance with exponential trend lines and confidence intervals
- 🎯 **Financial Analysis**: Calculate target contributions, minimum required contributions, and growth scenarios
- 📱 **Mobile Optimized**: Responsive design that works perfectly on mobile browsers
- 🎨 **Modern UI**: Built with shadcn/ui design system and Tailwind CSS
- 📋 **Google Sheets Integration**: Fetch real-time data from Google Sheets
- 🔄 **Real-time Updates**: Refresh data anytime with live EUNL ETF data
- 📊 **Confidence Intervals**: Statistical analysis showing when stock values deviate from trend
- 🧮 **Advanced Calculations**: Exponential trend analysis and financial projections

## Technologies Used

- **React 19**: Modern React with hooks and functional components
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern component design system
- **Recharts**: Interactive charts and data visualization
- **Zustand**: State management
- **Jest**: Testing framework
- **Docker**: Containerized deployment

## Setup Instructions

### Development Setup

1. **Prerequisites**:
   - Node.js 20+ 
   - npm or yarn

2. **Install Dependencies**:
   ```bash
   cd react-app
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   ```

### Docker Setup

1. **Build and Run with Docker**:
   ```bash
   docker-compose up --build -d
   ```

2. **Update Application**:
   ```bash
   docker-compose up --build -d
   ```

## Data Format

Your Google Sheet should have the following sections:

### Configuration Section
| Column | Description | Example |
|--------|-------------|---------|
| `investment_goal` | Target investment amount | 100000 |
| `annual_growth_rate` | Expected annual growth rate | 0.08 |

### Conditions Section
| Column | Description | Example |
|--------|-------------|---------|
| `condition` | Condition name | Early Retirement |
| `explanation_short` | Brief explanation | Retire at 55 |
| `explanation_long` | Detailed explanation | Retire at 55 with full benefits |

### Stock Information Section
| Column | Description | Example |
|--------|-------------|---------|
| `date` | Transaction date | 2024-01-15 |
| `stocks_in_eur` | Stock value in EUR | 25000 |
| `event` | Event description | Bonus Investment |
| `category` | Event category | Work |
| `status` | Event status | completed |
| `duration` | Event duration | 1 day |

## Features Overview

### KPI Cards
- **Family Leave**: Track family leave days and remaining balance
- **Retirement**: Monitor retirement progress and target dates
- **Work Progress**: Analyze work-related events and milestones

### Interactive Charts
- **Stock Performance**: Visualize investment growth over time
- **EUNL ETF Analysis**: Historical data with exponential trend lines
- **Confidence Intervals**: Statistical analysis showing when values deviate from trend
- **Growth Scenarios**: Multiple growth rate projections (±1%)

### Financial Calculations
- **Target Contributions**: Calculate required monthly contributions
- **Minimum Required**: Determine minimum contributions to reach goals
- **Trend Analysis**: Exponential regression with confidence intervals
- **Scenario Planning**: Different growth rate scenarios

## URL Format

Access the application with a Google Sheets URL:
```
https://your-domain.com?sheets=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run lint` - Run linter

### Project Structure

```
react-app/
├── src/
│   ├── components/          # React components
│   │   ├── Charts/         # Chart components
│   │   ├── KPI/           # KPI card components
│   │   └── UI/            # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── store/             # Zustand state management
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   └── config/            # Application configuration
├── public/                # Static assets
└── dist/                 # Build output
```

## Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Common Issues

1. **"Failed to load data" error**:
   - Ensure your Google Sheet is publicly accessible
   - Check that the sheet has the required sections
   - Verify the data format matches expectations

2. **Charts not displaying**:
   - Check browser console for JavaScript errors
   - Ensure you have a stable internet connection
   - Try refreshing the page

3. **Docker build issues**:
   - Ensure Docker is running
   - Check that Node.js 20+ is available
   - Try rebuilding with `docker-compose up --build -d`

### Getting Help

If you encounter issues:
1. Check the browser's developer console for error messages
2. Verify your Google Sheets URL is accessible
3. Ensure your data format matches the expected structure
4. Check Docker logs: `docker-compose logs`

## License

This project is open source and available under the MIT License.