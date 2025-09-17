import { useState, useEffect, useMemo } from 'react';
import {
  getHoursToWorkEnd,
  getWorkProgress,
  getWorkTimeFormatted,
  getFamilyLeaveTimeFormatted,
  getFamilyLeaveProgress,
  getFamilyLeaveWorkdays,
  getRetirementTimeFormatted,
  getRetirementProgress,
  getRetirementWorkdays,
  getDaysToFamilyLeave,
  getDaysToRetirement,
} from '../utils/dateUtils';
import { APP_CONFIG } from '../config/appConfig';

export interface KPICalculations {
  // Work day calculations
  hoursToWorkEnd: number;
  workProgress: number;
  workTimeFormatted: string;
  
  // Family leave calculations
  familyLeaveTimeFormatted: string;
  familyLeaveProgress: number;
  familyLeaveWorkdays: number;
  daysToFamilyLeave: number;
  
  // Retirement calculations
  retirementTimeFormatted: string;
  retirementProgress: number;
  retirementWorkdays: number;
  daysToRetirement: number;
  
  // Current time
  currentTime: Date;
}

/**
 * Custom hook for KPI calculations
 */
export function useKPICalculations(): KPICalculations {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, APP_CONFIG.UI.UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Memoize calculations to avoid unnecessary recalculations
  const calculations = useMemo((): KPICalculations => {
    return {
      // Work day calculations
      hoursToWorkEnd: getHoursToWorkEnd(currentTime),
      workProgress: getWorkProgress(currentTime),
      workTimeFormatted: getWorkTimeFormatted(currentTime),
      
      // Family leave calculations
      familyLeaveTimeFormatted: getFamilyLeaveTimeFormatted(currentTime),
      familyLeaveProgress: getFamilyLeaveProgress(currentTime),
      familyLeaveWorkdays: getFamilyLeaveWorkdays(currentTime),
      daysToFamilyLeave: getDaysToFamilyLeave(),
      
      // Retirement calculations
      retirementTimeFormatted: getRetirementTimeFormatted(currentTime),
      retirementProgress: getRetirementProgress(currentTime),
      retirementWorkdays: getRetirementWorkdays(currentTime),
      daysToRetirement: getDaysToRetirement(),
      
      // Current time
      currentTime,
    };
  }, [currentTime]);

  return calculations;
}
