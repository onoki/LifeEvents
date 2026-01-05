import {
  formatCurrency,
  formatPercentage,
  processStocksData,
  calculateTargetWithFixedContribution,
  calculateExponentialTrend,
} from '../financial-utils';
import type { Event } from '../../types';

describe('financial-utils', () => {
  describe('formatCurrency', () => {
    it('should format currency values correctly', () => {
      expect(formatCurrency(1000)).toBe('1 000 €');
      expect(formatCurrency(1234567)).toBe('1 234 567 €');
      expect(formatCurrency(0)).toBe('0 €');
    });

    it('should round decimal values', () => {
      expect(formatCurrency(1000.7)).toBe('1 001 €');
      expect(formatCurrency(1000.4)).toBe('1 000 €');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage values with default precision', () => {
      expect(formatPercentage(12.3456)).toBe('12.346 %');
    });

    it('should format percentage values with custom precision', () => {
      expect(formatPercentage(12.3456, 2)).toBe('12.35 %');
      expect(formatPercentage(12.3456, 0)).toBe('12 %');
    });
  });

  describe('processStocksData', () => {
    const mockEvents: Event[] = [
      {
        date: new Date('2024-01-01'),
        stocks_in_eur: '1000',
        category: 'Finance',
      },
      {
        date: new Date('2024-02-01'),
        stocks_in_eur: '1100',
        category: 'Finance',
      },
      {
        date: new Date('2024-03-01'),
        stocks_in_eur: '0', // Should be filtered out
        category: 'Finance',
      },
    ];

    it('should process stocks data correctly', () => {
      const result = processStocksData(mockEvents);
      
      expect(result).toHaveLength(3); // All items included (including 0 values)
      expect(result[0].stocks_in_eur).toBe(1000);
      expect(result[1].stocks_in_eur).toBe(1100);
      expect(result[2].stocks_in_eur).toBe(0);
    });

    it('should sort data by date', () => {
      const unsortedEvents: Event[] = [
        {
          date: new Date('2024-02-01'),
          stocks_in_eur: '1100',
          category: 'Finance',
        },
        {
          date: new Date('2024-01-01'),
          stocks_in_eur: '1000',
          category: 'Finance',
        },
      ];

      const result = processStocksData(unsortedEvents);
      
      expect(result[0].date.getTime()).toBeLessThan(result[1].date.getTime());
    });

    it('should filter out items without stocks data', () => {
      const eventsWithMixedData: Event[] = [
        {
          date: new Date('2024-01-01'),
          stocks_in_eur: '1000',
          category: 'Finance',
        },
        {
          date: new Date('2024-02-01'),
          category: 'Other',
        },
        {
          date: new Date('2024-03-01'),
          stocks_in_eur: '',
          category: 'Finance',
        },
      ];

      const result = processStocksData(eventsWithMixedData);
      
      expect(result).toHaveLength(1);
      expect(result[0].stocks_in_eur).toBe(1000);
    });

    it('should handle empty array', () => {
      const result = processStocksData([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateTargetWithFixedContribution - minRequiredContribution', () => {
    it('keeps latest minRequiredContribution constant after last known stocks point (zero growth)', () => {
      const events: Event[] = [
        { date: new Date('2024-01-01'), stocks_in_eur: '1000' },
        { date: new Date('2024-02-01') },
        { date: new Date('2024-03-01') },
        { date: new Date('2024-04-01') },
      ];
      const config = {
        investment_goal: '1300', // Goal close to current for easy math
        annual_growth_rate: '0',  // Zero growth to hit linear branch
      };

      const result = calculateTargetWithFixedContribution(events as any, config);

      // totalMonths = 4 (Jan..Apr). For index 0 (Jan): monthsRemaining = 4 - 0 - 1 = 3
      // remaining = 1300 - 1000 = 300 => minRequiredContribution = 300 / 3 = 100
      const expectedMin = 100;
      expect(result).toHaveLength(4);
      expect(result[0].minRequiredContribution).toBeCloseTo(expectedMin, 6);
      expect(result[1].minRequiredContribution).toBeCloseTo(expectedMin, 6);
      expect(result[2].minRequiredContribution).toBeCloseTo(expectedMin, 6);
      expect(result[3].minRequiredContribution).toBeCloseTo(expectedMin, 6);
    });

    it('computes per-point minRequiredContribution up to latest stocks point, then holds constant (zero growth)', () => {
      const events: Event[] = [
        { date: new Date('2024-01-01'), stocks_in_eur: '1000' }, // index 0
        { date: new Date('2024-02-01') },                        // index 1 (no value)
        { date: new Date('2024-03-01'), stocks_in_eur: '1300' }, // index 2 latest stocks
        { date: new Date('2024-04-01') },                        // index 3 future
      ];
      const config = {
        investment_goal: '1600',
        annual_growth_rate: '0',
      };

      const result = calculateTargetWithFixedContribution(events as any, config);

      // totalMonths = 4
      // index 0: monthsRemaining = 4 - 0 - 1 = 3; remaining = 1600 - 1000 = 600 => 600/3 = 200
      // index 1: monthsRemaining = 4 - 1 - 1 = 2; currentValue = 0 (missing) => remaining = 1600 - 0 = 1600 => 1600/2 = 800
      // index 2: monthsRemaining = 4 - 2 - 1 = 1; currentValue = 1300 => remaining = 300 => 300/1 = 300 (latestMin)
      // index 3: uses latestMin = 300
      expect(result[0].minRequiredContribution).toBeCloseTo(200, 6);
      expect(result[1].minRequiredContribution).toBeCloseTo(800, 6);
      expect(result[2].minRequiredContribution).toBeCloseTo(300, 6);
      expect(result[3].minRequiredContribution).toBeCloseTo(300, 6);
    });

    it('computes expected value for current=200000, annual=0.07, monthsRemaining=207, goal=1000000', () => {
      const latestKnownDate = new Date('2024-01-01');
      const lastDate = new Date('2041-04-01'); // 207 months after 2024-01

      const events: Event[] = [
        { date: latestKnownDate, stocks_in_eur: '200000' }, // latest stocks point
        { date: new Date('2024-02-01') },
        { date: lastDate }, // final horizon
      ];

      const config = {
        investment_goal: '1000000',
        annual_growth_rate: '0.07',
      };

      const result = calculateTargetWithFixedContribution(events as any, config);

      // Find index of latest known stocks point in result (should be 0 here)
      const latestIndex = result.findIndex(r => r.stocks_in_eur !== null && r.stocks_in_eur !== undefined);
      expect(latestIndex).toBeGreaterThanOrEqual(0);

      // Expected minRequiredContribution
      const annual = 0.07;
      const r = annual / 12;
      const n = 207;
      const current = 200000;
      const fvCurrent = current * Math.pow(1 + r, n);
      const remaining = 1000000 - fvCurrent;
      const annuityFactor = (Math.pow(1 + r, n) - 1) / r;
      const expected = Math.max(0, remaining / annuityFactor);

      expect(result[latestIndex].minRequiredContribution!).toBeCloseTo(expected, 6);
      // And for future points it should hold constant
      for (let i = latestIndex + 1; i < result.length; i++) {
        expect(result[i].minRequiredContribution!).toBeCloseTo(expected, 6);
      }
    });

    it('uses adjusted start + adjusted contribution so projections still reach the goal (zero growth)', () => {
      const events: Event[] = [
        { date: new Date('2024-01-01'), stocks_in_eur: '100', eunl_rate_to_trend: '2' },
        { date: new Date('2024-02-01') },
        { date: new Date('2024-03-01') },
      ];
      const config = {
        investment_goal: '260',
        annual_growth_rate: '0',
      };

      const result = calculateTargetWithFixedContribution(events as any, config);

      expect(result).toHaveLength(3);
      expect(result[0].targetWithMinimumContribution).toBeCloseTo(200, 6);
      expect(result[1].targetWithMinimumContribution).toBeCloseTo(230, 6);
      expect(result[2].targetWithMinimumContribution).toBeCloseTo(260, 6);
    });

    it('projects growth scenario lines from the latest stock point', () => {
      const events: Event[] = [
        { date: new Date('2024-01-01') },
        { date: new Date('2024-02-01'), stocks_in_eur: '100' },
        { date: new Date('2024-03-01') },
      ];
      const config = {
        investment_goal: '120',
        annual_growth_rate: '0.12',
      };

      const result = calculateTargetWithFixedContribution(events as any, config, 0.12);

      expect(result[0].lineWithPlusOnePercentGrowth).toBeNull();
      expect(result[0].lineWithMinusOnePercentGrowth).toBeNull();
      expect(result[0].lineWithTrendGrowth).toBeNull();

      expect(result[1].lineWithPlusOnePercentGrowth).toBeCloseTo(100, 6);
      expect(result[1].lineWithMinusOnePercentGrowth).toBeCloseTo(100, 6);
      expect(result[1].lineWithTrendGrowth).toBeCloseTo(100, 6);

      const annualGrowthRate = 0.12;
      const monthlyGrowthRate = annualGrowthRate / 12;
      const monthsRemaining = 1;
      const currentValue = 100;
      const futureValueOfCurrent = currentValue * Math.pow(1 + monthlyGrowthRate, monthsRemaining);
      const remainingToGoal = 120 - futureValueOfCurrent;
      const annuityFactor = (Math.pow(1 + monthlyGrowthRate, monthsRemaining) - 1) / monthlyGrowthRate;
      const expectedMinRequired = remainingToGoal / annuityFactor;
      const plusMonthly = (0.12 + 0.01) / 12;
      const minusMonthly = (0.12 - 0.01) / 12;
      const trendMonthly = 0.12 / 12;

      expect(result[2].lineWithPlusOnePercentGrowth).toBeCloseTo(100 * (1 + plusMonthly) + expectedMinRequired, 6);
      expect(result[2].lineWithMinusOnePercentGrowth).toBeCloseTo(100 * (1 + minusMonthly) + expectedMinRequired, 6);
      expect(result[2].lineWithTrendGrowth).toBeCloseTo(100 * (1 + trendMonthly) + expectedMinRequired, 6);
    });

    it('projects planned contribution line with fixed monthly contributions (zero growth)', () => {
      const events: Event[] = [
        { date: new Date('2024-01-01'), stocks_in_eur: '100' },
        { date: new Date('2024-02-01') },
        { date: new Date('2024-03-01') },
      ];
      const config = {
        investment_goal: '1000',
        annual_growth_rate: '0',
        planned_monthly_contribution: '50',
      };

      const result = calculateTargetWithFixedContribution(events as any, config);

      expect(result[0].plannedContributionLine).toBeCloseTo(100, 6);
      expect(result[1].plannedContributionLine).toBeCloseTo(150, 6);
      expect(result[2].plannedContributionLine).toBeCloseTo(200, 6);
    });
  });

  describe('calculateExponentialTrend', () => {
    it('returns trend stats and confidence bounds that match exponential data', () => {
      const data = [
        { date: new Date('2024-01-01'), price: 100 },
        { date: new Date('2024-01-02'), price: 110 },
        { date: new Date('2024-01-03'), price: 121 },
      ];

      const result = calculateExponentialTrend(data);

      expect(result.data).toHaveLength(3);
      expect(result.trendStats).not.toBeNull();

      const firstPoint = result.data[0];
      const lastPoint = result.data[2];

      expect(firstPoint.trend).toBeCloseTo(firstPoint.price, 6);
      expect(lastPoint.trend).toBeCloseTo(lastPoint.price, 6);
      expect(firstPoint.multiplier).toBeCloseTo(1, 6);
      expect(lastPoint.multiplier).toBeCloseTo(1, 6);
      expect(firstPoint.trendUpperBound).toBeGreaterThanOrEqual(firstPoint.trendLowerBound);
      expect(lastPoint.trendUpperBound).toBeGreaterThanOrEqual(lastPoint.trendLowerBound);
    });
  });
});
