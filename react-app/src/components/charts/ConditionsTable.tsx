import React from 'react';
import type { Condition } from '../../types';

interface ConditionsTableProps {
  conditions: Condition[];
}

/**
 * Conditions Table Component
 * Displays reward conditions in a table format
 */
export function ConditionsTable({ conditions }: ConditionsTableProps): JSX.Element {
  if (!conditions || conditions.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="bg-card border border-gray-600 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Reward Conditions</h3>
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
              {conditions.map((condition, index) => (
                <tr key={index} className="border-b border-gray-600 last:border-b-0">
                  <td className="py-3 px-4 text-sm">
                    <span className="font-mono bg-gray-800 px-2 py-1 rounded text-xs">
                      {condition.condition ? 
                        parseFloat(condition.condition).toLocaleString('en-US').replace(/,/g, ' ') + ' €' : 
                        'N/A'
                      }
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">
                    {condition.explanation_short || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {condition.explanation_long || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
