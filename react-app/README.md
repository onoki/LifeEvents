# Life Events Dashboard

A comprehensive React application for tracking life events, financial progress, and KPI monitoring with real-time calculations and interactive charts.

## 🚀 Features

### Core Functionality
- **Life Events Tracking**: Monitor and categorize important life events
- **Financial Progress**: Track stock investments and retirement planning
- **KPI Dashboard**: Real-time work progress, family leave, and retirement tracking
- **Interactive Charts**: Visualize financial data with multiple chart types
- **Data Integration**: Import data from Google Sheets and Yahoo Finance

### Technical Features
- **TypeScript**: Full type safety throughout the application
- **Modern React**: Built with React 19 and latest hooks
- **State Management**: Zustand for global state management
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Accessibility**: WCAG compliant with keyboard navigation and screen reader support
- **Performance**: Optimized with memoization and efficient rendering
- **Testing**: Comprehensive test suite with Jest and React Testing Library

## 🏗️ Architecture

### Project Structure
```
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components (shadcn/ui)
│   ├── kpi/             # KPI-related components
│   ├── charts/          # Chart components
│   └── ErrorBoundary.tsx # Error handling
├── hooks/               # Custom React hooks
├── store/               # Zustand state management
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
├── config/              # Application configuration
└── styles/              # CSS and styling
```

### Key Components

#### KPI Components
- **WorkProgressCard**: Real-time work day progress tracking
- **FamilyLeaveCard**: Family leave period monitoring
- **RetirementCard**: Retirement planning and progress

#### Chart Components
- **StockChart**: Interactive stock value visualization
- **EUNLChart**: ETF price history with trend analysis
- **MinRequiredContributionsChart**: Investment contribution planning

#### Data Management
- **useAppStore**: Global state management with Zustand
- **useData**: Data loading and processing
- **useKPICalculations**: Real-time KPI calculations
- **useFinancialCalculations**: Financial data processing

## 🛠️ Technology Stack

### Core Technologies
- **React 19**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework

### UI Components
- **shadcn/ui**: Modern component library
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library

### Data Visualization
- **Recharts**: React charting library
- **CountUp.js**: Animated number counting

### State Management & Data
- **Zustand**: Lightweight state management
- **Fetch API**: Data fetching
- **TSV Parsing**: Google Sheets integration

### Development Tools
- **ESLint**: Code linting
- **Jest**: Testing framework
- **React Testing Library**: Component testing
- **TypeScript**: Static type checking

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd react-app

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🚀 Usage

### Basic Usage
1. **Load Data**: Enter a Google Sheets URL to load your data
2. **View KPIs**: Monitor work progress, family leave, and retirement
3. **Analyze Charts**: Explore financial data with interactive charts
4. **Track Progress**: Set goals and monitor achievement

### Google Sheets Format
Your Google Sheets should have the following structure:
```
date        | event              | category | status    | duration | stocks_in_eur
2024-01-01  | Started new job    | Work     | completed | 1 day    | 1000
2024-02-01  | Stock purchase     | Finance  | completed | 1 day    | 1500
```

### Configuration
Modify `src/config/appConfig.ts` to customize:
- Work schedule hours
- Important dates (family leave, retirement)
- API endpoints
- Default values
- Error messages

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Utility functions and calculations
- **Component Tests**: React component behavior
- **Integration Tests**: Hook and store functionality
- **Error Boundary Tests**: Error handling scenarios

## ♿ Accessibility

### Features
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: ARIA labels and semantic HTML
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects user motion preferences
- **Focus Management**: Proper focus indicators and management

### Compliance
- WCAG 2.1 AA compliant
- Semantic HTML structure
- Proper color contrast ratios
- Accessible form controls

## 🎨 Styling

### Design System
- **CSS Variables**: Customizable theme colors
- **Dark Mode**: Built-in dark theme support
- **Responsive Design**: Mobile-first approach
- **Component Variants**: Consistent styling patterns

### Customization
- Modify `src/index.css` for global styles
- Update `tailwind.config.js` for design tokens
- Use CSS variables for theme customization

## 📊 Performance

### Optimizations
- **React.memo**: Component memoization
- **useMemo**: Expensive calculation caching
- **useCallback**: Function reference stability
- **Lazy Loading**: Code splitting for large components
- **Bundle Optimization**: Vite's built-in optimizations

### Monitoring
- Bundle size analysis
- Runtime performance monitoring
- Memory usage optimization
- Render performance tracking

## 🔧 Configuration

### Environment Variables
```env
VITE_API_BASE_URL=your_api_url
VITE_GOOGLE_SHEETS_API_KEY=your_api_key
```

### Build Configuration
- **Vite Config**: `vite.config.js`
- **TypeScript Config**: `tsconfig.json`
- **Tailwind Config**: `tailwind.config.js`
- **Jest Config**: `jest.config.js`

## 🚀 Deployment

### Build
```bash
npm run build
```

### Deployment Options
- **Static Hosting**: Vercel, Netlify, GitHub Pages
- **Docker**: Containerized deployment
- **CDN**: Global content delivery

### Environment Setup
1. Configure environment variables
2. Set up CI/CD pipeline
3. Configure domain and SSL
4. Set up monitoring and analytics

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting and tests
5. Submit a pull request

### Code Standards
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Conventional commits
- Test coverage requirements

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **shadcn/ui** for the component library
- **Radix UI** for accessible primitives
- **Recharts** for charting capabilities
- **Tailwind CSS** for styling utilities
- **React Team** for the amazing framework

## 📞 Support

For questions, issues, or contributions:
- Create an issue on GitHub
- Check the documentation
- Review the test examples
- Contact the maintainers

---

Built with ❤️ using modern React and TypeScript