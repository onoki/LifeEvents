import React from 'react';
import { Card, CardContent } from '@/components/UI/card';
import { useKPICalculations } from '../../hooks/use-kpi-calculations';
import { formatPercentage } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';

/**
 * Work Progress Card Component
 * Displays current work day progress with time remaining
 */
export function WorkProgressCard(): JSX.Element {
  const { workTimeFormatted, workProgress } = useKPICalculations();

  return (
    <Card className="border-gray-600">
      <CardContent className="pt-6 pb-6 flex flex-col h-full">
        <div className="flex justify-between items-center flex-grow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 text-gray-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
            </div>
            <div className="text-3xl font-bold">{workTimeFormatted}</div>
          </div>
          <div className="text-lg font-semibold text-gray-600">
            {formatPercentage(workProgress)}
          </div>
        </div>
        <div className="mt-auto pt-2">
          <div className="w-full bg-gray-600 rounded-lg h-8">
            <div 
              className="bg-white h-8 rounded-lg transition-all duration-300" 
              style={{ width: `${workProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
            <span>{APP_CONFIG.WORK_SCHEDULE.START_HOUR}:{APP_CONFIG.WORK_SCHEDULE.START_MINUTE.toString().padStart(2, '0')}</span>
            <span>{APP_CONFIG.WORK_SCHEDULE.END_HOUR}:{APP_CONFIG.WORK_SCHEDULE.END_MINUTE.toString().padStart(2, '0')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
