# Naming Conventions Guide

This document outlines the naming conventions used in this React/TypeScript project.

## 📁 File and Directory Naming

### React Components
- **Files**: PascalCase with `.tsx` extension
  - ✅ `KPICards.tsx`, `StockCharts.tsx`, `ErrorBoundary.tsx`
  - ❌ `kpiCards.tsx`, `stockCharts.tsx`

- **Directories**: PascalCase for component directories
  - ✅ `KPI/`, `Charts/`, `UI/`
  - ❌ `kpi/`, `charts/`, `ui/`

### Custom Hooks
- **Files**: camelCase starting with 'use' and `.ts` extension
  - ✅ `useData.ts`, `useKPICalculations.ts`, `useFinancialCalculations.ts`
  - ❌ `UseData.ts`, `use-data.ts`

### Utility Functions
- **Files**: kebab-case with `.ts` extension
  - ✅ `date-utils.ts`, `financial-utils.ts`, `accessibility-utils.ts`
  - ❌ `dateUtils.ts`, `financialUtils.ts`

### UI Components (shadcn/ui)
- **Files**: kebab-case with `.tsx` extension
  - ✅ `button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`
  - ❌ `Button.tsx`, `Card.tsx`

### Type Definitions
- **Files**: PascalCase with `.ts` extension
  - ✅ `types/index.ts` (contains multiple types)
  - ✅ `Event.ts`, `Config.ts` (if separate files)

### Configuration Files
- **Files**: kebab-case with `.ts` extension
  - ✅ `app-config.ts`
  - ❌ `appConfig.ts`

### Test Files
- **Files**: kebab-case with `.test.ts` or `.test.tsx` extension
  - ✅ `date-utils.test.ts`, `error-boundary.test.tsx`
  - ❌ `dateUtils.test.ts`, `ErrorBoundary.test.tsx`

## 🏗️ Directory Structure

```
src/
├── components/
│   ├── UI/                    # UI components (PascalCase)
│   │   ├── button.tsx         # kebab-case (shadcn/ui convention)
│   │   ├── card.tsx
│   │   └── input.tsx
│   ├── KPI/                   # KPI components (PascalCase)
│   │   ├── KPICards.tsx       # PascalCase
│   │   ├── WorkProgressCard.tsx
│   │   └── FamilyLeaveCard.tsx
│   ├── Charts/                # Chart components (PascalCase)
│   │   ├── StockCharts.tsx    # PascalCase
│   │   ├── EUNLChart.tsx
│   │   └── ViewModeToggle.tsx
│   └── ErrorBoundary.tsx      # PascalCase
├── hooks/                     # Custom hooks (camelCase)
│   ├── use-data.ts            # kebab-case
│   ├── use-kpi-calculations.ts
│   └── use-financial-calculations.ts
├── utils/                     # Utility functions (camelCase)
│   ├── date-utils.ts          # kebab-case
│   ├── financial-utils.ts
│   └── accessibility-utils.ts
├── types/                     # Type definitions (camelCase)
│   └── index.ts               # PascalCase types inside
├── config/                    # Configuration (camelCase)
│   └── app-config.ts          # kebab-case
└── store/                     # State management (camelCase)
    └── use-app-store.ts       # kebab-case
```

## 🎯 Naming Rules Summary

| Type | Convention | Example | Reason |
|------|------------|---------|---------|
| React Components | PascalCase | `KPICards.tsx` | React convention |
| Component Directories | PascalCase | `KPI/`, `Charts/` | React convention |
| Custom Hooks | camelCase (use*) | `useData.ts` | React hook convention |
| Utility Files | kebab-case | `date-utils.ts` | Standard JS convention |
| UI Components | kebab-case | `button.tsx` | shadcn/ui convention |
| Type Definitions | PascalCase | `Event.ts` | TypeScript convention |
| Test Files | kebab-case | `date-utils.test.ts` | Standard JS convention |
| Config Files | kebab-case | `app-config.ts` | Standard JS convention |

## 🔧 Migration Plan

### Phase 1: Rename Directories
- `components/kpi/` → `components/KPI/`
- `components/charts/` → `components/Charts/`
- `components/ui/` → `components/UI/`

### Phase 2: Rename Utility Files
- `dateUtils.ts` → `date-utils.ts`
- `financialUtils.ts` → `financial-utils.ts`
- `accessibilityUtils.ts` → `accessibility-utils.ts`
- `dataProcessingUtils.ts` → `data-processing-utils.ts`

### Phase 3: Rename Hook Files
- `useKPICalculations.ts` → `use-kpi-calculations.ts`
- `useFinancialCalculations.ts` → `use-financial-calculations.ts`
- `useMemoizedCalculations.ts` → `use-memoized-calculations.ts`

### Phase 4: Rename Config Files
- `appConfig.ts` → `app-config.ts`

### Phase 5: Update Import Statements
Update all import statements to use the new file names.

## ✅ Benefits of Consistent Naming

1. **Predictability**: Developers know exactly how to name new files
2. **Tooling Support**: Better IDE support and autocomplete
3. **Team Consistency**: Everyone follows the same conventions
4. **Framework Alignment**: Matches React/TypeScript best practices
5. **Readability**: Clear distinction between different file types

## 🚫 Common Mistakes to Avoid

- ❌ Mixing conventions within the same project
- ❌ Using camelCase for utility files (use kebab-case)
- ❌ Using kebab-case for React components (use PascalCase)
- ❌ Inconsistent directory naming
- ❌ Not updating imports after renaming files
