import React from 'react';
import { WorkProgressCard } from './WorkProgressCard';
import { FocusedSavingsCard } from './FocusedSavingsCard';
import { RetirementCard } from './RetirementCard';
import type { KPICardsProps } from '../../types';

/**
 * KPI Cards Container Component
 * Displays a grid of KPI cards showing work progress, focused savings, and retirement information
 */
export function KPICards({ data, config, conditions }: KPICardsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6 mb-8">
      <WorkProgressCard />
      <FocusedSavingsCard config={config} />
      <RetirementCard />
    </div>
  );
}
