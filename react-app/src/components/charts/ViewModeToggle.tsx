import React from 'react';
import type { ViewMode } from '../../types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * View Mode Toggle Component
 * Allows users to switch between different data view modes
 */
export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps): JSX.Element {
  const modes: Array<{ key: ViewMode; label: string }> = [
    { key: 'recorded', label: 'Show only recorded range' },
    { key: 'next2years', label: 'Show next 2 years' },
    { key: 'full', label: 'Show full range' },
  ];

  return (
    <div className="flex items-center justify-center">
      <div className="bg-card border border-gray-600 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          {modes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onViewModeChange(key)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === key 
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
