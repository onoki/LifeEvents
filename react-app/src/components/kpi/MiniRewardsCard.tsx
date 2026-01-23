import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useKPICalculations } from '../../hooks/use-kpi-calculations';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { calculateTargetWithFixedContribution, calculateCurrentStockEstimate, calculateRequiredMonthlyContribution, formatPercentage } from '../../utils/financial-utils';
import { parseNumeric } from '../../utils/number-utils';
import { APP_CONFIG } from '../../config/app-config';
import type { Config, Event, MiniReward } from '../../types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const monthsBetween = (start: Date, end: Date): number =>
  (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

const getLastDate = (data: Event[]): Date | null => {
  let latest: Date | null = null;
  data.forEach((item) => {
    if (!item.date) return;
    if (!latest || item.date.getTime() > latest.getTime()) {
      latest = item.date;
    }
  });
  return latest;
};

interface MiniRewardsCardProps {
  data: Event[];
  config: Config;
  miniRewards: MiniReward[];
}

/**
 * Mini Rewards Card Component
 * Shows the next contribution percentage milestone, ETA, and untaken rewards
 */
export function MiniRewardsCard({ data, config, miniRewards }: MiniRewardsCardProps): React.JSX.Element {
  const { currentTime } = useKPICalculations();
  const { isPrivacyMode } = usePrivacyMode();

  const chartData = React.useMemo(() => calculateTargetWithFixedContribution(data, config), [data, config]);
  const lastDate = React.useMemo(() => getLastDate(data), [data]);
  const goal = React.useMemo(() => {
    const parsed = parseNumeric(config.investment_goal || APP_CONFIG.DEFAULTS.INVESTMENT_GOAL.toString());
    return Number.isFinite(parsed) ? parsed : APP_CONFIG.DEFAULTS.INVESTMENT_GOAL;
  }, [config.investment_goal]);
  const annualGrowthRate = React.useMemo(() => {
    const parsed = parseNumeric(config.annual_growth_rate || APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE.toString());
    return Number.isFinite(parsed) ? parsed : APP_CONFIG.DEFAULTS.ANNUAL_GROWTH_RATE;
  }, [config.annual_growth_rate]);

  const monthsRemainingNow = React.useMemo(() => {
    if (!lastDate) return 0;
    return Math.max(0, monthsBetween(currentTime, lastDate));
  }, [currentTime, lastDate]);

  const initialRequired = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return 0;
    const first = chartData[0];
    const adjusted = first?.minRequiredContributionAdjustedForEUNLTrend;
    if (typeof adjusted === 'number' && Number.isFinite(adjusted)) return adjusted;
    const fallback = first?.minRequiredContribution;
    if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
    return 0;
  }, [chartData]);

  const stockEstimate = React.useMemo(() => {
    return calculateCurrentStockEstimate(data, config, currentTime, chartData);
  }, [data, config, currentTime, chartData]);

  const currentRequired = React.useMemo(() => {
    return calculateRequiredMonthlyContribution(
      stockEstimate.currentEstimate,
      goal,
      annualGrowthRate,
      monthsRemainingNow
    );
  }, [annualGrowthRate, goal, monthsRemainingNow, stockEstimate.currentEstimate]);

  const currentPercentRaw = React.useMemo(() => {
    if (!Number.isFinite(initialRequired) || initialRequired <= 0) return 0;
    const progress = (1 - currentRequired / initialRequired) * 100;
    return Number.isFinite(progress) ? progress : 0;
  }, [currentRequired, initialRequired]);

  const currentPercent = Math.min(100, Math.max(0, currentPercentRaw));
  const nextPercent = React.useMemo(() => {
    if (currentPercentRaw < 0) return 0;
    if (currentPercentRaw >= 100) return 100;
    return Math.min(100, Math.floor(currentPercentRaw) + 1);
  }, [currentPercentRaw]);

  const daysToNextPercent = React.useMemo(() => {
    if (!lastDate || !Number.isFinite(initialRequired) || initialRequired <= 0) return null;
    const targetRequired = initialRequired * (1 - nextPercent / 100);
    if (currentRequired <= targetRequired) return 0;
    const maxDays = Math.max(0, Math.ceil((lastDate.getTime() - currentTime.getTime()) / MS_PER_DAY));
    if (maxDays === 0) return null;
    let projectedValue = stockEstimate.currentEstimate;
    let dayCursor = new Date(currentTime);
    const dailyGrowthRate = annualGrowthRate / 365;
    const contributionPerDay = stockEstimate.contributionPerDay;

    for (let day = 1; day <= maxDays; day++) {
      projectedValue = projectedValue * (1 + dailyGrowthRate) + contributionPerDay;
      dayCursor = new Date(dayCursor.getTime() + MS_PER_DAY);
      const monthsRemaining = Math.max(0, monthsBetween(dayCursor, lastDate));
      const projectedRequired = calculateRequiredMonthlyContribution(
        projectedValue,
        goal,
        annualGrowthRate,
        monthsRemaining
      );
      if (projectedRequired <= targetRequired) {
        return day;
      }
    }
    return null;
  }, [annualGrowthRate, currentRequired, currentTime, goal, initialRequired, lastDate, nextPercent, stockEstimate.contributionPerDay, stockEstimate.currentEstimate]);

  const untakenRewards = React.useMemo(() => {
    if (!miniRewards || miniRewards.length === 0) return 0;
    return miniRewards.filter((reward) => reward.percentage <= currentPercent && !reward.taken).length;
  }, [currentPercent, miniRewards]);

  const nextPercentLabel = `${nextPercent} %`;
  const daysLabel = daysToNextPercent === null ? 'Not reached' : `${daysToNextPercent} d`;
  const progressSegmentFloor = Math.max(0, Math.min(99, Math.floor(currentPercentRaw)));
  const progressSegmentCeil = Math.max(progressSegmentFloor + 1, Math.min(100, Math.ceil(currentPercentRaw)));
  const segmentRange = progressSegmentCeil - progressSegmentFloor;
  const progressWithinSegment = segmentRange <= 0
    ? 100
    : Math.min(100, Math.max(0, ((currentPercentRaw - progressSegmentFloor) / segmentRange) * 100));
  const rewardsLabel = isPrivacyMode ? '••••' : `${untakenRewards} untaken rewards`;

  return (
    <Card className="border-gray-600">
      <CardContent className="pt-5 pb-5 px-2 sm:px-5 flex flex-col h-full">
        <div className="flex justify-between items-center flex-grow">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 text-gray-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <text
                  x="12"
                  y="15"
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="serif"
                  fill="currentColor"
                  stroke="none"
                >
                  1
                </text>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">{daysLabel}</div>
              <div className="text-base font-medium text-gray-500">
                {nextPercentLabel}
              </div>
            </div>
          </div>
          <div className="text-base font-semibold text-gray-600">
            {formatPercentage(currentPercent, 2)}
          </div>
        </div>
        <div className="mt-auto pt-2">
          <div className="w-full bg-gray-600 rounded-lg h-7">
            <div
              className="bg-white h-7 rounded-lg transition-all duration-300"
              style={{ width: `${progressWithinSegment}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
            <span>{progressSegmentFloor} %</span>
            <span>{rewardsLabel}</span>
            <span>{progressSegmentCeil} %</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
