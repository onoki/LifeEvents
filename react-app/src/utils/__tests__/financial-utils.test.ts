import {
  formatCurrency,
  formatPercentage,
  processStocksData,
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
});
