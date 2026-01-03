import { parseNumeric } from '../number-utils';

describe('number-utils', () => {
  describe('parseNumeric', () => {
    it('parses dot-decimal strings', () => {
      expect(parseNumeric('0.07')).toBeCloseTo(0.07, 2);
      expect(parseNumeric('1234.56')).toBeCloseTo(1234.56, 2);
    });

    it('parses comma-decimal strings', () => {
      expect(parseNumeric('0,07')).toBeCloseTo(0.07, 2);
      expect(parseNumeric('1234,56')).toBeCloseTo(1234.56, 2);
    });

    it('trims whitespace and handles spaced thousands', () => {
      expect(parseNumeric('  1 234,56  ')).toBeCloseTo(1234.56, 2);
      expect(parseNumeric('1 234.56')).toBeCloseTo(1234.56, 2);
    });

    it('passes through numeric input', () => {
      expect(parseNumeric(1.23)).toBeCloseTo(1.23, 2);
    });

    it('returns NaN for empty or missing values', () => {
      expect(Number.isNaN(parseNumeric(''))).toBe(true);
      expect(Number.isNaN(parseNumeric(null))).toBe(true);
      expect(Number.isNaN(parseNumeric(undefined))).toBe(true);
    });
  });
});
