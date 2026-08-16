import React from 'react';
import type { Config, ViewMode } from '../../types';
import { isPlannedEndPlusOneYearAvailable } from '../../utils/data-processing-utils';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  config?: Config;
  now?: Date;
}

/**
 * View Mode Toggle Component
 * Allows users to switch between different data view modes
 */
export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  config,
  now,
}: ViewModeToggleProps): React.JSX.Element {
  const plannedRangeAvailable = config
    ? isPlannedEndPlusOneYearAvailable(config, now)
    : false;
  const modes: Array<{ key: ViewMode; label: string }> = [
    { key: 'recorded', label: 'Recorded' },
    { key: 'next2years', label: 'Next 2 years' },
    ...(plannedRangeAvailable
      ? [{ key: 'planned' as const, label: 'Planned end plus 1 year' }]
      : []),
    { key: 'full', label: 'Full range' },
  ];
  const effectiveViewMode = viewMode === 'planned' && !plannedRangeAvailable
    ? 'next2years'
    : viewMode;

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-3xl bg-card border border-gray-600 rounded-lg p-2 sm:p-4">
        <div className={`grid grid-cols-2 gap-2 ${plannedRangeAvailable ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          {modes.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onViewModeChange(key)}
              aria-pressed={effectiveViewMode === key}
              className={`min-h-9 w-full whitespace-normal px-2 py-1 rounded-md text-sm font-medium leading-tight transition-colors ${
                effectiveViewMode === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
