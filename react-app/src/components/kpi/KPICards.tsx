import React from 'react';
import { WorkProgressCard } from './WorkProgressCard';
import { MiniRewardsCard } from './MiniRewardsCard';
import { FocusedSavingsCard } from './FocusedSavingsCard';
import { RetirementCard } from './RetirementCard';
import type { KPICardsProps } from '../../types';
import { APP_CONFIG } from '../../config/app-config';

/**
 * KPI Cards Container Component
 * Displays a grid of KPI cards showing work progress, mini rewards, focused savings, and retirement information
 */
export function KPICards({ data, config, miniRewards }: KPICardsProps): React.JSX.Element {
  const showMiniRewardsCard = APP_CONFIG.FEATURE_FLAGS.SHOW_MINI_REWARDS_CARD;
  const desktopColumnClass = showMiniRewardsCard ? 'lg:grid-cols-4' : 'lg:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${desktopColumnClass} gap-2 sm:gap-6 mb-8`}>
      <WorkProgressCard />
      {showMiniRewardsCard && (
        <MiniRewardsCard data={data} config={config} miniRewards={miniRewards} />
      )}
      <FocusedSavingsCard config={config} />
      <RetirementCard />
    </div>
  );
}
