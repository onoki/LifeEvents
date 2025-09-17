import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useKPICalculations } from '../../hooks/useKPICalculations';
import { formatPercentage } from '../../utils/financialUtils';
import { APP_CONFIG } from '../../config/appConfig';

/**
 * Family Leave Card Component
 * Displays family leave progress and time remaining
 */
export function FamilyLeaveCard(): JSX.Element {
  const { 
    familyLeaveTimeFormatted, 
    familyLeaveProgress, 
    familyLeaveWorkdays 
  } = useKPICalculations();

  return (
    <Card className="border-gray-600">
      <CardContent className="pt-6 pb-6 flex flex-col h-full">
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
              <div className="text-3xl font-bold">{familyLeaveTimeFormatted}</div>
              <div className="text-lg font-medium text-gray-500">
                {familyLeaveWorkdays.toLocaleString('en-US').replace(/,/g, ' ')} workdays
              </div>
            </div>
          </div>
          <div className="text-lg font-semibold text-gray-600">
            {formatPercentage(familyLeaveProgress)}
          </div>
        </div>
        <div className="mt-auto pt-2">
          <div className="w-full bg-gray-600 rounded-lg h-8">
            <div 
              className="bg-white h-8 rounded-lg transition-all duration-300" 
              style={{ width: `${familyLeaveProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
            <span>{APP_CONFIG.DATES.FAMILY_LEAVE_START.split('T')[0]}</span>
            <span>{APP_CONFIG.DATES.FAMILY_LEAVE_END.split('T')[0]}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
