import {
  countWorkdays,
  countWorkdaysWithVacation,
  getWorkProgress,
  getWorkTimeFormatted,
  getFamilyLeaveTimeFormatted,
  getFamilyLeaveProgress,
  getFamilyLeaveWorkdays,
  getRetirementTimeFormatted,
  getRetirementProgress,
  getRetirementWorkdays,
  getDaysToDate,
} from '../dateUtils';

describe('dateUtils', () => {
  describe('countWorkdays', () => {
    it('should count workdays between two dates excluding weekends', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const endDate = new Date('2024-01-07'); // Sunday
      
      const workdays = countWorkdays(startDate, endDate);
      expect(workdays).toBe(5); // Monday to Friday
    });

    it('should return 0 when start and end dates are the same', () => {
      const date = new Date('2024-01-01');
      const workdays = countWorkdays(date, date);
      expect(workdays).toBe(0);
    });
  });

  describe('getWorkProgress', () => {
    it('should return 0% for weekends', () => {
      const saturday = new Date('2024-01-06T10:00:00'); // Saturday
      const progress = getWorkProgress(saturday);
      expect(progress).toBe(0);
    });

    it('should return 0% before work start time', () => {
      const beforeWork = new Date('2024-01-01T07:00:00'); // Monday 7 AM
      const progress = getWorkProgress(beforeWork);
      expect(progress).toBe(0);
    });

    it('should return 100% after work end time', () => {
      const afterWork = new Date('2024-01-01T18:00:00'); // Monday 6 PM
      const progress = getWorkProgress(afterWork);
      expect(progress).toBe(100);
    });

    it('should calculate progress during work hours', () => {
      const midWork = new Date('2024-01-01T12:30:00'); // Monday 12:30 PM (midway)
      const progress = getWorkProgress(midWork);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });
  });

  describe('getWorkTimeFormatted', () => {
    it('should return "0 h 0 min" for weekends', () => {
      const saturday = new Date('2024-01-06T10:00:00'); // Saturday
      const time = getWorkTimeFormatted(saturday);
      expect(time).toBe('0 h 0 min');
    });

    it('should return "0 h 0 min" after work hours', () => {
      const afterWork = new Date('2024-01-01T18:00:00'); // Monday 6 PM
      const time = getWorkTimeFormatted(afterWork);
      expect(time).toBe('0 h 0 min');
    });

    it('should return formatted time during work hours', () => {
      const duringWork = new Date('2024-01-01T12:00:00'); // Monday 12 PM
      const time = getWorkTimeFormatted(duringWork);
      expect(time).toMatch(/\d+ h \d+ min/);
    });
  });

  describe('getFamilyLeaveTimeFormatted', () => {
    it('should return formatted time string', () => {
      const currentTime = new Date('2024-01-01T10:00:00');
      const time = getFamilyLeaveTimeFormatted(currentTime);
      expect(typeof time).toBe('string');
      expect(time).toMatch(/\d+ [mdy]/);
    });
  });

  describe('getFamilyLeaveProgress', () => {
    it('should return 0% before family leave start', () => {
      const beforeStart = new Date('2024-01-01T10:00:00');
      const progress = getFamilyLeaveProgress(beforeStart);
      expect(progress).toBe(0);
    });

    it('should return 100% after family leave end', () => {
      const afterEnd = new Date('2026-01-01T10:00:00');
      const progress = getFamilyLeaveProgress(afterEnd);
      expect(progress).toBe(100);
    });
  });

  describe('getDaysToDate', () => {
    it('should calculate days until a future date', () => {
      const futureDate = '2024-12-25';
      const now = new Date('2024-01-01');
      
      // Mock current date
      const originalDate = Date;
      global.Date = jest.fn(() => now) as any;
      global.Date.now = originalDate.now;
      
      const days = getDaysToDate(futureDate);
      expect(days).toBeGreaterThan(0);
      
      // Restore original Date
      global.Date = originalDate;
    });

    it('should return 0 for past dates', () => {
      const pastDate = '2023-01-01';
      const now = new Date('2024-01-01');
      
      // Mock current date
      const originalDate = Date;
      global.Date = jest.fn(() => now) as any;
      global.Date.now = originalDate.now;
      
      const days = getDaysToDate(pastDate);
      expect(days).toBe(0);
      
      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('getRetirementProgress', () => {
    it('should return 0% before retirement start', () => {
      const beforeStart = new Date('2010-01-01T10:00:00');
      const progress = getRetirementProgress(beforeStart);
      expect(progress).toBe(0);
    });

    it('should return 100% after retirement end', () => {
      const afterEnd = new Date('2050-01-01T10:00:00');
      const progress = getRetirementProgress(afterEnd);
      expect(progress).toBe(100);
    });
  });
});
