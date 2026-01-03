import React from 'react';
import type { Condition, Event } from '../../types';
import { usePrivacyMode } from '../../hooks/use-privacy-mode';
import { parseNumeric } from '../../utils/number-utils';

interface ConditionsTableProps {
  conditions: Condition[];
  events: Event[];
}

/**
 * Conditions Table Component
 * Displays reward conditions in a table format
 */
export function ConditionsTable({ conditions, events }: ConditionsTableProps): React.JSX.Element {
  const { isPrivacyMode } = usePrivacyMode();
  
  if (!conditions || conditions.length === 0) {
    return null;
  }

  const maxStocksValue = React.useMemo(() => {
    if (!events || events.length === 0) {
      return null;
    }

    let max = -Infinity;
    for (const event of events) {
      const stocks = parseNumeric(event.stocks_in_eur);
      const rate = parseNumeric(event.eunl_rate_to_trend);
      if (Number.isFinite(stocks) && Number.isFinite(rate)) {
        const value = stocks * rate;
        if (value > max) {
          max = value;
        }
      }
    }

    return Number.isFinite(max) ? max : null;
  }, [events]);

  return (
    <div className="mt-6">
      <div className="bg-card border border-gray-600 rounded-lg p-2 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Reward conditions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                  Reward condition
                </th>
                <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                  Name
                </th>
                <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((condition, index) => {
                const conditionValue = condition.condition ? parseNumeric(condition.condition) : null;
                const isReached = maxStocksValue !== null
                  && conditionValue !== null
                  && conditionValue <= maxStocksValue;

                return (
                  <tr
                    key={index}
                    className={`border-b border-gray-600 last:border-b-0${isReached ? ' line-through' : ''}`}
                  >
                    <td className="py-3 px-4 text-sm">
                      <span className="font-mono bg-gray-800 px-2 py-1 rounded text-xs whitespace-nowrap">
                        {isPrivacyMode ? '••••' : 
                          condition.condition ? 
                            `${Math.round(parseNumeric(condition.condition) / 1000)}k €` : 
                            'N/A'
                        }
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium">
                      {isPrivacyMode ? '••••' : (condition.explanation_short || 'N/A')}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {isPrivacyMode ? '••••' : (condition.explanation_long || 'N/A')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
