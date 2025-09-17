import React from 'react';
import { Card, CardContent } from '@/components/UI/card';
import { useKPICalculations } from '../../hooks/use-kpi-calculations';
import { formatPercentage } from '../../utils/financial-utils';
import { APP_CONFIG } from '../../config/app-config';

/**
 * Retirement Card Component
 * Displays retirement progress and time remaining
 */
export function RetirementCard(): JSX.Element {
  const { 
    retirementTimeFormatted, 
    retirementProgress, 
    retirementWorkdays 
  } = useKPICalculations();

  return (
    <Card className="border-gray-600">
      <CardContent className="pt-6 pb-6 flex flex-col h-full">
        <div className="flex justify-between items-center flex-grow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 text-gray-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </div>
            <div>
              <div className="text-3xl font-bold">{retirementTimeFormatted}</div>
              <div className="text-lg font-medium text-gray-500">
                {retirementWorkdays.toLocaleString('en-US').replace(/,/g, ' ')} workdays
              </div>
            </div>
          </div>
          <div className="text-lg font-semibold text-gray-600">
            {formatPercentage(retirementProgress)}
          </div>
        </div>
        <div className="mt-auto pt-2">
          <div className="w-full bg-gray-600 rounded-lg h-8">
            <div 
              className="bg-white h-8 rounded-lg transition-all duration-300" 
              style={{ width: `${retirementProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
            <span>{APP_CONFIG.DATES.RETIREMENT_START.split('T')[0]}</span>
            <span>{APP_CONFIG.DATES.RETIREMENT_END.split('T')[0]}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
