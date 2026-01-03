/**
 * Parse a numeric string, handling both comma and dot as decimal separators.
 */
export function parseNumeric(value: string | number | undefined | null): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  // Replace comma with dot for decimal separator, remove any thousand separators.
  const normalized = value.toString().trim().replace(/,/g, '.').replace(/\s/g, '');
  return parseFloat(normalized);
}
