import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useKPICalculations } from '../../hooks/use-kpi-calculations';
import { formatPercentage } from '../../utils/financial-utils';
import { countWorkdays } from '../../utils/date-utils';
import type { Config } from '../../types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_MONTH = MS_PER_DAY * 30.44;
const FOCUSED_SAVINGS_START = new Date('2026-09-14T00:00:00');

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeRemaining = (currentTime: Date, targetDate: Date): string => {
  if (currentTime >= targetDate) {
    return '0 d';
  }

  const diffMs = targetDate.getTime() - currentTime.getTime();
  const diffMonths = Math.floor(diffMs / MS_PER_MONTH);
  const diffDays = Math.floor((diffMs % MS_PER_MONTH) / MS_PER_DAY);

  let result = '';
  if (diffMonths > 0) result += `${diffMonths} m `;
  if (diffDays > 0) result += `${diffDays} d`;
  return result.trim() || '0 d';
};

interface FocusedSavingsCardProps {
  config: Config;
}

/**
 * Focused Savings Card Component
 * Displays focused savings progress and time remaining until the target date
 */
export function FocusedSavingsCard({ config }: FocusedSavingsCardProps): React.JSX.Element {
  const { currentTime } = useKPICalculations();
  const plannedUntil = config.planned_monthly_contributions_until;
  const targetDate = plannedUntil ? new Date(plannedUntil) : null;
  const hasTargetDate = Boolean(targetDate && !Number.isNaN(targetDate.getTime()));
  const focusedSavingsStart = FOCUSED_SAVINGS_START;
  const isBeforeStart = currentTime.getTime() < focusedSavingsStart.getTime();
  const progress = React.useMemo(() => {
    if (!hasTargetDate) return 0;
    const startTime = focusedSavingsStart.getTime();
    const endTime = targetDate!.getTime();
    if (currentTime.getTime() <= startTime) return 0;
    if (currentTime.getTime() >= endTime) return 100;
    const totalTime = endTime - startTime;
    if (totalTime <= 0) return currentTime.getTime() >= endTime ? 100 : 0;
    const elapsedTime = currentTime.getTime() - startTime;
    return Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
  }, [currentTime, focusedSavingsStart, hasTargetDate, targetDate]);
  const timeRemaining = React.useMemo(() => {
    if (!hasTargetDate || !targetDate) return 'Not set';
    if (isBeforeStart) {
      const daysToStart = Math.ceil((focusedSavingsStart.getTime() - currentTime.getTime()) / MS_PER_DAY);
      return `-${daysToStart} d`;
    }
    return formatTimeRemaining(currentTime, targetDate);
  }, [currentTime, focusedSavingsStart, hasTargetDate, isBeforeStart, targetDate]);
  const workdaysRemaining = hasTargetDate && targetDate
    ? (isBeforeStart ? -countWorkdays(currentTime, focusedSavingsStart) : countWorkdays(currentTime, targetDate))
    : 0;
  const startLabel = formatDate(focusedSavingsStart);
  const endLabel = hasTargetDate && plannedUntil ? plannedUntil.split('T')[0] : 'Not set';

  return (
    <Card className="border-gray-600">
      <CardContent className="pt-6 pb-6 px-2 sm:px-6 flex flex-col h-full">
        <div className="flex justify-between items-center flex-grow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 text-gray-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </div>
            <div>
              <div className="text-3xl font-bold">{timeRemaining}</div>
              <div className="text-lg font-medium text-gray-500">
                {workdaysRemaining.toLocaleString('en-US').replace(/,/g, ' ')} workdays
              </div>
            </div>
          </div>
          <div className="text-lg font-semibold text-gray-600">
            {formatPercentage(progress)}
          </div>
        </div>
        <div className="mt-auto pt-2">
          <div className="w-full bg-gray-600 rounded-lg h-8">
            <div
              className="bg-white h-8 rounded-lg transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
            <span>{startLabel}</span>
            <span>{endLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
