import { APP_CONFIG } from '../config/app-config';

/**
 * Calculate the number of workdays between two dates
 */
export function countWorkdays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current < endDate) {
    const dayOfWeek = current.getDay();
    // Monday = 1, Tuesday = 2, ..., Friday = 5
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Calculate workdays with vacation time excluded
 */
export function countWorkdaysWithVacation(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current < endDate) {
    const dayOfWeek = current.getDay();
    const month = current.getMonth();
    
    // Check if it's a workday (Monday-Friday)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Check if it's vacation time (first 5 weeks of July)
      const isVacation = month === APP_CONFIG.VACATION.MONTH && 
                        isInFirstFiveWeeksOfJuly(current);
      
      if (!isVacation) {
        count++;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Check if a date falls within the first 5 weeks of July
 */
export function isInFirstFiveWeeksOfJuly(date: Date): boolean {
  const july1 = new Date(date.getFullYear(), APP_CONFIG.VACATION.MONTH, 1);
  const dayOfYear = Math.floor((date.getTime() - july1.getTime()) / (1000 * 60 * 60 * 24));
  return dayOfYear >= 0 && dayOfYear < (APP_CONFIG.VACATION.WEEKS * APP_CONFIG.VACATION.DAYS_PER_WEEK);
}

/**
 * Get hours remaining until work end
 */
export function getHoursToWorkEnd(currentTime: Date): number {
  const now = currentTime;
  const workEnd = new Date(now);
  workEnd.setHours(APP_CONFIG.WORK_SCHEDULE.END_HOUR, APP_CONFIG.WORK_SCHEDULE.END_MINUTE, 0, 0);
  
  // If it's already past work end or weekend, show 0
  if (now.getHours() > APP_CONFIG.WORK_SCHEDULE.END_HOUR || 
      (now.getHours() === APP_CONFIG.WORK_SCHEDULE.END_HOUR && now.getMinutes() >= APP_CONFIG.WORK_SCHEDULE.END_MINUTE) ||
      now.getDay() === 0 || now.getDay() === 6) {
    return 0;
  }
  
  const diffMs = workEnd.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(0, diffHours);
}

/**
 * Calculate work progress percentage for the current day
 */
export function getWorkProgress(currentTime: Date): number {
  const now = currentTime;
  
  // If it's weekend, show 100% progress (work day complete)
  if (now.getDay() === 0 || now.getDay() === 6) {
    return 100;
  }
  
  const workStart = new Date(now);
  workStart.setHours(APP_CONFIG.WORK_SCHEDULE.START_HOUR, APP_CONFIG.WORK_SCHEDULE.START_MINUTE, 0, 0);
  
  const workEnd = new Date(now);
  workEnd.setHours(APP_CONFIG.WORK_SCHEDULE.END_HOUR, APP_CONFIG.WORK_SCHEDULE.END_MINUTE, 0, 0);
  
  // If before work start, show 0%
  if (now < workStart) {
    return 0;
  }
  
  // If after work end, show 100%
  if (now >= workEnd) {
    return 100;
  }
  
  // Calculate progress percentage
  const totalWorkTime = workEnd.getTime() - workStart.getTime();
  const elapsedTime = now.getTime() - workStart.getTime();
  const progress = (elapsedTime / totalWorkTime) * 100;
  
  return Math.min(100, Math.max(0, progress));
}

/**
 * Format work time remaining as "X h Y min"
 */
export function getWorkTimeFormatted(currentTime: Date): string {
  const now = currentTime;
  
  // If it's weekend, show 0
  if (now.getDay() === 0 || now.getDay() === 6) {
    return "0 min";
  }
  
  const workEnd = new Date(now);
  workEnd.setHours(APP_CONFIG.WORK_SCHEDULE.END_HOUR, APP_CONFIG.WORK_SCHEDULE.END_MINUTE, 0, 0);
  
  // If it's already past work end, show the full work day duration
  if (now.getHours() > APP_CONFIG.WORK_SCHEDULE.END_HOUR || 
      (now.getHours() === APP_CONFIG.WORK_SCHEDULE.END_HOUR && now.getMinutes() >= APP_CONFIG.WORK_SCHEDULE.END_MINUTE)) {
    const workStart = new Date(now);
    workStart.setHours(APP_CONFIG.WORK_SCHEDULE.START_HOUR, APP_CONFIG.WORK_SCHEDULE.START_MINUTE, 0, 0);
    const workEnd = new Date(now);
    workEnd.setHours(APP_CONFIG.WORK_SCHEDULE.END_HOUR, APP_CONFIG.WORK_SCHEDULE.END_MINUTE, 0, 0);
    
    const totalWorkTime = workEnd.getTime() - workStart.getTime();
    const totalHours = Math.floor(totalWorkTime / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalWorkTime % (1000 * 60 * 60)) / (1000 * 60));
    
    if (totalHours > 0) {
      return `${totalHours} h ${totalMinutes} min`;
    } else {
      return `${totalMinutes} min`;
    }
  }
  
  const diffMs = workEnd.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0) {
    return `${diffHours} h ${diffMinutes} min`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} min`;
  } else {
    return "0 min";
  }
}

/**
 * Calculate time remaining until family leave
 */
export function getFamilyLeaveTimeFormatted(currentTime: Date): string {
  const now = currentTime;
  const familyLeaveStart = new Date(APP_CONFIG.DATES.FAMILY_LEAVE_START);
  const familyLeaveEnd = new Date(APP_CONFIG.DATES.FAMILY_LEAVE_END);
  
  // If before start date, show time until start
  if (now < familyLeaveStart) {
    const diffMs = familyLeaveStart.getTime() - now.getTime();
    const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24));
    
    let result = '';
    if (diffMonths > 0) result += `${diffMonths} m `;
    if (diffDays > 0) result += `${diffDays} d`;
    return result.trim() || "0 d";
  }
  
  // If after end date, show 0
  if (now > familyLeaveEnd) {
    return "0 d";
  }
  
  // During family leave period, show time until end
  const diffMs = familyLeaveEnd.getTime() - now.getTime();
  const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24));
  
  let result = '';
  if (diffMonths > 0) result += `${diffMonths} m `;
  if (diffDays > 0) result += `${diffDays} d`;
  return result.trim() || "0 d";
}

/**
 * Calculate family leave workdays
 */
export function getFamilyLeaveWorkdays(currentTime: Date): number {
  const now = currentTime;
  const familyLeaveStart = new Date(APP_CONFIG.DATES.FAMILY_LEAVE_START);
  const familyLeaveEnd = new Date(APP_CONFIG.DATES.FAMILY_LEAVE_END);
  
  // If before start date, calculate workdays until start
  if (now < familyLeaveStart) {
    return countWorkdays(now, familyLeaveStart);
  }
  
  // If after end date, show 0
  if (now > familyLeaveEnd) {
    return 0;
  }
  
  // During family leave period, calculate workdays until end
  return countWorkdays(now, familyLeaveEnd);
}

/**
 * Calculate family leave progress percentage
 */
export function getFamilyLeaveProgress(currentTime: Date): number {
  const now = currentTime;
  const familyLeaveStart = new Date(APP_CONFIG.DATES.FAMILY_LEAVE_START);
  const familyLeaveEnd = new Date(APP_CONFIG.DATES.FAMILY_LEAVE_END);
  
  // If before start date, show 0%
  if (now < familyLeaveStart) {
    return 0;
  }
  
  // If after end date, show 100%
  if (now > familyLeaveEnd) {
    return 100;
  }
  
  // Calculate progress percentage
  const totalTime = familyLeaveEnd.getTime() - familyLeaveStart.getTime();
  const elapsedTime = now.getTime() - familyLeaveStart.getTime();
  const progress = (elapsedTime / totalTime) * 100;
  
  return Math.min(100, Math.max(0, progress));
}

/**
 * Calculate time remaining until retirement
 */
export function getRetirementTimeFormatted(currentTime: Date): string {
  const now = currentTime;
  const retirementStart = new Date(APP_CONFIG.DATES.RETIREMENT_START);
  const retirementEnd = new Date(APP_CONFIG.DATES.RETIREMENT_END);
  
  // If before start date, show time until start
  if (now < retirementStart) {
    const diffMs = retirementStart.getTime() - now.getTime();
    const diffYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    const diffMonths = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24));
    
    let result = '';
    if (diffYears > 0) result += `${diffYears} y `;
    if (diffMonths > 0) result += `${diffMonths} m `;
    if (diffDays > 0) result += `${diffDays} d`;
    return result.trim() || "0 d";
  }
  
  // If after end date, show 0
  if (now > retirementEnd) {
    return "0 d";
  }
  
  // During retirement period, show time until end
  const diffMs = retirementEnd.getTime() - now.getTime();
  const diffYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  const diffMonths = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
  const diffDays = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24));
  
  let result = '';
  if (diffYears > 0) result += `${diffYears} y `;
  if (diffMonths > 0) result += `${diffMonths} m `;
  if (diffDays > 0) result += `${diffDays} d`;
  return result.trim() || "0 d";
}

/**
 * Calculate retirement progress percentage
 */
export function getRetirementProgress(currentTime: Date): number {
  const now = currentTime;
  const retirementStart = new Date(APP_CONFIG.DATES.RETIREMENT_START);
  const retirementEnd = new Date(APP_CONFIG.DATES.RETIREMENT_END);
  
  // If before start date, show 0%
  if (now < retirementStart) {
    return 0;
  }
  
  // If after end date, show 100%
  if (now > retirementEnd) {
    return 100;
  }
  
  // Calculate progress percentage
  const totalTime = retirementEnd.getTime() - retirementStart.getTime();
  const elapsedTime = now.getTime() - retirementStart.getTime();
  const progress = (elapsedTime / totalTime) * 100;
  
  return Math.min(100, Math.max(0, progress));
}

/**
 * Calculate retirement workdays
 */
export function getRetirementWorkdays(currentTime: Date): number {
  const now = currentTime;
  const retirementStart = new Date(APP_CONFIG.DATES.RETIREMENT_START);
  const retirementEnd = new Date(APP_CONFIG.DATES.RETIREMENT_END);
  
  // If before start date, calculate workdays until start
  if (now < retirementStart) {
    return countWorkdaysWithVacation(now, retirementStart);
  }
  
  // If after end date, show 0
  if (now > retirementEnd) {
    return 0;
  }
  
  // During retirement period, calculate workdays until end
  return countWorkdaysWithVacation(now, retirementEnd);
}

/**
 * Calculate days until a specific date
 */
export function getDaysToDate(targetDateString: string): number {
  const targetDate = new Date(targetDateString);
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate days until family leave target date
 */
export function getDaysToFamilyLeave(): number {
  return getDaysToDate(APP_CONFIG.DATES.FAMILY_LEAVE_TARGET);
}

/**
 * Calculate days until retirement target date
 */
export function getDaysToRetirement(): number {
  return getDaysToDate(APP_CONFIG.DATES.RETIREMENT_TARGET);
}
