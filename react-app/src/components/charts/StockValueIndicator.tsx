import React, { useState, useEffect, useMemo } from 'react';
import { CountUp } from '../UI/countup';
import { calculateCurrentStockEstimate } from '../../utils/financial-utils'; // Updated to include growthPerDay and contributionPerDay
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import type { Event, Config } from '../../types';

interface StockValueIndicatorProps {
  data: Event[];
  config: Config;
  chartData?: any[];
}

/**
 * Stock Value Indicator Component
 * Shows current estimated stock value with daily and hourly changes
 */
export function StockValueIndicator({ data, config, chartData }: StockValueIndicatorProps): React.JSX.Element {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isPrivacyMode } = usePrivacyMode();

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  const stockValueEstimate = useMemo(() => {
    return calculateCurrentStockEstimate(data, config, currentTime, chartData);
  }, [data, config, currentTime, chartData]);

  if (isPrivacyMode) {
    return (
      <div className="mt-4 text-sm text-muted-foreground">
        Today's estimate: •••• (+••• €/d +••• €/d = +••• €/d)
      </div>
    );
  }

  return (
    <div className="mt-4 text-sm text-muted-foreground">
      Today's estimate: <CountUp 
        key="estimate"
        value={stockValueEstimate.currentEstimate} 
        decimals={0}
        className="font-semibold text-foreground"
        suffix=" €"
      />&nbsp;(growth +<CountUp 
        key="growth-per-day"
        value={stockValueEstimate.growthPerDay} 
        decimals={2}
        className="font-semibold text-goldish"
        suffix=" €/d"
      />, contributions +<CountUp 
        key="contribution-per-day"
        value={stockValueEstimate.contributionPerDay} 
        decimals={2}
        className="font-semibold text-goldish"
        suffix=" €/d"
      />&nbsp;= +<CountUp 
        key="total-change"
        value={stockValueEstimate.changePerDay} 
        decimals={2}
        className="font-semibold text-green-600"
        suffix=" €/d"
      />)
    </div>
  );
}
