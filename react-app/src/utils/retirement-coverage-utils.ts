import type { AfterGoalMonthlyCost } from '../types';

export interface RetirementCoverageMoneyValues {
  currentYear: number;
  future: number;
}

export interface RetirementCoverageCategory {
  category: string;
  skipInflation: boolean;
  monthlyCost: RetirementCoverageMoneyValues;
}

export interface RetirementCoverageInput {
  asOfDate: Date;
  goalDate: Date;
  todayEstimate: number;
  investmentGoal: number;
  annualGrowthRateNearTerm?: number;
  annualGrowthRateLongTerm: number;
  plannedMonthlyContributionsUntil?: Date | null;
  annualInflationRate: number;
  effectiveCapitalIncomeTaxRate: number;
  costs: AfterGoalMonthlyCost[];
}

export interface RetirementCoverageResult {
  asOfYear: number;
  projectionMonths: number;
  projectionYears: number;
  investmentGrowthFactor: number;
  inflationFactor: number;
  netMonthlyReturnRate: number;
  categories: RetirementCoverageCategory[];
  todayEstimate: {
    today: number;
    atGoal: RetirementCoverageMoneyValues;
  };
  investmentGoal: RetirementCoverageMoneyValues;
  requiredSavings: RetirementCoverageMoneyValues;
  existingSavingsMonthlyIncome: RetirementCoverageMoneyValues;
  goalMonthlyIncome: RetirementCoverageMoneyValues;
  totalMonthlyCosts: RetirementCoverageMoneyValues;
  existingSavingsBufferOrGap: RetirementCoverageMoneyValues;
  goalBufferOrGap: RetirementCoverageMoneyValues;
}

const finiteOrZero = (value: number): number => Number.isFinite(value) ? value : 0;

const nonNegativeFinite = (value: number): number => Math.max(0, finiteOrZero(value));

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, finiteOrZero(value)));

const saturateFinite = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  if (value === Number.POSITIVE_INFINITY) return Number.MAX_VALUE;
  if (value === Number.NEGATIVE_INFINITY) return -Number.MAX_VALUE;
  return value;
};

const safeMultiply = (left: number, right: number): number =>
  saturateFinite(left * right);

const safeDivide = (numerator: number, denominator: number): number => {
  if (denominator > 0) return saturateFinite(numerator / denominator);
  return numerator > 0 ? Number.MAX_VALUE : 0;
};

const safeSum = (values: number[]): number =>
  values.reduce((sum, value) => saturateFinite(sum + value), 0);

const dateAsUtcTimestamp = (date: Date): number => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return Number.NaN;

  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
};

