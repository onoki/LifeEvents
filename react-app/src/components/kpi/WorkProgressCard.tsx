import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useKPICalculations } from '../../hooks/use-kpi-calculations';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { formatPercentage } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';
import { PRIVACY_RATE_MASK, PRIVACY_VALUE_MASK } from '../../utils/privacy-utils';

/**
 * Work Progress Card Component
 * Displays current work day progress with time remaining
 */
export function WorkProgressCard(): React.JSX.Element {
  const { workTimeFormatted, workProgress } = useKPICalculations();
  const { isPrivacyMode } = usePrivacyMode();

  return (
    <Card className="border-gray-600">
      <CardContent className="pt-5 pb-5 px-2 sm:px-5 flex flex-col h-full">
        <div className="flex justify-between items-center flex-grow">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 text-gray-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
            </div>
            <div className="text-2xl font-bold">
              {isPrivacyMode ? PRIVACY_VALUE_MASK : workTimeFormatted}
            </div>
          </div>
          <div className="text-base font-semibold text-gray-600">
            {isPrivacyMode ? PRIVACY_RATE_MASK : formatPercentage(workProgress, 2)}
          </div>
        </div>
        <div className="mt-auto pt-2">
          <div
            className="w-full bg-gray-600 rounded-lg h-7 flex items-center"
            style={{ containerType: 'inline-size' }}
          >
            <div
              className="bg-white rounded-full transition-all duration-300"
              style={{
                width: `${workProgress}%`,
                height: workProgress > 0
                  ? `min(1.75rem, max(2px, ${workProgress}cqw))`
                  : 0,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
            <span>
              {isPrivacyMode
                ? PRIVACY_VALUE_MASK
                : `${APP_CONFIG.WORK_SCHEDULE.START_HOUR}:${APP_CONFIG.WORK_SCHEDULE.START_MINUTE.toString().padStart(2, '0')}`}
            </span>
            <span>
              {isPrivacyMode
                ? PRIVACY_VALUE_MASK
                : `${APP_CONFIG.WORK_SCHEDULE.END_HOUR}:${APP_CONFIG.WORK_SCHEDULE.END_MINUTE.toString().padStart(2, '0')}`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
