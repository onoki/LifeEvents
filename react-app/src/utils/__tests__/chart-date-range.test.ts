import type { Config, Event } from '../../types';
import {
  filterDataByViewMode,
  getChartDateRange,
  getPlannedEndPlusOneYear,
  isPlannedEndPlusOneYearAvailable,
} from '../data-processing-utils';

const localDate = (year: number, month: number, day: number): Date => {
  return new Date(year, month - 1, day);
};

const event = (year: number, month: number, day: number, stocks?: number): Event => ({
  investment_date: localDate(year, month, day),
  stocks_in_eur: stocks,
});

describe('shared chart date ranges', () => {
  const now = localDate(2026, 8, 16);
  const config: Config = {
    planned_monthly_contributions_until: '2028-12-31',
  };
  const data: Event[] = [
    event(2030, 1, 1),
    event(2025, 4, 20, 200),
    event(2023, 2, 1),
    event(2023, 3, 15, 100),
    event(2028, 8, 17),
    event(2028, 8, 16),
    event(2022, 12, 1),
  ];

  it('uses a one-month lead-in and the latest positive stock record for Recorded', () => {
    const range = getChartDateRange(data, config, 'recorded', now);

    expect(range.min).toEqual(localDate(2023, 2, 1));
    expect(range.max).toEqual(localDate(2025, 4, 20));
    expect(filterDataByViewMode(data, 'recorded', config, now).map((item) => item.investment_date)).toEqual([
      localDate(2025, 4, 20),
      localDate(2023, 2, 1),
      localDate(2023, 3, 15),
    ]);
  });

  it('anchors Next 2 years to today instead of the latest stock record', () => {
    const range = getChartDateRange(data, config, 'next2years', now);

    expect(range.min).toEqual(localDate(2023, 2, 1));
    expect(range.max).toEqual(localDate(2028, 8, 16));
    expect(range.max).not.toEqual(localDate(2027, 4, 20));

    const filtered = filterDataByViewMode(data, 'next2years', config, now);
    expect(filtered.some((item) => item.investment_date.getTime() === localDate(2028, 8, 16).getTime())).toBe(true);
    expect(filtered.some((item) => item.investment_date.getTime() === localDate(2028, 8, 17).getTime())).toBe(false);
    expect(filtered.some((item) => item.investment_date.getTime() === localDate(2022, 12, 1).getTime())).toBe(false);
  });

  it('ends the planned view one calendar year after the configured date', () => {
    const range = getChartDateRange(data, config, 'planned', now);

    expect(getPlannedEndPlusOneYear(config, now)).toEqual(localDate(2029, 12, 31));
    expect(isPlannedEndPlusOneYearAvailable(config, now)).toBe(true);
    expect(range.min).toEqual(localDate(2023, 2, 1));
    expect(range.max).toEqual(localDate(2029, 12, 31));
  });

  it('keeps a recently elapsed planned date available while its buffer extends beyond today', () => {
    const recentlyElapsed: Config = {
      planned_monthly_contributions_until: '2026-01-01',
    };

    expect(getPlannedEndPlusOneYear(recentlyElapsed, now)).toEqual(localDate(2027, 1, 1));
    expect(isPlannedEndPlusOneYearAvailable(recentlyElapsed, now)).toBe(true);
  });

  it.each<Config>([
    {},
    { planned_monthly_contributions_until: 'not-a-date' },
    { planned_monthly_contributions_until: '2024-01-01' },
  ])('omits an unavailable planned view and safely falls back to Next 2 years', (unavailableConfig) => {
    expect(getPlannedEndPlusOneYear(unavailableConfig, now)).toBeNull();
    expect(isPlannedEndPlusOneYearAvailable(unavailableConfig, now)).toBe(false);
    expect(getChartDateRange(data, unavailableConfig, 'planned', now).max).toEqual(localDate(2028, 8, 16));
  });

  it('represents Full range as explicitly unbounded', () => {
    expect(getChartDateRange(data, config, 'full', now)).toEqual({ min: null, max: null });
    expect(filterDataByViewMode(data, 'full', config, now)).toEqual(data);
  });

  it('clamps a leap-day horizon to the final day of the target month', () => {
    const leapDayNow = localDate(2024, 2, 29);

    expect(getChartDateRange(data, config, 'next2years', leapDayNow).max).toEqual(localDate(2026, 2, 28));
  });
});