const addCalendarMonths = (date: Date, months: number): number => {
  const absoluteMonth = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(absoluteMonth / 12);
  const month = absoluteMonth - year * 12;
  const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return Date.UTC(
    year,
    month,
    Math.min(date.getDate(), daysInTargetMonth),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
};

/** Returns the remaining period as fractional calendar months. */
const calculateProjectionMonths = (asOfDate: Date, goalDate: Date): number => {
  const start = dateAsUtcTimestamp(asOfDate);
  const end = dateAsUtcTimestamp(goalDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  let wholeMonths = (
    (goalDate.getFullYear() - asOfDate.getFullYear()) * 12
    + goalDate.getMonth()
    - asOfDate.getMonth()
  );
  let anchor = addCalendarMonths(asOfDate, wholeMonths);

  if (anchor > end) {
    wholeMonths -= 1;
    anchor = addCalendarMonths(asOfDate, wholeMonths);
  }

  const nextAnchor = addCalendarMonths(asOfDate, wholeMonths + 1);
  const fractionalMonth = nextAnchor > anchor ? (end - anchor) / (nextAnchor - anchor) : 0;
  return Math.max(0, wholeMonths + fractionalMonth);
};

const safePower = (base: number, exponent: number): number => {
  const result = Math.pow(base, exponent);
  return result === Number.POSITIVE_INFINITY ? Number.MAX_VALUE : finiteOrZero(result);
};

/**
 * Models retirement cost coverage at the goal date. The existing portfolio is
 * grown using the same configured rate schedule as the owned-stocks target:
 * near-term through the cutoff month, then long-term from the following month.
 * Future contributions are deliberately excluded. Capital-income tax applies
 * to investment income, never costs.
 */
export function calculateRetirementCoverage(
  input: RetirementCoverageInput
): RetirementCoverageResult {
  const asOfYear = input.asOfDate instanceof Date && Number.isFinite(input.asOfDate.getTime())
    ? input.asOfDate.getFullYear()
    : new Date().getFullYear();
  const projectionMonths = calculateProjectionMonths(input.asOfDate, input.goalDate);
  const projectionYears = projectionMonths / 12;

  // A portfolio cannot lose more than its entire value in a year. Keeping the
  // lower bound at -100% also guarantees a positive monthly compounding base.
  const annualGrowthRateLongTerm = Math.max(
    -1,
    finiteOrZero(input.annualGrowthRateLongTerm)
  );
  const annualGrowthRateNearTerm = Math.max(
    -1,
    input.annualGrowthRateNearTerm === undefined
      ? annualGrowthRateLongTerm
      : finiteOrZero(input.annualGrowthRateNearTerm)
  );
  // Inflation may be negative, but an annual price multiplier must stay above 0.
  const annualInflationRate = Math.max(-0.999999, finiteOrZero(input.annualInflationRate));
  const taxRate = clamp(input.effectiveCapitalIncomeTaxRate, 0, 1);

  const cutoff = input.plannedMonthlyContributionsUntil;
  const hasValidCutoff = cutoff instanceof Date && Number.isFinite(cutoff.getTime());
  const longTermStarts = hasValidCutoff
    ? new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 1)
    : null;
  let nearTermProjectionMonths = 0;
  let longTermProjectionMonths = projectionMonths;
  if (projectionMonths > 0 && longTermStarts && input.asOfDate < longTermStarts) {
    const nearTermEnd = input.goalDate < longTermStarts
      ? input.goalDate
      : longTermStarts;
    nearTermProjectionMonths = calculateProjectionMonths(input.asOfDate, nearTermEnd);
    longTermProjectionMonths = Math.max(0, projectionMonths - nearTermProjectionMonths);
  }
  const investmentGrowthFactor = safeMultiply(
    safePower(1 + annualGrowthRateNearTerm / 12, nearTermProjectionMonths),
    safePower(1 + annualGrowthRateLongTerm / 12, longTermProjectionMonths)
  );
  const inflationFactor = safePower(1 + annualInflationRate, projectionYears);
  const netMonthlyReturnRate = Math.max(0, annualGrowthRateLongTerm / 12) * (1 - taxRate);

  const todayEstimate = nonNegativeFinite(input.todayEstimate);
  const investmentGoalFuture = nonNegativeFinite(input.investmentGoal);
  const projectedTodayEstimateFuture = safeMultiply(todayEstimate, investmentGrowthFactor);
  const projectedTodayEstimateCurrent = safeDivide(
    projectedTodayEstimateFuture,
    inflationFactor
  );
  const investmentGoalCurrent = safeDivide(investmentGoalFuture, inflationFactor);

  const categories = (Array.isArray(input.costs) ? input.costs : []).map((cost) => {
    const currentYear = nonNegativeFinite(cost.monthlySum);
    const future = cost.skipInflation
      ? currentYear
      : safeMultiply(currentYear, inflationFactor);

    return {
      category: typeof cost.category === 'string' ? cost.category : '',
      skipInflation: Boolean(cost.skipInflation),
      monthlyCost: { currentYear, future },
    };
  });

  const totalMonthlyCosts = {
    currentYear: safeSum(categories.map((cost) => cost.monthlyCost.currentYear)),
    future: safeSum(categories.map((cost) => cost.monthlyCost.future)),
  };

  const requiredSavings = {
    currentYear: safeDivide(totalMonthlyCosts.currentYear, netMonthlyReturnRate),
    future: safeDivide(totalMonthlyCosts.future, netMonthlyReturnRate),
  };

  const existingSavingsMonthlyIncomeFuture = safeMultiply(
    projectedTodayEstimateFuture,
    netMonthlyReturnRate
  );
  const goalMonthlyIncomeFuture = safeMultiply(investmentGoalFuture, netMonthlyReturnRate);

  const existingSavingsMonthlyIncome = {
    currentYear: safeDivide(existingSavingsMonthlyIncomeFuture, inflationFactor),
    future: existingSavingsMonthlyIncomeFuture,
  };
  const goalMonthlyIncome = {
    currentYear: safeDivide(goalMonthlyIncomeFuture, inflationFactor),
    future: goalMonthlyIncomeFuture,
  };

  return {
    asOfYear,
    projectionMonths,
    projectionYears,
    investmentGrowthFactor,
    inflationFactor,
    netMonthlyReturnRate,
    categories,
    todayEstimate: {
      today: todayEstimate,
      atGoal: {
        currentYear: projectedTodayEstimateCurrent,
        future: projectedTodayEstimateFuture,
      },
    },
    investmentGoal: {
      currentYear: investmentGoalCurrent,
      future: investmentGoalFuture,
    },
    requiredSavings,
    existingSavingsMonthlyIncome,
    goalMonthlyIncome,
    totalMonthlyCosts,
    existingSavingsBufferOrGap: {
      currentYear: saturateFinite(
        existingSavingsMonthlyIncome.currentYear - totalMonthlyCosts.currentYear
      ),
      future: saturateFinite(existingSavingsMonthlyIncome.future - totalMonthlyCosts.future),
    },
    goalBufferOrGap: {
      currentYear: saturateFinite(goalMonthlyIncome.currentYear - totalMonthlyCosts.currentYear),
      future: saturateFinite(goalMonthlyIncome.future - totalMonthlyCosts.future),
    },
  };
}
