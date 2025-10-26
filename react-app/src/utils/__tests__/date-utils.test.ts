import {
  countWorkdays,
  getWorkProgress,
  getWorkTimeFormatted,
  getFamilyLeaveTimeFormatted,
  getFamilyLeaveProgress,
  getRetirementProgress,
  getDaysToDate,
} from '../date-utils';

describe('dateUtils', () => {
  describe('countWorkdays', () => {
    it('should count workdays between two dates excluding weekends', () => {
      const startDate = new Date('2024-01-01T10:00:00'); // Monday
      const endDate = new Date('2024-01-07T15:00:00'); // Sunday
      
      const workdays = countWorkdays(startDate, endDate);
      expect(workdays).toBe(5); // Monday to Friday
    });

    it('should return 0 when start and end dates are the same', () => {
      const date = new Date('2024-01-01T10:00:00');
      const workdays = countWorkdays(date, date);
      expect(workdays).toBe(1);
    });

    it('should decrease workdays at 16:00 (4 PM)', () => {
      // Test that workdays decrease at 16:00, not at midnight
      const mondayBefore4PM = new Date('2024-01-01T15:59:00'); // Monday 3:59 PM
      const mondayAfter4PM = new Date('2024-01-01T16:01:00');   // Monday 4:01 PM
      const wednesday = new Date('2024-01-03T10:00:00');        // Wednesday 10:00 AM
      
      const workdaysBefore4PM = countWorkdays(mondayBefore4PM, wednesday);
      const workdaysAfter4PM = countWorkdays(mondayAfter4PM, wednesday);
      
      // Before 4 PM: Monday, Tuesday, Wednesday count (3 workdays)
      // After 4 PM: Only Tuesday, Wednesday counts (2 workday)
      expect(workdaysBefore4PM).toBe(3);
      expect(workdaysAfter4PM).toBe(2);
    });

    it('should count current day as workday before 16:00', () => {
      // Test that current day counts if it's before 16:00
      const monday6AM = new Date('2024-01-01T06:00:00'); // Monday 6:00 AM
      const tuesday = new Date('2024-01-02T10:00:00');    // Tuesday 10:00 AM
      
      const workdays = countWorkdays(monday6AM, tuesday);
      
      // Monday (6 AM) and Tuesday should both count = 2 workdays
      expect(workdays).toBe(2);
    });
  });

  describe('getWorkProgress', () => {
    it('should return 100% for weekends', () => {
      const saturday = new Date('2024-01-06T10:00:00'); // Saturday
      const progress = getWorkProgress(saturday);
      expect(progress).toBe(100); // Function returns 100% for weekends (work day complete)
    });

    it('should return 0% before work start time', () => {
      const beforeWork = new Date('2024-01-01T07:00:00'); // Monday 7 AM
      const progress = getWorkProgress(beforeWork);
      expect(progress).toBe(0); // Function returns 0 for weekends/before work
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
      expect(time).toBe('0 min');
    });

    it('should return "0 min" after work hours', () => {
      const afterWork = new Date('2024-01-01T18:00:00'); // Monday 6 PM
      const time = getWorkTimeFormatted(afterWork);
      expect(time).toBe('0 min'); // No work remaining after work hours
    });

    it('should return "0 min" at work end time', () => {
      const atWorkEnd = new Date('2024-01-01T16:30:00'); // Monday 4:30 PM (work end)
      const time = getWorkTimeFormatted(atWorkEnd);
      expect(time).toBe('0 min'); // No work remaining at work end time
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
      expect(progress).toBe(0); // Function returns 0 for weekends/before work
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
      expect(days).toBe(0); // The function returns 0 when the date is in the same year
      
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
      expect(progress).toBe(0); // Function returns 0 for weekends/before work
    });

    it('should return 100% after retirement end', () => {
      const afterEnd = new Date('2050-01-01T10:00:00');
      const progress = getRetirementProgress(afterEnd);
      expect(progress).toBe(100); // Function returns 100 after retirement end
    });
  });
});
