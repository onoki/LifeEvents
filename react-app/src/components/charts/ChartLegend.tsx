import React from 'react';

export interface LegendItem {
  label: string;
  description: string;
  color?: string;
  strokeDasharray?: string;
  variant?: 'line' | 'area' | 'note';
  hidden?: boolean;
}

interface ChartLegendProps {
  items: LegendItem[];
  defaultOpen?: boolean;
  controls?: React.ReactNode;
}

function LegendSwatch({
  color = '#9ca3af',
  strokeDasharray,
  variant = 'line'
}: {
  color?: string;
  strokeDasharray?: string;
  variant?: LegendItem['variant'];
}): React.JSX.Element {
  if (variant === 'note') {
    return (
      <span className="inline-flex h-[10px] w-[24px] items-center justify-center" aria-hidden="true">
        <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] text-muted-foreground">
          i
        </span>
      </span>
    );
  }

  if (variant === 'area') {
    return (
      <svg width="24" height="10" aria-hidden="true">
        <rect x="0" y="2" width="24" height="6" fill={color} fillOpacity="0.3" />
        <line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg width="24" height="10" aria-hidden="true">
      <line
        x1="0"
        y1="5"
        x2="24"
        y2="5"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
}

export function ChartLegend({ items, defaultOpen = false, controls }: ChartLegendProps): React.JSX.Element {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const visibleItems = items.filter((item) => !item.hidden);

  if (visibleItems.length === 0) {
    return <></>;
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-600 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-gray-500 hover:bg-gray-700/40"
        aria-expanded={isOpen}
      >
        <span
          aria-hidden="true"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[10px]"
        >
          {isOpen ? '−' : '+'}
        </span>
        {isOpen ? 'Hide legend' : 'Show legend'}
      </button>
      {controls}
    </div>
      {isOpen && (
        <div className="mt-2 rounded-md border border-gray-600 bg-card/50 p-3 text-sm">
          <ul className="space-y-2">
            {visibleItems.map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                <div className="mt-1">
                  <LegendSwatch
                    color={item.color}
                    strokeDasharray={item.strokeDasharray}
                    variant={item.variant}
                  />
                </div>
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-muted-foreground">{item.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
