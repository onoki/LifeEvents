import type { AfterGoalMonthlyCost } from '../../types';
import { calculateRetirementCoverage } from '../retirement-coverage-utils';

const costs: AfterGoalMonthlyCost[] = [
  { category: 'Housing', monthlySum: 1_000, skipInflation: false },
  { category: 'Travel', monthlySum: 500, skipInflation: true },
];

const baseInput = {
  asOfDate: new Date(2026, 0, 1),
  goalDate: new Date(2036, 0, 1),
  todayEstimate: 100_000,
  investmentGoal: 1_000_000,
  annualGrowthRateLongTerm: 0.12,
  annualInflationRate: 0.02,
  effectiveCapitalIncomeTaxRate: 0.3,
  costs,
};

describe('calculateRetirementCoverage', () => {
  it('projects existing savings monthly with no future contributions', () => {
    const result = calculateRetirementCoverage(baseInput);
    const expectedGrowthFactor = Math.pow(1.01, 120);

    expect(result.asOfYear).toBe(2026);
    expect(result.projectionMonths).toBeCloseTo(120, 8);
    expect(result.projectionYears).toBeCloseTo(10, 8);
    expect(result.investmentGrowthFactor).toBeCloseTo(expectedGrowthFactor, 10);
    expect(result.todayEstimate.today).toBe(100_000);
    expect(result.todayEstimate.atGoal.future).toBeCloseTo(
      100_000 * expectedGrowthFactor,
      6
    );
  });

  it('expresses future investment values and incomes in both money bases', () => {
    const result = calculateRetirementCoverage(baseInput);
    const inflationFactor = Math.pow(1.02, 10);
    const netMonthlyReturnRate = 0.12 / 12 * 0.7;
    const projectedExistingFuture = 100_000 * Math.pow(1.01, 120);

    expect(result.inflationFactor).toBeCloseTo(inflationFactor, 10);
    expect(result.netMonthlyReturnRate).toBeCloseTo(netMonthlyReturnRate, 10);
    expect(result.todayEstimate.atGoal.currentYear).toBeCloseTo(
      projectedExistingFuture / inflationFactor,
      6
    );
    expect(result.investmentGoal).toEqual({
      currentYear: expect.any(Number),
      future: 1_000_000,
    });
    expect(result.investmentGoal.currentYear).toBeCloseTo(1_000_000 / inflationFactor, 6);
    expect(result.existingSavingsMonthlyIncome.future).toBeCloseTo(
      projectedExistingFuture * netMonthlyReturnRate,
      6
    );
    expect(result.existingSavingsMonthlyIncome.currentYear).toBeCloseTo(
      projectedExistingFuture * netMonthlyReturnRate / inflationFactor,
      6
    );
    expect(result.goalMonthlyIncome.future).toBeCloseTo(7_000, 8);
    expect(result.goalMonthlyIncome.currentYear).toBeCloseTo(7_000 / inflationFactor, 8);
  });

  it('inflates only categories that do not opt out', () => {
    const result = calculateRetirementCoverage(baseInput);
    const inflationFactor = Math.pow(1.02, 10);

    expect(result.categories).toEqual([
      {
        category: 'Housing',
        skipInflation: false,
        monthlyCost: {
          currentYear: 1_000,
          future: expect.any(Number),
        },
      },
      {
        category: 'Travel',
        skipInflation: true,
        monthlyCost: {
          currentYear: 500,
          future: 500,
        },
      },
    ]);
    expect(result.categories[0].monthlyCost.future).toBeCloseTo(1_000 * inflationFactor, 8);
    expect(result.totalMonthlyCosts.currentYear).toBe(1_500);
    expect(result.totalMonthlyCosts.future).toBeCloseTo(1_000 * inflationFactor + 500, 8);
  });

  it('derives the savings required to fund costs at the net monthly return', () => {
    const result = calculateRetirementCoverage(baseInput);
    const netMonthlyReturnRate = 0.12 / 12 * 0.7;

    expect(result.requiredSavings.currentYear).toBeCloseTo(
      result.totalMonthlyCosts.currentYear / netMonthlyReturnRate,
      8
    );
    expect(result.requiredSavings.future).toBeCloseTo(
      result.totalMonthlyCosts.future / netMonthlyReturnRate,
      8
    );
  });

  it('returns positive buffers and negative gaps as income minus costs', () => {
    const result = calculateRetirementCoverage({
      ...baseInput,
      asOfDate: new Date(2026, 0, 1),
      goalDate: new Date(2026, 0, 1),
      annualGrowthRateLongTerm: 0.12,
      annualInflationRate: 0,
      todayEstimate: 100_000,
      investmentGoal: 1_000_000,
      effectiveCapitalIncomeTaxRate: 0,
      costs: [{ category: 'All costs', monthlySum: 2_000, skipInflation: false }],
    });

    expect(result.existingSavingsMonthlyIncome.future).toBe(1_000);
    expect(result.existingSavingsBufferOrGap).toEqual({
      currentYear: -1_000,
      future: -1_000,
    });
    expect(result.goalMonthlyIncome.future).toBe(10_000);
    expect(result.goalBufferOrGap).toEqual({
      currentYear: 8_000,
      future: 8_000,
    });
  });

  it('applies the same effective tax rate to existing-savings and goal income only', () => {
    const result = calculateRetirementCoverage({
      ...baseInput,
      asOfDate: new Date(2026, 0, 1),
      goalDate: new Date(2026, 0, 1),
      todayEstimate: 100_000,
      investmentGoal: 200_000,
      annualGrowthRateLongTerm: 0.12,
      annualInflationRate: 0,
      effectiveCapitalIncomeTaxRate: 0.25,
    });

    expect(result.netMonthlyReturnRate).toBe(0.0075);
    expect(result.existingSavingsMonthlyIncome.future).toBe(750);
    expect(result.goalMonthlyIncome.future).toBe(1_500);
    expect(result.totalMonthlyCosts.future).toBe(1_500);
  });

  it('uses the exact remaining date span and is unaffected by daylight-saving time', () => {
    const result = calculateRetirementCoverage({
      ...baseInput,
      asOfDate: new Date(2026, 2, 29, 12),
      goalDate: new Date(2026, 3, 29, 12),
      annualInflationRate: 0,
    });

    expect(result.projectionMonths).toBe(1);
  });

  it('safely handles an inflation factor that underflows to zero', () => {
    const result = calculateRetirementCoverage({
      ...baseInput,
      goalDate: new Date(2126, 0, 1),
      annualInflationRate: -0.999999,
    });

    expect(result.inflationFactor).toBe(0);
    expect(result.investmentGoal.currentYear).toBe(Number.MAX_VALUE);
    expect(result.goalMonthlyIncome.currentYear).toBe(Number.MAX_VALUE);
    expect(Number.isFinite(result.todayEstimate.atGoal.currentYear)).toBe(true);
  });

  it.each([
    ['the goal is today', new Date(2026, 0, 1)],
    ['the goal is in the past', new Date(2025, 0, 1)],
    ['the goal date is invalid', new Date(Number.NaN)],
  ])('does not project when %s', (_description, goalDate) => {
    const result = calculateRetirementCoverage({ ...baseInput, goalDate });

    expect(result.projectionMonths).toBe(0);
    expect(result.projectionYears).toBe(0);
    expect(result.investmentGrowthFactor).toBe(1);
    expect(result.inflationFactor).toBe(1);
    expect(result.todayEstimate.atGoal).toEqual({ currentYear: 100_000, future: 100_000 });
  });

  it('sanitizes non-finite and negative money inputs and empty costs', () => {
    const result = calculateRetirementCoverage({
      ...baseInput,
      todayEstimate: Number.POSITIVE_INFINITY,
      investmentGoal: -10,
      annualGrowthRateLongTerm: Number.NaN,
      annualInflationRate: Number.POSITIVE_INFINITY,
      effectiveCapitalIncomeTaxRate: Number.NaN,
      costs: [
        { category: 'Negative', monthlySum: -50, skipInflation: false },
        { category: 'Invalid', monthlySum: Number.NaN, skipInflation: true },
      ],
    });

    expect(result.todayEstimate.today).toBe(0);
    expect(result.investmentGoal).toEqual({ currentYear: 0, future: 0 });
    expect(result.investmentGrowthFactor).toBe(1);
    expect(result.inflationFactor).toBe(1);
    expect(result.totalMonthlyCosts).toEqual({ currentYear: 0, future: 0 });
    expect(result.goalMonthlyIncome).toEqual({ currentYear: 0, future: 0 });
  });

  it('clamps tax to a valid percentage', () => {
    const noIncomeAfterTax = calculateRetirementCoverage({
      ...baseInput,
      effectiveCapitalIncomeTaxRate: 2,
    });
    const noTax = calculateRetirementCoverage({
      ...baseInput,
      effectiveCapitalIncomeTaxRate: -1,
    });

    expect(noIncomeAfterTax.netMonthlyReturnRate).toBe(0);
    expect(noIncomeAfterTax.goalMonthlyIncome).toEqual({ currentYear: 0, future: 0 });
    expect(noTax.netMonthlyReturnRate).toBeCloseTo(0.01, 10);
  });

  it('does not model negative growth as retirement income', () => {
    const result = calculateRetirementCoverage({
      ...baseInput,
      annualGrowthRateLongTerm: -0.5,
    });

    expect(result.investmentGrowthFactor).toBeLessThan(1);
    expect(result.netMonthlyReturnRate).toBe(0);
    expect(result.existingSavingsMonthlyIncome).toEqual({ currentYear: 0, future: 0 });
    expect(result.goalMonthlyIncome).toEqual({ currentYear: 0, future: 0 });
  });
});
