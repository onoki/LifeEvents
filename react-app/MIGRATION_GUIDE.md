# Naming Convention Migration Guide

## 🎯 Current Issues Identified

You're absolutely right! There are significant naming inconsistencies in the codebase:

### ❌ **Current Inconsistencies:**

1. **Component Directories**: 
   - `components/kpi/` → Should be `components/KPI/`
   - `components/charts/` → Should be `components/Charts/`
   - `components/ui/` → Should be `components/UI/`

2. **Utility Files**:
   - `dateUtils.ts` → Should be `date-utils.ts`
   - `financialUtils.ts` → Should be `financial-utils.ts`
   - `accessibilityUtils.ts` → Should be `accessibility-utils.ts`
   - `dataProcessingUtils.ts` → Should be `data-processing-utils.ts`

3. **Hook Files**:
   - `useKPICalculations.ts` → Should be `use-kpi-calculations.ts`
   - `useFinancialCalculations.ts` → Should be `use-financial-calculations.ts`
   - `useMemoizedCalculations.ts` → Should be `use-memoized-calculations.ts`

4. **Config Files**:
   - `appConfig.ts` → Should be `app-config.ts`

5. **Import Statements**: All imports need to be updated to use new file names

## ✅ **Proper Naming Conventions:**

### **React Components (Files & Directories):**
- **PascalCase**: `KPICards.tsx`, `StockCharts.tsx`, `ErrorBoundary.tsx`
- **PascalCase directories**: `KPI/`, `Charts/`, `UI/`

### **Utilities:**
- **kebab-case**: `date-utils.ts`, `financial-utils.ts`, `accessibility-utils.ts`

### **Hooks:**
- **kebab-case**: `use-kpi-calculations.ts`, `use-financial-calculations.ts`

### **Config:**
- **kebab-case**: `app-config.ts`

### **UI Components (shadcn/ui):**
- **kebab-case**: `button.tsx`, `card.tsx`, `input.tsx` (already correct)

## 🔧 **Migration Steps:**

### **Step 1: Create New Directory Structure**
```bash
mkdir src/components/KPI
mkdir src/components/Charts  
mkdir src/components/UI
```

### **Step 2: Move Files with Correct Names**
```bash
# Move KPI components
mv src/components/kpi/* src/components/KPI/

# Move Chart components  
mv src/components/charts/* src/components/Charts/

# Move UI components
mv src/components/ui/* src/components/UI/

# Remove old directories
rmdir src/components/kpi
rmdir src/components/charts
rmdir src/components/ui
```

### **Step 3: Rename Utility Files**
```bash
mv src/utils/dateUtils.ts src/utils/date-utils.ts
mv src/utils/financialUtils.ts src/utils/financial-utils.ts
mv src/utils/accessibilityUtils.ts src/utils/accessibility-utils.ts
mv src/utils/dataProcessingUtils.ts src/utils/data-processing-utils.ts
```

### **Step 4: Rename Hook Files**
```bash
mv src/hooks/useKPICalculations.ts src/hooks/use-kpi-calculations.ts
mv src/hooks/useFinancialCalculations.ts src/hooks/use-financial-calculations.ts
mv src/hooks/useMemoizedCalculations.ts src/hooks/use-memoized-calculations.ts
```

### **Step 5: Rename Config Files**
```bash
mv src/config/appConfig.ts src/config/app-config.ts
```

### **Step 6: Update All Import Statements**

This is the most critical step. All import statements need to be updated:

#### **Before:**
```typescript
import { useKPICalculations } from '../hooks/useKPICalculations';
import { APP_CONFIG } from '../config/appConfig';
import { Card } from '@/components/ui/card';
import { KPICards } from './components/kpi/KPICards';
```

#### **After:**
```typescript
import { useKPICalculations } from '../hooks/use-kpi-calculations';
import { APP_CONFIG } from '../config/app-config';
import { Card } from '@/components/UI/card';
import { KPICards } from './components/KPI/KPICards';
```

## 🚨 **Critical Files to Update:**

1. **App.tsx**: Update all component and hook imports
2. **All component files**: Update utility and hook imports
3. **All hook files**: Update utility imports
4. **All test files**: Update imports to match new file names
5. **tsconfig.json**: Update path mappings if needed

## 🎯 **Benefits of Proper Naming:**

1. **Consistency**: All files follow the same convention
2. **Predictability**: Developers know exactly how to name files
3. **Tooling Support**: Better IDE support and autocomplete
4. **Framework Alignment**: Matches React/TypeScript best practices
5. **Team Standards**: Clear guidelines for all team members

## 📋 **Naming Convention Summary:**

| File Type | Convention | Example | Reason |
|-----------|------------|---------|---------|
| React Components | PascalCase | `KPICards.tsx` | React standard |
| Component Directories | PascalCase | `KPI/`, `Charts/` | React standard |
| Utilities | kebab-case | `date-utils.ts` | Standard JS convention |
| Hooks | kebab-case | `use-kpi-calculations.ts` | Standard JS convention |
| Config | kebab-case | `app-config.ts` | Standard JS convention |
| UI Components | kebab-case | `button.tsx` | shadcn/ui convention |

## ⚠️ **Important Notes:**

1. **Stop dev server** before renaming files to avoid file handle issues
2. **Update imports immediately** after renaming files
3. **Test thoroughly** after migration to ensure nothing is broken
4. **Update documentation** to reflect new file structure
5. **Consider using IDE refactoring tools** for bulk import updates

This migration will significantly improve code consistency and maintainability!
